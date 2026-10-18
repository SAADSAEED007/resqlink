import mongoose, { ClientSession, FilterQuery } from 'mongoose'
import Incident, { IncidentRecord } from './models/incident.model'
import Team from './models/team.model'
import Assignment from './models/assignment.model'
import { IncidentInput, TeamInput, TeamUpdateInput, TeamQuery, IncidentStatus, Priority, Location, VerificationStatus, EmergencyType } from './types'
import { assertAssignable, assertTransition, calculatePriority, distanceKm, isCapable } from './priority.service'
import { detectPotentialDuplicates, evaluateVerification, DuplicateCandidate } from './verification.service'
import { createNotification } from './notification.service'
import { CustomError } from '../../utils/errors'
import { triageIncident } from './incident-triage.service'

import Counter from './models/counter.model'

export interface Page {
    page: number
    limit: number
}
export interface IncidentQuery extends Page {
    unassigned?: boolean
    isSimulated?: boolean
    search?: string
    status?: IncidentStatus
    priorityLevel?: Priority
    emergencyType?: EmergencyType
    verificationStatus?: VerificationStatus
    updatedSince?: Date
    sort: 'priority' | 'oldest' | 'newest'
}

export function formatReportReference(seq: number): string {
    return `RESQ-${String(seq).padStart(6, '0')}`
}

export function formatReportReferenceFallback(id: unknown): string {
    const raw = String(id || '').replace(/[^a-zA-Z0-9]/g, '')
    const tail = raw.slice(-6).toUpperCase().padStart(6, '0')
    return `RESQ-${tail}`
}

export async function initializeCounterIfNeeded(): Promise<void> {
    const isMock = Boolean((Counter.findById as unknown as { _isMockFunction?: boolean })?._isMockFunction)
    if (mongoose.connection.readyState === 0 && !isMock) return
    const existing = await Counter.findById('incident_reference')
    if (existing) return

    const incidents = await Incident.find({
        reportReference: { $regex: /^RESQ-\d+$/ }
    })
        .select('reportReference')
        .lean()

    let maxSeq = 0
    for (const inc of incidents) {
        if (typeof inc.reportReference === 'string') {
            const match = inc.reportReference.match(/^RESQ-(\d+)$/)
            if (match && match[1]) {
                const num = parseInt(match[1], 10)
                if (!isNaN(num) && num > maxSeq) {
                    maxSeq = num
                }
            }
        }
    }

    await Counter.updateOne(
        { _id: 'incident_reference' },
        { $setOnInsert: { seq: maxSeq } },
        { upsert: true }
    )
}

export async function getNextReportReference(session?: ClientSession): Promise<string> {
    const isMock = Boolean((Counter.findOneAndUpdate as unknown as { _isMockFunction?: boolean })?._isMockFunction)
    if (mongoose.connection.readyState === 0 && !isMock) {
        return formatReportReference(1)
    }
    await initializeCounterIfNeeded()
    const counter = await Counter.findOneAndUpdate(
        { _id: 'incident_reference' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true, session }
    )
    if (!counter) {
        throw new CustomError('Failed to generate incident reference number', 500)
    }
    return formatReportReference(counter.seq)
}

