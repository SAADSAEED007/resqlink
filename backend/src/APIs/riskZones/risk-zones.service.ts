import mongoose, { FilterQuery } from 'mongoose'
import CommunityRiskZone, { CommunityRiskZoneRecord } from './models/community-risk-zone.model'
import { CommunityRiskZoneInput, HazardSeverity, AssessmentStatus, ConnectivityStatus, FieldAssessmentInput } from './types'
import { SINDH_DEMO_FIXTURES } from './fixtures'
import { CustomError } from '../../utils/errors'

export interface Page {
    page: number
    limit: number
}

export interface RiskZoneQuery extends Page {
    hazardSeverity?: HazardSeverity
    assessmentStatus?: AssessmentStatus
    district?: string
    connectivityStatus?: ConnectivityStatus
    sort: 'severity' | 'oldest' | 'newest'
}

export async function createRiskZone(input: CommunityRiskZoneInput) {
    const loc = input.approximateLocation
    const isLocationEstimated = loc.isLocationEstimated !== undefined ? loc.isLocationEstimated : loc.latitude == null || loc.longitude == null

    const confidenceReasons = input.confidenceReasons ? [...input.confidenceReasons] : []
    let informationConfidence = input.informationConfidence || 'MEDIUM'

    if (loc.latitude == null || loc.longitude == null) {
        if (!confidenceReasons.some((r) => /coordinates/i.test(r))) {
            confidenceReasons.push('Precise coordinates unavailable: approximate landmark reference recorded')
        }
        if (informationConfidence === 'HIGH') {
            informationConfidence = 'MEDIUM'
        }
    }

    if (input.connectivityStatus === 'NO_CELL_COVERAGE') {
        if (!confidenceReasons.some((r) => /cell|connectivity/i.test(r))) {
            confidenceReasons.push('Area has no active cellular coverage: reports rely on external or delayed communication')
        }
    }

    return CommunityRiskZone.create({
        ...input,
        approximateLocation: {
            ...loc,
            isLocationEstimated
        },
        informationConfidence,
        confidenceReasons
    })
}

export async function listRiskZones(query: RiskZoneQuery) {
    const filter: FilterQuery<CommunityRiskZoneRecord> = {}

    if (query.hazardSeverity) filter.hazardSeverity = query.hazardSeverity
    if (query.assessmentStatus) filter.assessmentStatus = query.assessmentStatus
    if (query.connectivityStatus) filter.connectivityStatus = query.connectivityStatus
    if (query.district) filter.district = new RegExp(`^${query.district.trim()}$`, 'i')

    let sort: Record<string, 1 | -1>
    if (query.sort === 'newest') {
        sort = { createdAt: -1, _id: 1 }
    } else if (query.sort === 'oldest') {
        sort = { createdAt: 1, _id: 1 }
    } else {
        // Priority severity sorting
        sort = { hazardSeverity: 1, createdAt: -1, _id: 1 }
    }

    const [items, total] = await Promise.all([
        CommunityRiskZone.find(filter)
            .sort(sort)
            .skip((query.page - 1) * query.limit)
            .limit(query.limit)
            .lean(),
        CommunityRiskZone.countDocuments(filter)
    ])

    // In severity sorting, order CRITICAL > HIGH > MODERATE > LOW
    if (query.sort === 'severity') {
        const severityOrder: Record<string, number> = {
            CRITICAL: 1,
            HIGH: 2,
            MODERATE: 3,
            LOW: 4
        }
        items.sort((a, b) => {
            const weightA = severityOrder[a.hazardSeverity] || 99
            const weightB = severityOrder[b.hazardSeverity] || 99
            if (weightA !== weightB) return weightA - weightB
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
            return timeB - timeA
        })
    }

    return {
        items,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit)
        }
    }
}

export async function getRiskZone(id: string) {
    const zone = await CommunityRiskZone.findById(id)
    if (!zone) throw new CustomError('Community risk zone not found', 404)
    return zone
}

export async function requestFieldAssessment(id: string, input: FieldAssessmentInput, coordinatorId: string) {
    const zone = await CommunityRiskZone.findById(id)
    if (!zone) throw new CustomError('Community risk zone not found', 404)

    const prevStatus = zone.assessmentStatus
    const newStatus: AssessmentStatus = 'ASSESSMENT_DISPATCHED'

    zone.fieldAssessment = {
        priorityUrgency: input.priorityUrgency,
        assignedOfficer: input.assignedOfficer || null,
        assessmentNotes: input.assessmentNotes,
        requestedBy: new mongoose.Types.ObjectId(coordinatorId),
        requestedAt: new Date(),
        completedAt: null
    }

    zone.assessmentStatus = newStatus
    zone.statusHistory.push({
        previousStatus: prevStatus,
        newStatus,
        notes: `Field assessment requested (${input.priorityUrgency}): ${input.assessmentNotes}`,
        changedBy: new mongoose.Types.ObjectId(coordinatorId),
        changedAt: new Date()
    })

    await zone.save()
    return zone
}

export async function updateAssessmentStatus(id: string, status: AssessmentStatus, notes: string, coordinatorId: string) {
    const zone = await CommunityRiskZone.findById(id)
    if (!zone) throw new CustomError('Community risk zone not found', 404)

    const prevStatus = zone.assessmentStatus
    if (prevStatus === status) {
        throw new CustomError('Risk zone is already in the requested assessment status', 409)
    }

    zone.assessmentStatus = status
    if (status === 'ASSESSMENT_COMPLETED' && zone.fieldAssessment && !zone.fieldAssessment.completedAt) {
        zone.fieldAssessment.completedAt = new Date()
    }

    zone.statusHistory.push({
        previousStatus: prevStatus,
        newStatus: status,
        notes,
        changedBy: new mongoose.Types.ObjectId(coordinatorId),
        changedAt: new Date()
    })

    await zone.save()
    return zone
}

export async function seedDemoRiskZones() {
    const results = []
    for (const fixture of SINDH_DEMO_FIXTURES) {
        const existing = await CommunityRiskZone.findOne({ demoKey: fixture.demoKey })
        if (!existing) {
            const created = await CommunityRiskZone.create(fixture)
            results.push(created)
        } else {
            results.push(existing)
        }
    }
    return results
}
