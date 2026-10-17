export const EMERGENCY_TYPES = ['FLOOD', 'MEDICAL', 'FIRE', 'STRANDED', 'SUPPLIES', 'OTHER'] as const
export const WATER_LEVELS = ['NONE', 'LOW', 'MODERATE', 'HIGH', 'UNKNOWN'] as const
export const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const
export const CONFIDENCES = ['HIGH', 'MEDIUM', 'LOW'] as const
export const INCIDENT_STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'] as const
export const VERIFICATION_STATUSES = ['NEEDS_REVIEW', 'VERIFIED', 'FLAGGED_DUPLICATE', 'DISMISSED'] as const
export const CAPABILITIES = ['WATER_RESCUE', 'MEDICAL', 'EVACUATION', 'FIRE_RESPONSE', 'SUPPLY_DELIVERY'] as const
export const TEAM_STATUSES = ['AVAILABLE', 'BUSY', 'OFFLINE'] as const
export type EmergencyType = (typeof EMERGENCY_TYPES)[number]
export type Capability = (typeof CAPABILITIES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]
export interface VerificationDetails {
    status: VerificationStatus
    requiresManualReview: boolean
    isPotentialDuplicate: boolean
    potentialDuplicateIncidents: string[]
    missingFields: string[]
    warnings: string[]
    reviewedBy?: string | null
    reviewedAt?: Date | null
    reviewNotes?: string | null
}
export interface Location {
    latitude: number
    longitude: number
    address?: string
}
export interface RiskInput {
    emergencyType: EmergencyType
    peopleAffected: number
    location?: Location | null
    vulnerablePeople?: { elderly?: number; children?: number; disabled?: number; medicalNeeds?: number }
    waterLevel?: (typeof WATER_LEVELS)[number]
    immediateDanger?: boolean
}
export interface IncidentInput extends RiskInput {
    reporterName: string
    reporterPhone?: string
    description: string
}
export interface TeamContact {
    phone?: string
    email?: string
    leadName?: string
}
export interface TeamInput {
    name: string
    teamCode: string
    capabilities: Capability[]
    status?: 'AVAILABLE' | 'OFFLINE'
    location: Location
    capacity: number
    contact?: TeamContact
    isSimulated?: boolean
}
export interface TeamUpdateInput {
    name?: string
    capabilities?: Capability[]
    status?: 'AVAILABLE' | 'OFFLINE'
    location?: Location
    capacity?: number
    contact?: TeamContact
}
export type TeamStatus = (typeof TEAM_STATUSES)[number]
export type AssignmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface Page {
    page: number
    limit: number
}

export interface AssignmentQuery extends Page {
    status?: AssignmentStatus
    incidentId?: string
    teamId?: string
    isSimulated?: boolean
}

export interface TeamQuery extends Page {
    status?: TeamStatus
    capability?: Capability
    search?: string
    isSimulated?: boolean
}

export interface DashboardQuery {
    isSimulated?: boolean
}

export interface ActivityQuery {
    limit?: number
    isSimulated?: boolean
}

export interface ActivityItem {
    id: string
    type: 'INCIDENT_REPORTED' | 'TEAM_ASSIGNED' | 'ASSIGNMENT_COMPLETED' | 'PRIORITY_OVERRIDE'
    title: string
    timestamp: Date
    priority?: Priority
    status?: string
    metadata: Record<string, unknown>
}

export interface IncidentStats {
    total: number
    byStatus: Record<IncidentStatus, number>
    byPriority: Record<Priority, number>
    byEmergencyType: Record<EmergencyType, number>
    totalPeopleAffected: number
    requiringLocationVerification: number
}

export interface TeamStats {
    total: number
    byStatus: Record<TeamStatus, number>
    totalCapacity: number
    availableCapacity: number
    busyCapacity: number
}

export interface AssignmentStats {
    total: number
    byStatus: Record<AssignmentStatus, number>
}

export interface TrendPointHourly {
    timestamp: string
    label: string
    count: number
    criticalCount: number
}

export interface TrendPointDaily {
    date: string
    label: string
    count: number
    criticalCount: number
}

export interface DashboardTrends {
    last24Hours: TrendPointHourly[]
    last7Days: TrendPointDaily[]
}

export interface DashboardSummary {
    incidents: IncidentStats
    teams: TeamStats
    assignments: AssignmentStats
    trends: DashboardTrends
    recentActivity: ActivityItem[]
}

export const NOTIFICATION_TYPES = [
    'INCIDENT_CREATED',
    'CRITICAL_INCIDENT',
    'INCIDENT_REVIEW_REQUIRED',
    'TEAM_ASSIGNED',
    'INCIDENT_IN_PROGRESS',
    'INCIDENT_RESOLVED',
    'INCIDENT_CANCELLED'
] as const
export const NOTIFICATION_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number]

export interface NotificationItem {
    id: string
    type: NotificationType
    severity: NotificationSeverity
    title: string
    message: string
    incidentId?: string | null
    teamId?: string | null
    assignmentId?: string | null
    isRead: boolean
    readAt?: Date | null
    createdAt: Date
}

export interface NotificationQuery extends Page {
    unreadOnly?: boolean
    type?: NotificationType
    isSimulated?: boolean
}

export interface UnreadCountResponse {
    unreadCount: number
}