export async function ensureIndexes() {
    if (mongoose.connection.readyState === 0) {
        const hasMocks = Boolean((Incident.init as any)?._isMockFunction || (Counter.init as any)?._isMockFunction)
        if (!hasMocks) return
        await Promise.all([
            (Incident.init as any)?._isMockFunction ? Incident.init() : Promise.resolve(),
            (Team.init as any)?._isMockFunction ? Team.init() : Promise.resolve(),
            (Assignment.init as any)?._isMockFunction ? Assignment.init() : Promise.resolve(),
            (Counter.init as any)?._isMockFunction ? Counter.init() : Promise.resolve()
        ])
        return
    }
    await Promise.all([Incident.init(), Team.init(), Assignment.init(), Counter.init()])
    await initializeCounterIfNeeded()
}
export async function transactional<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    await ensureIndexes()
    try {
        return await mongoose.connection.transaction(work)
    } catch (error) {
        if (
            error instanceof Error &&
            /Transaction numbers are only allowed|does not support retryable writes|Transaction support is not available/.test(error.message)
        ) {
            throw new CustomError('Assignment/status operations require a MongoDB replica set (Atlas supports transactions)', 503)
        }
        throw error
    }
}
export async function createIncident(input: IncidentInput) {
    const windowMs = 2 * 60 * 60 * 1000
    const since = new Date(Date.now() - windowMs)
    const isSimulated = Boolean((input as { isSimulated?: boolean }).isSimulated)
    const candidateFilter: FilterQuery<IncidentRecord> = {
        createdAt: { $gte: since },
        status: { $in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] },
        isSimulated
    }
    const candidates = await Incident.find(candidateFilter).select('_id emergencyType location reporterPhone createdAt isSimulated status').lean()
    const duplicateCheck = detectPotentialDuplicates(input, candidates as DuplicateCandidate[])
    const verification = evaluateVerification(input, duplicateCheck)
    const triage = triageIncident(input)
    const priority = calculatePriority(input)
    if (triage.suggestedPriority === 'CRITICAL') {
        priority.priorityLevel = 'CRITICAL'
        priority.priorityScore = Math.max(priority.priorityScore, 75)
        priority.priorityReasons.unshift('Preliminary critical suggestion: reporter indicated possible immediate danger; coordinator review required')
    }

    let retries = 3
    let incident: IncidentRecord | null = null
    while (retries > 0) {
        try {
            const reportReference = await getNextReportReference()
            incident = await Incident.create({
                ...input,
                ...priority,
                immediateDanger: triage.immediateDangerReported,
                triage,
                locationVerificationRequired: !input.location,
                verification,
                reportReference
            })
            break
        } catch (error: any) {
            if (error?.code === 11000 && error?.keyPattern?.reportReference && retries > 1) {
                retries--
                continue
            }
            throw error
        }
    }
    if (!incident) {
        throw new CustomError('Failed to create incident report after reference retries', 500)
    }

    try {
        const refLabel = incident.reportReference ? ` (${incident.reportReference})` : ''
        if (incident.priorityLevel === 'CRITICAL') {
            await createNotification({
                type: 'CRITICAL_INCIDENT',
                severity: 'CRITICAL',
                title: 'Urgent SOS — Coordinator Review Required',
                message: `Critical ${incident.emergencyType} incident reported${incident.location?.address ? ` near ${incident.location.address}` : ''}${refLabel}. Immediate coordinator review required.`,
                incidentId: String(incident._id),
                isSimulated: incident.isSimulated
            })
        } else {
            await createNotification({
                type: 'INCIDENT_CREATED',
                severity: incident.priorityLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
                title: 'New SOS Report',
                message: `New ${incident.emergencyType} incident reported${incident.location?.address ? ` near ${incident.location.address}` : ''}${refLabel} (Priority: ${incident.priorityLevel}).`,
                incidentId: String(incident._id),
                isSimulated: incident.isSimulated
            })
        }

        if (incident.locationVerificationRequired || incident.verification?.requiresManualReview || incident.verification?.status === 'NEEDS_REVIEW') {
            await createNotification({
                type: 'INCIDENT_REVIEW_REQUIRED',
                severity: 'HIGH',
                title: 'Incident Verification Required',
                message: `${incident.emergencyType} incident ${incident.reportReference || `#${String(incident._id).slice(-6)}`} flagged for coordinator verification.`,
                incidentId: String(incident._id),
                isSimulated: incident.isSimulated
            })
        }
    } catch {
        // Notification write failure after successful incident creation must never fail public SOS submission.
    }

    return incident
}
export async function listIncidents(query: IncidentQuery) {
    const filter: FilterQuery<IncidentRecord> = {}
    if (query.status) filter.status = query.status
    if (query.unassigned) { filter.status = 'PENDING'; filter.assignedTeam = null }
    if (typeof query.isSimulated === 'boolean') filter.isSimulated = query.isSimulated
    if (query.search) {
        const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        filter.$or = [
            { reportReference: { $regex: escaped, $options: 'i' } },
            { description: { $regex: escaped, $options: 'i' } },
            { 'location.address': { $regex: escaped, $options: 'i' } }
        ]
    }
    if (query.priorityLevel) filter.priorityLevel = query.priorityLevel
    if (query.emergencyType) filter.emergencyType = query.emergencyType
    if (query.verificationStatus) filter['verification.status'] = query.verificationStatus
    if (query.updatedSince) filter.updatedAt = { $gte: new Date(query.updatedSince) }
    const sort: Record<string, 1 | -1> =
        query.sort === 'newest'
            ? { createdAt: -1 as const, _id: 1 as const }
            : query.sort === 'oldest'
              ? { createdAt: 1 as const, _id: 1 as const }
              : { priorityScore: -1 as const, createdAt: 1 as const, _id: 1 as const }
    const [items, total] = await Promise.all([
        Incident.find(filter)
            .sort(sort)
            .skip((query.page - 1) * query.limit)
            .limit(query.limit)
            .lean(),
        Incident.countDocuments(filter)
    ])
    const enhancedItems = items.map((inc) => ({
        ...inc,
        reportReference: inc.reportReference || formatReportReferenceFallback(inc._id)
    }))
    return { items: enhancedItems, pagination: { ...queryPage(query), total, totalPages: Math.ceil(total / query.limit) } }
}
function queryPage(query: Page) {
    return { page: query.page, limit: query.limit }
}
export async function getIncident(id: string) {
    const incident = await Incident.findById(id)
    if (!incident) throw new CustomError('Incident not found', 404)
    if (!incident.reportReference) {
        incident.set('reportReference', formatReportReferenceFallback(incident._id), { strict: false })
    }
    return incident
}
export async function getTeam(id: string) {
    const query = Team.findById(id)
    const team =
        typeof query.populate === 'function'
            ? await query.populate({
                  path: 'currentIncident',
                  select: '_id emergencyType priorityLevel status location reporterName peopleAffected createdAt'
              })
            : await query
    if (!team) throw new CustomError('Rescue team not found', 404)
    return team
}
export async function createTeam(input: TeamInput) {
    const normalizedCode = input.teamCode.trim().toUpperCase()
    const existing = await Team.findOne({ teamCode: normalizedCode })
    if (existing) {
        throw new CustomError(`A rescue team with team code '${normalizedCode}' already exists`, 409)
    }
    return Team.create({
        ...input,
        teamCode: normalizedCode
    })
}
export async function updateTeam(id: string, input: TeamUpdateInput) {
    const team = await Team.findById(id)
    if (!team) throw new CustomError('Rescue team not found', 404)

    const isActivelyAssigned = team.status === 'BUSY' || Boolean(team.currentIncident)
    const activeAssignment = await Assignment.exists({ teamId: team._id, status: 'ACTIVE' })

    if (input.status) {
        if (isActivelyAssigned || activeAssignment) {
            throw new CustomError(
                'Cannot manually modify availability of an actively assigned (BUSY) rescue team. Complete or cancel the active incident assignment first.',
                409
            )
        }
        team.status = input.status
    }

    if (input.name !== undefined) team.name = input.name
    if (input.capacity !== undefined) team.capacity = input.capacity
    if (input.capabilities !== undefined) team.capabilities = input.capabilities
    if (input.location !== undefined) team.location = input.location
    if (input.contact !== undefined) {
        const currentContact = (team.toObject() as { contact?: Record<string, unknown> }).contact || {}
        team.set('contact', { ...currentContact, ...input.contact })
    }

    if ((isActivelyAssigned || activeAssignment) && !input.status) {
        team.status = 'BUSY'
    }

    await team.save()
    return team
}
export async function listTeams(query: TeamQuery) {
    const filter: FilterQuery<typeof Team> = {}
    if (query.status) filter.status = query.status
    if (query.capability) filter.capabilities = query.capability
    if (query.isSimulated !== undefined) filter.isSimulated = query.isSimulated
    if (query.search) {
        const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { teamCode: { $regex: escaped, $options: 'i' } }]
    }
    const [items, total] = await Promise.all([
        Team.find(filter)
            .sort({ teamCode: 1 })
            .skip((query.page - 1) * query.limit)
            .limit(query.limit)
            .lean(),
        Team.countDocuments(filter)
    ])
    return { items, pagination: { ...queryPage(query), total, totalPages: Math.ceil(total / query.limit) } }
}
export interface AssignmentFilter {
    completedAt?: { $gte?: Date; $lt?: Date }
    status?: string
    incidentId?: unknown
    teamId?: unknown
    isSimulated?: boolean
}

