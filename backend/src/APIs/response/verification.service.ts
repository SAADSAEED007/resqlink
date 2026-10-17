import { IncidentInput, Location, VerificationDetails, VerificationStatus } from './types'
import { distanceKm } from './priority.service'

export interface DuplicateCandidate {
    _id: unknown
    emergencyType: string
    location?: Location | null
    reporterPhone?: string
    createdAt: Date
    isSimulated?: boolean
    status?: string
}

export interface DuplicateCheckResult {
    isPotentialDuplicate: boolean
    duplicateIds: string[]
    duplicateReasons: string[]
}

export function identifyIncompleteFields(input: IncidentInput) {
    const missingFields: string[] = []
    const warnings: string[] = []

    if (!input.location) {
        missingFields.push('location')
        warnings.push('Missing location coordinates: manual location verification required before team dispatch')
    }

    if (!input.reporterPhone) {
        missingFields.push('reporterPhone')
        warnings.push('No contact phone provided: callbacks and direct coordination unavailable')
    }

    if (input.waterLevel === undefined || input.waterLevel === 'UNKNOWN') {
        missingFields.push('waterLevel')
        warnings.push('Water level is unknown or unverified')
    }

    if (input.immediateDanger === undefined) {
        missingFields.push('immediateDanger')
        warnings.push('Immediate danger assessment missing; situation urgency unconfirmed')
    }

    const hasIncompleteVulnerabilities =
        !input.vulnerablePeople ||
        ['elderly', 'children', 'disabled', 'medicalNeeds'].some(
            (key) => input.vulnerablePeople?.[key as keyof NonNullable<IncidentInput['vulnerablePeople']>] === undefined
        )

    if (hasIncompleteVulnerabilities) {
        missingFields.push('vulnerablePeople')
        warnings.push('Vulnerability breakdown incomplete: special rescue needs unverified')
    }

    if (input.description && input.description.trim().length < 20) {
        warnings.push('Brief description: additional situational context recommended')
    }

    return { missingFields, warnings }
}

export function detectPotentialDuplicates(
    input: IncidentInput,
    candidates: DuplicateCandidate[],
    options: { windowMinutes?: number; distanceThresholdKm?: number } = {}
): DuplicateCheckResult {
    const windowMinutes = options.windowMinutes ?? 120
    const distanceThresholdKm = options.distanceThresholdKm ?? 0.5
    const duplicateIds: string[] = []
    const duplicateReasons: string[] = []
    const now = Date.now()

    for (const candidate of candidates) {
        const candidateTime = new Date(candidate.createdAt).getTime()
        const diffMinutes = Math.abs(now - candidateTime) / (1000 * 60)
        if (diffMinutes > windowMinutes) continue

        const candidateIdStr = String(candidate._id)
        let isMatch = false
        const reasons: string[] = []

        // Location + Emergency Type match
        if (
            input.location &&
            candidate.location &&
            input.location.latitude != null &&
            input.location.longitude != null &&
            candidate.location.latitude != null &&
            candidate.location.longitude != null &&
            input.emergencyType === candidate.emergencyType
        ) {
            const dist = distanceKm(input.location, candidate.location)
            if (dist <= distanceThresholdKm) {
                isMatch = true
                reasons.push(
                    `Matches incident ${candidateIdStr} (${candidate.emergencyType}) reported ${Math.round(diffMinutes)}m ago within ${Math.round(dist * 100) / 100}km`
                )
            }
        }

        // Matching contact phone within window
        if (input.reporterPhone && candidate.reporterPhone && input.reporterPhone.trim() === candidate.reporterPhone.trim()) {
            isMatch = true
            reasons.push(`Matches incident ${candidateIdStr} with identical reporter phone reported ${Math.round(diffMinutes)}m ago`)
        }

        // Matching address text if both have an address
        if (
            input.location?.address &&
            candidate.location?.address &&
            input.location.address.trim().toLowerCase() === candidate.location.address.trim().toLowerCase() &&
            input.emergencyType === candidate.emergencyType
        ) {
            isMatch = true
            reasons.push(
                `Matches incident ${candidateIdStr} with identical address "${input.location.address.trim()}" reported ${Math.round(diffMinutes)}m ago`
            )
        }

        if (isMatch) {
            if (!duplicateIds.includes(candidateIdStr)) {
                duplicateIds.push(candidateIdStr)
            }
            duplicateReasons.push(...reasons)
        }
    }

    return {
        isPotentialDuplicate: duplicateIds.length > 0,
        duplicateIds,
        duplicateReasons
    }
}

export function evaluateVerification(input: IncidentInput, duplicateCheck: DuplicateCheckResult): VerificationDetails {
    const incomplete = identifyIncompleteFields(input)
    const warnings = [...duplicateCheck.duplicateReasons, ...incomplete.warnings]
    const isPotentialDuplicate = duplicateCheck.isPotentialDuplicate
    const requiresManualReview = isPotentialDuplicate || incomplete.missingFields.length > 0

    const status: VerificationStatus = isPotentialDuplicate ? 'FLAGGED_DUPLICATE' : incomplete.missingFields.length > 0 ? 'NEEDS_REVIEW' : 'VERIFIED'

    return {
        status,
        requiresManualReview,
        isPotentialDuplicate,
        potentialDuplicateIncidents: duplicateCheck.duplicateIds,
        missingFields: incomplete.missingFields,
        warnings,
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null
    }
}
