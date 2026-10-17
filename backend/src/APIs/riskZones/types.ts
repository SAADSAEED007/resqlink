export const HAZARD_TYPES = ['FLOOD_INUNDATION', 'FLASH_FLOOD', 'RIVER_BREACH', 'HEATWAVE', 'WATER_SHORTAGE', 'OTHER'] as const

export const HAZARD_SEVERITIES = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'] as const

export const CONNECTIVITY_STATUSES = ['NO_CELL_COVERAGE', 'INTERMITTENT_SIGNAL', 'NORMAL_NETWORK', 'UNKNOWN'] as const

export const ASSESSMENT_STATUSES = ['PENDING_ASSESSMENT', 'ASSESSMENT_DISPATCHED', 'ASSESSMENT_COMPLETED', 'MONITORING_ONLY', 'INACTIVE'] as const

export const ASSESSMENT_URGENCIES = ['CRITICAL', 'URGENT', 'ROUTINE'] as const

export const CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const

export type HazardType = (typeof HAZARD_TYPES)[number]
export type HazardSeverity = (typeof HAZARD_SEVERITIES)[number]
export type ConnectivityStatus = (typeof CONNECTIVITY_STATUSES)[number]
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number]
export type AssessmentUrgency = (typeof ASSESSMENT_URGENCIES)[number]
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number]

export interface ApproximateLocation {
    latitude?: number | null
    longitude?: number | null
    landmarkDescription: string
    isLocationEstimated?: boolean
}

export interface VulnerablePopulation {
    estimatedTotalPopulation?: number | null
    estimatedVulnerableCount?: number | null
    vulnerabilityDetails?: string | null
}

export interface FieldAssessmentInput {
    priorityUrgency: AssessmentUrgency
    assignedOfficer?: string
    assessmentNotes: string
}

export interface FieldAssessment {
    priorityUrgency: AssessmentUrgency
    assignedOfficer?: string | null
    assessmentNotes: string
    requestedBy: import('mongoose').Types.ObjectId
    requestedAt: Date
    completedAt?: Date | null
}

export interface StatusHistory {
    previousStatus: AssessmentStatus
    newStatus: AssessmentStatus
    notes: string
    changedBy: import('mongoose').Types.ObjectId
    changedAt: Date
}

export interface ICommunityRiskZone {
    communityName: string
    district: string
    tehsil?: string
    approximateLocation: ApproximateLocation
    hazardType: HazardType
    hazardSeverity: HazardSeverity
    connectivityStatus: ConnectivityStatus
    accessObstacles?: string[]
    vulnerablePopulation?: VulnerablePopulation
    informationConfidence: ConfidenceLevel
    confidenceReasons?: string[]
    assessmentStatus: AssessmentStatus
    assessments?: FieldAssessment[]
    fieldAssessment?: FieldAssessment | null
    statusHistory: StatusHistory[]
    notes?: string
    isSimulated: boolean
    demoKey?: string
    createdAt?: Date
    updatedAt?: Date
}

export interface CommunityRiskZoneInput {
    communityName: string
    district: string
    tehsil?: string
    approximateLocation: ApproximateLocation
    hazardType: HazardType
    hazardSeverity: HazardSeverity
    connectivityStatus: ConnectivityStatus
    accessObstacles?: string[]
    vulnerablePopulation?: VulnerablePopulation
    informationConfidence?: ConfidenceLevel
    confidenceReasons?: string[]
    assessmentStatus?: AssessmentStatus
    notes?: string
    isSimulated?: boolean
    demoKey?: string
}