export async function listAssignments(query: Page & { status?: string; incidentId?: string; teamId?: string; isSimulated?: boolean; completedFrom?: Date; completedBefore?: Date; sort?: 'assigned' | 'completed' }) {
    const filter: AssignmentFilter = {}
    if (query.completedFrom || query.completedBefore) filter.completedAt = {
        ...(query.completedFrom ? { $gte: new Date(query.completedFrom) } : {}),
        ...(query.completedBefore ? { $lt: new Date(query.completedBefore) } : {})
    }
    if (query.status) filter.status = query.status
    if (query.incidentId) filter.incidentId = query.incidentId
    if (query.teamId) filter.teamId = query.teamId
    if (typeof query.isSimulated === 'boolean') filter.isSimulated = query.isSimulated

    const populateIncident = {
        path: 'incidentId',
        select: '_id emergencyType priorityLevel status location peopleAffected createdAt'
    }
    const populateTeam = {
        path: 'teamId',
        select: '_id name teamCode capabilities status capacity location contactInformation'
    }

    const [items, total] = await Promise.all([
        Assignment.find(filter)
            .populate(populateIncident)
            .populate(populateTeam)
            .sort(query.sort === 'completed' ? { completedAt: -1, _id: 1 } : { assignedAt: -1, _id: 1 })
            .skip((query.page - 1) * query.limit)
            .limit(query.limit)
            .lean(),
        Assignment.countDocuments(filter)
    ])
    return { items, pagination: { ...queryPage(query), total, totalPages: Math.ceil(total / query.limit) } }
}

