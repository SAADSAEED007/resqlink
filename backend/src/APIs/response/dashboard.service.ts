import { FilterQuery } from 'mongoose'
import Incident, { IncidentRecord } from './models/incident.model'
import Team from './models/team.model'
import Assignment from './models/assignment.model'
import {
    EmergencyType,
    IncidentStatus,
    Priority,
    TeamStatus,
    AssignmentStatus,
    DashboardQuery,
    ActivityQuery,
    DashboardSummary,
    ActivityItem,
    TrendPointHourly,
    TrendPointDaily
} from './types'

export interface RawIncidentItem {
    _id: unknown
    reporterName?: string
    emergencyType?: EmergencyType
    priorityLevel?: Priority
    priorityScore?: number
    status?: IncidentStatus
    peopleAffected?: number
    locationVerificationRequired?: boolean
    priorityOverrides?: Array<{
        previousPriority?: Priority
        newPriority?: Priority
        previousScore?: number
        newScore?: number
        reason?: string
        coordinatorId?: unknown
        timestamp?: Date | string
    }>
    createdAt?: Date | string
}

export interface PopulatedTeamRef {
    _id?: unknown
    name?: string
    teamCode?: string
    status?: TeamStatus
}

export interface PopulatedIncidentRef {
    _id?: unknown
    reporterName?: string
    emergencyType?: EmergencyType
    status?: IncidentStatus
    priorityLevel?: Priority
}

export interface RawAssignmentItem {
    _id: unknown
    incidentId?: PopulatedIncidentRef | string | null
    teamId?: PopulatedTeamRef | string | null
    assignedAt?: Date | string
    completedAt?: Date | string | null
    status?: AssignmentStatus
    notes?: string
}

interface CommonFilter {
    isSimulated?: boolean
}

export function calculateTrends(incidents: Array<{ createdAt?: Date | string; priorityLevel?: string }>, referenceDate = new Date()) {
    const now = referenceDate.getTime()
    const last24Hours: TrendPointHourly[] = []
    for (let i = 23; i >= 0; i--) {
        const bucketTime = new Date(now - i * 60 * 60 * 1000)
        const hourLabel = `${bucketTime.getHours().toString().padStart(2, '0')}:00`
        const isoBucket = bucketTime.toISOString().slice(0, 13) + ':00'
        last24Hours.push({
            timestamp: isoBucket,
            label: hourLabel,
            count: 0,
            criticalCount: 0
        })
    }

    const last7Days: TrendPointDaily[] = []
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    for (let i = 6; i >= 0; i--) {
        const bucketDate = new Date(now - i * 24 * 60 * 60 * 1000)
        const dateStr = bucketDate.toISOString().slice(0, 10)
        const label = `${dayNames[bucketDate.getDay()]} (${dateStr.slice(5)})`
        last7Days.push({
            date: dateStr,
            label,
            count: 0,
            criticalCount: 0
        })
    }

    for (const inc of incidents) {
        if (!inc.createdAt) continue
        const d = new Date(inc.createdAt)
        const time = d.getTime()
        if (Number.isNaN(time)) continue
        const isCritical = inc.priorityLevel === 'CRITICAL'

        if (time >= now - 24 * 60 * 60 * 1000 && time <= now) {
            const isoHour = d.toISOString().slice(0, 13) + ':00'
            const bucket = last24Hours.find((b) => b.timestamp === isoHour)
            if (bucket) {
                bucket.count++
                if (isCritical) bucket.criticalCount++
            }
        }

        const isoDay = d.toISOString().slice(0, 10)
        const dayBucket = last7Days.find((b) => b.date === isoDay)
        if (dayBucket) {
            dayBucket.count++
            if (isCritical) dayBucket.criticalCount++
        }
    }

    return { last24Hours, last7Days }
}

