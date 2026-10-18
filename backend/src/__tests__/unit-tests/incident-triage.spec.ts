import { triageIncident } from '../../APIs/response/incident-triage.service'

describe('Smart SOS triage', () => {
    const input = { emergencyType: 'FLOOD' as const }

    test('reports immediate danger as a preliminary critical suggestion', () => {
        const result = triageIncident({ ...input, safetyAnswer: 'YES' })
        expect(result).toMatchObject({ status: 'PRELIMINARY', suggestedPriority: 'CRITICAL', immediateDangerReported: true })
        expect(result.reasons[0].message).toMatch(/unverified/i)
    })

    test.each(['UNSURE', 'UNANSWERED'] as const)('%s remains unconfirmed', (safetyAnswer) => {
        expect(triageIncident({ ...input, safetyAnswer })).toMatchObject({ status: 'NEEDS_ASSESSMENT', suggestedPriority: null, immediateDangerReported: null })
    })

    test('no answer does not create a low-priority suggestion', () => {
        expect(triageIncident({ ...input, safetyAnswer: 'NO' })).toMatchObject({ status: 'PRELIMINARY', suggestedPriority: null, immediateDangerReported: false })
    })

    test('missing legacy input normalizes to unanswered', () => {
        expect(triageIncident(input)).toMatchObject({ safetyAnswer: 'UNANSWERED', status: 'NEEDS_ASSESSMENT' })
    })
})