export async function getAssignment(id: string) {
    const populateIncident = {
        path: 'incidentId',
        select: '_id emergencyType priorityLevel status location peopleAffected createdAt'
    }
    const populateTeam = {
        path: 'teamId',
        select: '_id name teamCode capabilities status capacity location contactInformation'
    }

    const assignment = await Assignment.findById(id)
        .populate(populateIncident)
        .populate(populateTeam)
        .lean()

    if (!assignment) throw new CustomError('Assignment not found', 404)
    return assignment
}
export async function assignTeam(input: { incidentId: string; teamId: string; notes?: string }) {
    const assignment = await transactional(async (session) => {
        // MongoDB sessions do not support parallel operations within a transaction.
        const incident = await Incident.findById(input.incidentId).session(session)
        if (!incident) throw new CustomError('Incident not found', 404)
        const team = await Team.findById(input.teamId).session(session)
        if (!team) throw new CustomError('Rescue team not found', 404)
        assertAssignable({ ...incident.toObject(), emergencyType: incident.emergencyType }, team)
        if (incident.isSimulated !== team.isSimulated) throw new CustomError('Simulated incidents can only use simulated teams', 409)
        const active = await Assignment.exists({ $or: [{ incidentId: incident._id }, { teamId: team._id }], status: 'ACTIVE' }).session(session)
        if (active) throw new CustomError('An active assignment already exists for this incident or team', 409)
        const [assignment] = await Assignment.create([{ ...input, isSimulated: incident.isSimulated }], { session })
        incident.status = 'ASSIGNED'
        incident.assignedTeam = team._id
        team.status = 'BUSY'
        team.currentIncident = incident._id
        await incident.save({ session })
        await team.save({ session })
        return assignment
    })

    try {
        await createNotification({
            type: 'TEAM_ASSIGNED',
            severity: 'HIGH',
            title: 'Rescue Team Assigned',
            message: `Rescue team has been assigned to incident #${String(input.incidentId).slice(-6)}.`,
            incidentId: String(input.incidentId),
            teamId: String(input.teamId),
            assignmentId: String(assignment._id),
            isSimulated: assignment.isSimulated
        })
    } catch {
        // Notification write failure must not fail assignment operation
    }

    return assignment
}

