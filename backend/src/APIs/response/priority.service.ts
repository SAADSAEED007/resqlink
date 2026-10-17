import { RiskInput, Priority, Capability, EmergencyType, Location, IncidentStatus } from './types'
import { CustomError } from '../../utils/errors'
export function calculatePriority(input: RiskInput) {
    let score = 0
    const reasons: string[] = []
    const add = (condition: boolean, points: number, reason: string) => {
        if (condition) {
            score += points
            reasons.push(reason)
        }
    }
    add(input.immediateDanger === true, 30, 'Immediate danger reported')
    add(input.waterLevel === 'HIGH', 20, 'High water level reported')
    add(input.waterLevel === 'MODERATE', 10, 'Moderate water level reported')
    add(input.emergencyType === 'MEDICAL', 20, 'Medical emergency reported')
    add((input.vulnerablePeople?.medicalNeeds ?? 0) > 0, 15, 'Medical needs reported')
    add((input.vulnerablePeople?.disabled ?? 0) > 0, 10, 'Disabled people reported')
    add((input.vulnerablePeople?.elderly ?? 0) > 0, 10, 'Elderly people reported')
    add((input.vulnerablePeople?.children ?? 0) > 0, 5, 'Children reported')
    add((input.peopleAffected ?? 0) > 1, 5, 'Multiple affected people reported')
    const missing: string[] = []
    if (!input.location) missing.push('location; manual location verification required')
    if (input.immediateDanger === undefined) missing.push('immediate danger')
    if (input.waterLevel === undefined || input.waterLevel === 'UNKNOWN') missing.push('water level')
    if (
        ['elderly', 'children', 'disabled', 'medicalNeeds'].some(
            (key) => input.vulnerablePeople?.[key as keyof NonNullable<RiskInput['vulnerablePeople']>] === undefined
        )
    )
        missing.push('vulnerability information')
    if (missing.length) reasons.push(`Manual review required: missing or uncertain ${missing.join(', ')}`)
    if (score === 0) reasons.push('No scored risk factors reported; this does not establish safety')
    score = Math.min(100, Math.max(0, score))
    const priorityLevel: Priority = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW'
    const confidenceLevel = !input.location || missing.length >= 2 ? 'LOW' : missing.length ? 'MEDIUM' : 'HIGH'
    return { priorityScore: score, priorityLevel, confidenceLevel, priorityReasons: reasons }
}
const suitable: Record<EmergencyType, Capability[]> = {
    FLOOD: ['WATER_RESCUE'],
    MEDICAL: ['MEDICAL'],
    FIRE: ['FIRE_RESPONSE'],
    STRANDED: ['EVACUATION', 'WATER_RESCUE'],
    SUPPLIES: ['SUPPLY_DELIVERY'],
    OTHER: ['EVACUATION']
}
export function isCapable(type: EmergencyType, capabilities: readonly string[]) {
    return suitable[type].some((value) => capabilities.includes(value))
}
export function distanceKm(a: Pick<Location, 'latitude' | 'longitude'>, b: Pick<Location, 'latitude' | 'longitude'>) {
    const rad = (n: number) => (n * Math.PI) / 180
    const h =
        Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
        Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}
export function assertTransition(from: IncidentStatus, to: IncidentStatus) {
    const transitions: Record<IncidentStatus, IncidentStatus[]> = {
        PENDING: ['CANCELLED'],
        ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS: ['RESOLVED'],
        RESOLVED: [],
        CANCELLED: []
    }
    if (!transitions[from].includes(to))
        throw new CustomError('Invalid status transition; use POST /api/assignments to assign a pending incident', 409)
}
export function assertAssignable(
    incident: { status: string; emergencyType: EmergencyType; assignedTeam?: unknown },
    team: { status: string; capabilities: readonly string[]; currentIncident?: unknown }
) {
    if (incident.status !== 'PENDING' || incident.assignedTeam) throw new CustomError('Incident is not pending or already has an assignment', 409)
    if (team.status !== 'AVAILABLE' || team.currentIncident) throw new CustomError('Team is unavailable', 409)
    if (!isCapable(incident.emergencyType, team.capabilities)) throw new CustomError('Team lacks an appropriate capability', 409)
}
