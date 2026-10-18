import { IncidentInput, Priority, SosSafetyAnswer, TriageStatus } from './types'

export interface IncidentTriage {
    safetyAnswer: SosSafetyAnswer
    status: TriageStatus
    suggestedPriority: Priority | null
    immediateDangerReported: boolean | null
    reasons: { code: string; message: string }[]
    ruleVersion: 'sos-triage-v1'
    reviewedAt: Date | null
    reviewedBy: null
}

export function triageIncident(input: IncidentInput): IncidentTriage {
    const safetyAnswer = input.safetyAnswer || 'UNANSWERED'
    if (safetyAnswer === 'YES') return {
        safetyAnswer, status: 'PRELIMINARY', suggestedPriority: 'CRITICAL', immediateDangerReported: true,
        reasons: [{ code: 'IMMEDIATE_DANGER_REPORTED', message: 'The reporter indicated a possible immediate threat to life. This signal is unverified and requires coordinator review.' }],
        ruleVersion: 'sos-triage-v1', reviewedAt: null, reviewedBy: null
    }
    if (safetyAnswer === 'NO') return {
        safetyAnswer, status: 'PRELIMINARY', suggestedPriority: null, immediateDangerReported: false,
        reasons: [{ code: 'NO_IMMEDIATE_DANGER_REPORTED', message: 'The reporter did not identify an immediate life threat. Incident severity still requires coordinator review.' }],
        ruleVersion: 'sos-triage-v1', reviewedAt: null, reviewedBy: null
    }
    return {
        safetyAnswer, status: 'NEEDS_ASSESSMENT', suggestedPriority: null, immediateDangerReported: null,
        reasons: [{ code: safetyAnswer === 'UNSURE' ? 'SAFETY_ANSWER_UNCERTAIN' : 'SAFETY_ANSWER_MISSING', message: safetyAnswer === 'UNSURE' ? 'The reporter was unsure whether an immediate danger exists.' : 'The reporter did not provide an immediate-danger assessment.' }],
        ruleVersion: 'sos-triage-v1', reviewedAt: null, reviewedBy: null
    }
}
