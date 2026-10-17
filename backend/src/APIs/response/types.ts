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
export interface TeamInput {
    name: string
    teamCode: string
    capabilities: Capability[]
    status?: 'AVAILABLE' | 'OFFLINE'
    location: Location
    capacity: number
}