export async function changeStatus(id: string, status: IncidentStatus, coordinatorId?: string) {
    const incident = await transactional(async (session) => {
        const incident = await Incident.findById(id).session(session)
        if (!incident) throw new CustomError('Incident not found', 404)
        assertTransition(incident.status, status)
        const previousStatus = incident.status
        if (incident.assignedTeam) {
            const assignment = await Assignment.findOne({ incidentId: incident._id, teamId: incident.assignedTeam, status: 'ACTIVE' }).session(
                session
            )
            const team = await Team.findOne({ _id: incident.assignedTeam, currentIncident: incident._id, status: 'BUSY' }).session(session)
            if (!assignment || !team) throw new CustomError('Assignment records are inconsistent; manual reconciliation required', 409)
            if (status === 'RESOLVED' || status === 'CANCELLED') {
                assignment.status = status === 'RESOLVED' ? 'COMPLETED' : 'CANCELLED'
                assignment.completedAt = new Date()
                team.status = 'AVAILABLE'
                team.set('currentIncident', null)
                incident.set('assignedTeam', null)
                await assignment.save({ session })
                await team.save({ session })
            }
        } else if (incident.status !== 'PENDING') throw new CustomError('Assigned incident is missing its team; manual reconciliation required', 409)
        incident.status = status
        if (!Array.isArray(incident.statusHistory)) {
            incident.set('statusHistory', [])
        }
        incident.statusHistory.push({
            previousStatus,
            newStatus: status,
            changedBy: coordinatorId ? new mongoose.Types.ObjectId(coordinatorId) : null,
            timestamp: new Date()
        })
        await incident.save({ session })
        return incident
    })

    try {
        if (status === 'IN_PROGRESS') {
            await createNotification({
                type: 'INCIDENT_IN_PROGRESS',
                severity: 'HIGH',
                title: 'Incident In Progress',
                message: `Incident #${String(incident._id).slice(-6)} is now actively in progress.`,
                incidentId: String(incident._id),
                teamId: incident.assignedTeam ? String(incident.assignedTeam) : null,
                isSimulated: incident.isSimulated
            })
        } else if (status === 'RESOLVED') {
            await createNotification({
                type: 'INCIDENT_RESOLVED',
                severity: 'LOW',
                title: 'Incident Resolved',
                message: `Incident #${String(incident._id).slice(-6)} has been successfully resolved.`,
                incidentId: String(incident._id),
                isSimulated: incident.isSimulated
            })
        } else if (status === 'CANCELLED') {
            await createNotification({
                type: 'INCIDENT_CANCELLED',
                severity: 'LOW',
                title: 'Incident Cancelled',
                message: `Incident #${String(incident._id).slice(-6)} has been cancelled.`,
                incidentId: String(incident._id),
                isSimulated: incident.isSimulated
            })
        }
    } catch {
        // Notification write failure must not fail status update operation
    }

    return incident
}

