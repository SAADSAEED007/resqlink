import mongoose, { ClientSession, FilterQuery } from 'mongoose'
import Incident, { IncidentRecord } from './models/incident.model'
import Team from './models/team.model'
import Assignment from './models/assignment.model'
import { IncidentInput, TeamInput, IncidentStatus, Priority, Location, VerificationStatus, EmergencyType } from './types'
import { assertAssignable, assertTransition, calculatePriority, distanceKm, isCapable } from './priority.service'
import { detectPotentialDuplicates, evaluateVerification, DuplicateCandidate } from './verification.service'
import { CustomError } from '../../utils/errors'

export interface Page {
    page: number
    limit: number
}
export interface IncidentQuery extends Page {
    status?: IncidentStatus
    priorityLevel?: Priority
    emergencyType?: EmergencyType
    verificationStatus?: VerificationStatus
    updatedSince?: Date
    sort: 'priority' | 'oldest' | 'newest'
}
export async function ensureIndexes() {
    await Promise.all([Incident.init(), Team.init(), Assignment.init()])
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

    return Incident.create({
        ...input,
        ...calculatePriority(input),
        locationVerificationRequired: !input.location,
        verification
    })
}
export async function listIncidents(query: IncidentQuery) {
    const filter: FilterQuery<IncidentRecord> = {}
    if (query.status) filter.status = query.status
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
    return { items, pagination: { ...queryPage(query), total, totalPages: Math.ceil(total / query.limit) } }
}
function queryPage(query: Page) {
    return { page: query.page, limit: query.limit }
}
export async function getIncident(id: string) {
    const incident = await Incident.findById(id)
    if (!incident) throw new CustomError('Incident not found', 404)
    return incident
}
export async function getTeam(id: string) {
    const team = await Team.findById(id)
    if (!team) throw new CustomError('Rescue team not found', 404)
    return team
}
export async function createTeam(input: TeamInput) {
    return Team.create(input)
}
export async function listTeams(query: Page & { status?: string }) {
    const filter = query.status ? { status: query.status } : {}
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
export async function listAssignments(query: Page & { status?: string }) {
    const filter = query.status ? { status: query.status } : {}
    const [items, total] = await Promise.all([
        Assignment.find(filter)
            .sort({ assignedAt: -1, _id: 1 })
            .skip((query.page - 1) * query.limit)
            .limit(query.limit)
            .lean(),
        Assignment.countDocuments(filter)
    ])
    return { items, pagination: { ...queryPage(query), total, totalPages: Math.ceil(total / query.limit) } }
}
export async function assignTeam(input: { incidentId: string; teamId: string; notes?: string }) {
    return transactional(async (session) => {
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
}
export async function changeStatus(id: string, status: IncidentStatus) {
    return transactional(async (session) => {
        const incident = await Incident.findById(id).session(session)
        if (!incident) throw new CustomError('Incident not found', 404)
        assertTransition(incident.status, status)
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
        await incident.save({ session })
        return incident
    })
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
                team.capacity < incident.peopleAffected
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