export function buildActivityTimeline(incidents: RawIncidentItem[], assignments: RawAssignmentItem[], limit = 20): ActivityItem[] {
    const events: ActivityItem[] = []

    for (const inc of incidents) {
        if (inc.createdAt) {
            events.push({
                id: `inc-created-${String(inc._id)}`,
                type: 'INCIDENT_REPORTED',
                title: `SOS Reported: ${inc.emergencyType || 'Emergency'} (${inc.peopleAffected || 1} affected)`,
                timestamp: new Date(inc.createdAt),
                priority: inc.priorityLevel,
                status: inc.status,
                metadata: {
                    incidentId: String(inc._id),
                    reporterName: inc.reporterName || 'Anonymous',
                    emergencyType: inc.emergencyType || 'OTHER',
                    peopleAffected: inc.peopleAffected || 1
                }
            })
        }

        if (Array.isArray(inc.priorityOverrides)) {
            for (const ov of inc.priorityOverrides) {
                if (ov.timestamp) {
                    events.push({
                        id: `ov-${String(inc._id)}-${new Date(ov.timestamp).getTime()}`,
                        type: 'PRIORITY_OVERRIDE',
                        title: `Priority override to ${ov.newPriority || 'UNKNOWN'}: "${ov.reason || 'Manual override'}"`,
                        timestamp: new Date(ov.timestamp),
                        priority: ov.newPriority,
                        metadata: {
                            incidentId: String(inc._id),
                            previousPriority: ov.previousPriority || 'UNKNOWN',
                            newPriority: ov.newPriority || 'UNKNOWN',
                            reason: ov.reason || ''
                        }
                    })
                }
            }
        }
    }

    for (const asg of assignments) {
        const teamObj = typeof asg.teamId === 'object' && asg.teamId !== null ? asg.teamId : undefined
        const teamName = teamObj?.teamCode || teamObj?.name || 'Rescue Team'
        const incObj = typeof asg.incidentId === 'object' && asg.incidentId !== null ? asg.incidentId : undefined
        const incType = incObj?.emergencyType || 'Incident'

        if (asg.assignedAt) {
            events.push({
                id: `asg-created-${String(asg._id)}`,
                type: 'TEAM_ASSIGNED',
                title: `Team ${teamName} assigned to ${incType}`,
                timestamp: new Date(asg.assignedAt),
                status: asg.status,
                metadata: {
                    assignmentId: String(asg._id),
                    incidentId: incObj?._id ? String(incObj._id) : String(asg.incidentId),
                    teamId: teamObj?._id ? String(teamObj._id) : String(asg.teamId),
                    notes: asg.notes || ''
                }
            })
        }
        if (asg.completedAt) {
            events.push({
                id: `asg-completed-${String(asg._id)}`,
                type: 'ASSIGNMENT_COMPLETED',
                title: `Assignment completed by Team ${teamName}`,
                timestamp: new Date(asg.completedAt),
                status: asg.status,
                metadata: {
                    assignmentId: String(asg._id),
                    incidentId: incObj?._id ? String(incObj._id) : String(asg.incidentId),
                    teamId: teamObj?._id ? String(teamObj._id) : String(asg.teamId)
                }
            })
        }
    }

    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    return events.slice(0, limit)
}