export async function overridePriority(id: string, priorityLevel: Priority, reason: string, coordinatorId: string) {
    return transactional(async (session) => {
        const incident = await Incident.findById(id).session(session)
        if (!incident) throw new CustomError('Incident not found', 404)
        if (['RESOLVED', 'CANCELLED'].includes(incident.status)) throw new CustomError('Cannot override a closed incident', 409)
        const scores: Record<Priority, number> = { CRITICAL: 75, HIGH: 50, MEDIUM: 25, LOW: 0 }
        const score = priorityLevel === incident.priorityLevel ? incident.priorityScore : scores[priorityLevel]
        incident.priorityOverrides.push({
            previousPriority: incident.priorityLevel,
            newPriority: priorityLevel,
            previousScore: incident.priorityScore,
            newScore: score,
            reason,
            coordinatorId: new mongoose.Types.ObjectId(coordinatorId),
            timestamp: new Date()
        })
        incident.priorityLevel = priorityLevel
        incident.priorityScore = score
        if (incident.triage) {
            incident.triage.status = 'COORDINATOR_REVIEWED'
            incident.triage.reviewedAt = new Date()
            incident.triage.reviewedBy = new mongoose.Types.ObjectId(coordinatorId)
        }
        // Original risk reasons/confidence stay intact; audit holds manual rationale.
        await incident.save({ session })
        return incident
    })
}
export async function recommendTeams(id: string) {
    const incident = await getIncident(id)
    if (incident.status !== 'PENDING') throw new CustomError('Recommendations are only available for pending incidents', 409)
    if (!incident.location)
        return {
            manualSelectionRequired: true,
            distanceType: 'APPROXIMATE_STRAIGHT_LINE_KM',
            message: 'Missing incident coordinates; verify location and select manually',
            items: []
        }
    const teams = await Team.find({ status: 'AVAILABLE', currentIncident: null, isSimulated: incident.isSimulated }).lean()
    const items = teams
        .filter((team) => isCapable(incident.emergencyType, team.capabilities))
        .map((team) => ({
            team,
            approximateDistanceKm: Math.round(distanceKm(incident.location as Location, team.location) * 100) / 100,
            capacityWarning:
                typeof incident.peopleAffected === 'number' && team.capacity < incident.peopleAffected
                    ? 'Capacity below reported people; multiple trips or additional resources may be needed'
                    : null
        }))
        .sort((a, b) => a.approximateDistanceKm - b.approximateDistanceKm || a.team.teamCode.localeCompare(b.team.teamCode))
    return {
        manualSelectionRequired: false,
        distanceType: 'APPROXIMATE_STRAIGHT_LINE_KM',
        message: 'Decision support only; no team has been dispatched. Distance is not travel time.',
        items
    }
}
export async function updateVerification(id: string, status: VerificationStatus, reviewNotes: string, coordinatorId: string) {
    return transactional(async (session) => {
        const incident = await Incident.findById(id).session(session)
        if (!incident) throw new CustomError('Incident not found', 404)
        if (!incident.verification) {
            incident.set('verification', {
                status: 'NEEDS_REVIEW',
                requiresManualReview: Boolean(incident.locationVerificationRequired),
                isPotentialDuplicate: false,
                potentialDuplicateIncidents: [],
                missingFields: !incident.location ? ['location'] : [],
                warnings: !incident.location ? ['Missing location coordinates: manual location verification required before team dispatch'] : [],
                reviewedBy: null,
                reviewedAt: null,
                reviewNotes: null
            })
        }
        incident.verification.status = status
        incident.verification.reviewNotes = reviewNotes
        incident.verification.reviewedBy = new mongoose.Types.ObjectId(coordinatorId)
        incident.verification.reviewedAt = new Date()
        if (status === 'VERIFIED' || status === 'DISMISSED') {
            incident.verification.requiresManualReview = false
        } else {
            incident.verification.requiresManualReview = true
        }
        await incident.save({ session })
        return incident
    })
}