export async function getDashboardSummary(query?: DashboardQuery): Promise<DashboardSummary> {
    const incidentFilter: FilterQuery<IncidentRecord> = {}
    const teamFilter: FilterQuery<CommonFilter> = {}
    const assignmentFilter: FilterQuery<CommonFilter> = {}

    if (typeof query?.isSimulated === 'boolean') {
        incidentFilter.isSimulated = query.isSimulated
        teamFilter.isSimulated = query.isSimulated
        assignmentFilter.isSimulated = query.isSimulated
    }

    const statusCounts: Record<IncidentStatus, number> = {
        PENDING: 0,
        ASSIGNED: 0,
        IN_PROGRESS: 0,
        RESOLVED: 0,
        CANCELLED: 0
    }
    const priorityCounts: Record<Priority, number> = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0
    }
    const emergencyTypeCounts: Record<EmergencyType, number> = {
        FLOOD: 0,
        MEDICAL: 0,
        FIRE: 0,
        STRANDED: 0,
        SUPPLIES: 0,
        OTHER: 0
    }
    const teamStatusCounts: Record<TeamStatus, number> = {
        AVAILABLE: 0,
        BUSY: 0,
        OFFLINE: 0
    }
    const assignmentStatusCounts: Record<AssignmentStatus, number> = {
        ACTIVE: 0,
        COMPLETED: 0,
        CANCELLED: 0
    }

    const [
        incidentStatusAgg,
        incidentPriorityAgg,
        incidentTypeAgg,
        incidentTotalsAgg,
        totalIncidents,
        teamStatusAgg,
        totalTeams,
        assignmentStatusAgg,
        totalAssignments,
        trendIncidents,
        recentIncidents,
        recentAssignments
    ] = await Promise.all([
        Incident.aggregate<{ _id: IncidentStatus; count: number }>([{ $match: incidentFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        Incident.aggregate<{ _id: Priority; count: number }>([{ $match: incidentFilter }, { $group: { _id: '$priorityLevel', count: { $sum: 1 } } }]),
        Incident.aggregate<{ _id: EmergencyType; count: number }>([
            { $match: incidentFilter },
            { $group: { _id: '$emergencyType', count: { $sum: 1 } } }
        ]),
        Incident.aggregate<{ totalPeopleAffected: number; requiringLocationVerification: number }>([
            { $match: incidentFilter },
            {
                $group: {
                    _id: null,
                    totalPeopleAffected: { $sum: '$peopleAffected' },
                    requiringLocationVerification: {
                        $sum: { $cond: [{ $eq: ['$locationVerificationRequired', true] }, 1, 0] }
                    }
                }
            }
        ]),
        Incident.countDocuments(incidentFilter),
        Team.aggregate<{ _id: TeamStatus; count: number; capacity: number }>([
            { $match: teamFilter },
            { $group: { _id: '$status', count: { $sum: 1 }, capacity: { $sum: '$capacity' } } }
        ]),
        Team.countDocuments(teamFilter),
        Assignment.aggregate<{ _id: AssignmentStatus; count: number }>([
            { $match: assignmentFilter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Assignment.countDocuments(assignmentFilter),
        Incident.find({
            ...incidentFilter,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
            .select('createdAt priorityLevel')
            .lean(),
        Incident.find(incidentFilter)
            .sort({ createdAt: -1, _id: 1 })
            .limit(10)
            .select('_id reporterName emergencyType priorityLevel priorityScore status peopleAffected priorityOverrides createdAt')
            .lean(),
        Assignment.find(assignmentFilter)
            .sort({ assignedAt: -1, _id: 1 })
            .limit(10)
            .populate('incidentId', 'reporterName emergencyType status')
            .populate('teamId', 'name teamCode status')
            .lean()
    ])

    for (const item of incidentStatusAgg) {
        if (item._id && item._id in statusCounts) {
            statusCounts[item._id] = item.count
        }
    }

    for (const item of incidentPriorityAgg) {
        if (item._id && item._id in priorityCounts) {
            priorityCounts[item._id] = item.count
        }
    }

    for (const item of incidentTypeAgg) {
        if (item._id && item._id in emergencyTypeCounts) {
            emergencyTypeCounts[item._id] = item.count
        }
    }

    let totalCapacity = 0
    let availableCapacity = 0
    let busyCapacity = 0
    for (const item of teamStatusAgg) {
        if (item._id && item._id in teamStatusCounts) {
            teamStatusCounts[item._id] = item.count
            totalCapacity += item.capacity || 0
            if (item._id === 'AVAILABLE') availableCapacity = item.capacity || 0
            if (item._id === 'BUSY') busyCapacity = item.capacity || 0
        }
    }

    for (const item of assignmentStatusAgg) {
        if (item._id && item._id in assignmentStatusCounts) {
            assignmentStatusCounts[item._id] = item.count
        }
    }

    const totals = incidentTotalsAgg[0] || { totalPeopleAffected: 0, requiringLocationVerification: 0 }
    const trends = calculateTrends(trendIncidents)
    const activity = buildActivityTimeline(recentIncidents as unknown as RawIncidentItem[], recentAssignments as unknown as RawAssignmentItem[], 10)

    return {
        incidents: {
            total: totalIncidents,
            byStatus: statusCounts,
            byPriority: priorityCounts,
            byEmergencyType: emergencyTypeCounts,
            totalPeopleAffected: totals.totalPeopleAffected || 0,
            requiringLocationVerification: totals.requiringLocationVerification || 0
        },
        teams: {
            total: totalTeams,
            byStatus: teamStatusCounts,
            totalCapacity,
            availableCapacity,
            busyCapacity
        },
        assignments: {
            total: totalAssignments,
            byStatus: assignmentStatusCounts
        },
        trends,
        recentActivity: activity
    }
}

export async function getDashboardActivity(query?: ActivityQuery): Promise<{ items: ActivityItem[]; total: number }> {
    const limit = query?.limit || 20
    const incidentFilter: FilterQuery<IncidentRecord> = {}
    const assignmentFilter: FilterQuery<CommonFilter> = {}

    if (typeof query?.isSimulated === 'boolean') {
        incidentFilter.isSimulated = query.isSimulated
        assignmentFilter.isSimulated = query.isSimulated
    }

    const [incidents, assignments] = await Promise.all([
        Incident.find(incidentFilter)
            .sort({ createdAt: -1, _id: 1 })
            .limit(limit)
            .select('_id reporterName emergencyType priorityLevel priorityScore status peopleAffected priorityOverrides createdAt')
            .lean(),
        Assignment.find(assignmentFilter)
            .sort({ assignedAt: -1, _id: 1 })
            .limit(limit)
            .populate('incidentId', 'reporterName emergencyType status priorityLevel')
            .populate('teamId', 'name teamCode status')
            .lean()
    ])

    const items = buildActivityTimeline(incidents as unknown as RawIncidentItem[], assignments as unknown as RawAssignmentItem[], limit)
    return { items, total: items.length }
}
