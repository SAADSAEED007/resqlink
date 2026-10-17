import mongoose, { ClientSession } from 'mongoose'
import {
    identifyIncompleteFields,
    detectPotentialDuplicates,
    evaluateVerification,
    DuplicateCandidate
} from '../../APIs/response/verification.service'
import { updateVerification } from '../../APIs/response/response.service'
import { verificationUpdateSchema, incidentQuerySchema, validate } from '../../APIs/response/validation'
import Incident from '../../APIs/response/models/incident.model'
import Team from '../../APIs/response/models/team.model'
import Assignment from '../../APIs/response/models/assignment.model'
import { IncidentInput } from '../../APIs/response/types'

const completeInput: IncidentInput = {
    reporterName: 'Fatima Zahra',
    reporterPhone: '+92 300 1234567',
    emergencyType: 'FLOOD',
    description: 'Family stranded on first floor due to rising flood waters',
    location: { latitude: 24.86, longitude: 67.01, address: 'Plot 12, Sector 4, Karachi' },
    peopleAffected: 4,
    vulnerablePeople: { elderly: 1, children: 2, disabled: 0, medicalNeeds: 1 },
    waterLevel: 'HIGH',
    immediateDanger: true
}

describe('lightweight verification - incomplete fields identification', () => {
    it('flags missing location coordinates and requires manual review', () => {
        const result = identifyIncompleteFields({ ...completeInput, location: null })
        expect(result.missingFields).toContain('location')
        expect(result.warnings.some((w) => /Missing location coordinates/.test(w))).toBe(true)
    })

    it('flags missing contact phone', () => {
        const result = identifyIncompleteFields({ ...completeInput, reporterPhone: undefined })
        expect(result.missingFields).toContain('reporterPhone')
        expect(result.warnings.some((w) => /No contact phone/.test(w))).toBe(true)
    })

    it('flags missing or unknown water level and immediate danger', () => {
        const result = identifyIncompleteFields({
            ...completeInput,
            waterLevel: 'UNKNOWN',
            immediateDanger: undefined
        })
        expect(result.missingFields).toContain('waterLevel')
        expect(result.missingFields).toContain('immediateDanger')
    })

    it('flags incomplete vulnerability details', () => {
        const result = identifyIncompleteFields({
            ...completeInput,
            vulnerablePeople: { elderly: 1 } // missing children, disabled, medicalNeeds
        })
        expect(result.missingFields).toContain('vulnerablePeople')
        expect(result.warnings.some((w) => /Vulnerability breakdown incomplete/.test(w))).toBe(true)
    })

    it('produces zero missing fields when all data is provided', () => {
        const result = identifyIncompleteFields(completeInput)
        expect(result.missingFields).toHaveLength(0)
        expect(result.warnings).toHaveLength(0)
    })
})

describe('lightweight verification - duplicate detection', () => {
    const candidateId = new mongoose.Types.ObjectId()
    const now = new Date()

    const recentCandidate: DuplicateCandidate = {
        _id: candidateId,
        emergencyType: 'FLOOD',
        location: { latitude: 24.861, longitude: 67.011, address: 'Plot 12, Sector 4, Karachi' },
        reporterPhone: '+92 300 1234567',
        createdAt: new Date(now.getTime() - 15 * 60 * 1000), // 15 mins ago
        status: 'PENDING'
    }

    it('detects duplicate within distance threshold and time window for same emergency type', () => {
        const result = detectPotentialDuplicates(completeInput, [recentCandidate])
        expect(result.isPotentialDuplicate).toBe(true)
        expect(result.duplicateIds).toContain(String(candidateId))
        expect(result.duplicateReasons.some((r) => /Matches incident.*FLOOD.*ago within/i.test(r))).toBe(true)
    })

    it('detects duplicate with identical reporter phone within time window', () => {
        const differentLocationCandidate: DuplicateCandidate = {
            ...recentCandidate,
            location: { latitude: 25.0, longitude: 67.5 } // far away
        }
        const result = detectPotentialDuplicates(completeInput, [differentLocationCandidate])
        expect(result.isPotentialDuplicate).toBe(true)
        expect(result.duplicateReasons.some((r) => /identical reporter phone/i.test(r))).toBe(true)
    })

    it('detects duplicate with identical address within time window', () => {
        const noCoordsCandidate: DuplicateCandidate = {
            ...recentCandidate,
            location: { latitude: 0, longitude: 0, address: 'Plot 12, Sector 4, Karachi' },
            reporterPhone: '+92 300 9999999'
        }
        const inputWithSameAddress: IncidentInput = {
            ...completeInput,
            reporterPhone: '+92 300 1111111',
            location: { latitude: 10, longitude: 10, address: 'Plot 12, Sector 4, Karachi' }
        }
        const result = detectPotentialDuplicates(inputWithSameAddress, [noCoordsCandidate])
        expect(result.isPotentialDuplicate).toBe(true)
        expect(result.duplicateReasons.some((r) => /identical address/i.test(r))).toBe(true)
    })

    it('does not flag duplicate when emergency type differs', () => {
        const fireCandidate: DuplicateCandidate = {
            ...recentCandidate,
            emergencyType: 'FIRE',
            reporterPhone: '+92 300 0000000',
            location: { latitude: 24.86, longitude: 67.01, address: 'Different' }
        }
        const result = detectPotentialDuplicates(completeInput, [fireCandidate])
        expect(result.isPotentialDuplicate).toBe(false)
        expect(result.duplicateIds).toHaveLength(0)
    })

    it('does not flag duplicate when outside the time window (e.g. 5 hours ago)', () => {
        const oldCandidate: DuplicateCandidate = {
            ...recentCandidate,
            createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000)
        }
        const result = detectPotentialDuplicates(completeInput, [oldCandidate], { windowMinutes: 120 })
        expect(result.isPotentialDuplicate).toBe(false)
    })

    it('does not flag duplicate when location is far apart (e.g. 10km)', () => {
        const farCandidate: DuplicateCandidate = {
            ...recentCandidate,
            location: { latitude: 24.95, longitude: 67.15 },
            reporterPhone: '+92 300 0000000'
        }
        const result = detectPotentialDuplicates(completeInput, [farCandidate], { distanceThresholdKm: 0.5 })
        expect(result.isPotentialDuplicate).toBe(false)
    })

    it('does not compare simulated and non-simulated incidents during duplicate detection', () => {
        const simulatedCandidate: DuplicateCandidate = {
            ...recentCandidate,
            isSimulated: true
        }
        const nonSimulatedInput = { ...completeInput, isSimulated: false }
        const result = detectPotentialDuplicates(nonSimulatedInput, [simulatedCandidate])
        expect(result.isPotentialDuplicate).toBe(false)
        expect(result.duplicateIds).toHaveLength(0)

        const simulatedInput = { ...completeInput, isSimulated: true }
        const nonSimulatedCandidate: DuplicateCandidate = {
            ...recentCandidate,
            isSimulated: false
        }
        const result2 = detectPotentialDuplicates(simulatedInput, [nonSimulatedCandidate])
        expect(result2.isPotentialDuplicate).toBe(false)
        expect(result2.duplicateIds).toHaveLength(0)
    })
})

describe('lightweight verification - evaluation policy', () => {
    it('sets FLAGGED_DUPLICATE when potential duplicate is detected without discarding request', () => {
        const duplicateCheck = {
            isPotentialDuplicate: true,
            duplicateIds: ['some-id'],
            duplicateReasons: ['Possible duplicate near sector 4']
        }
        const evaluation = evaluateVerification(completeInput, duplicateCheck)
        expect(evaluation.status).toBe('FLAGGED_DUPLICATE')
        expect(evaluation.requiresManualReview).toBe(true)
        expect(evaluation.warnings).toContain('Possible duplicate near sector 4')
    })

    it('sets NEEDS_REVIEW when report is incomplete but not duplicate', () => {
        const incompleteInput = { ...completeInput, location: null }
        const duplicateCheck = { isPotentialDuplicate: false, duplicateIds: [], duplicateReasons: [] }
        const evaluation = evaluateVerification(incompleteInput, duplicateCheck)
        expect(evaluation.status).toBe('NEEDS_REVIEW')
        expect(evaluation.requiresManualReview).toBe(true)
        expect(evaluation.missingFields).toContain('location')
    })

    it('sets VERIFIED when report is complete and has no duplicates', () => {
        const duplicateCheck = { isPotentialDuplicate: false, duplicateIds: [], duplicateReasons: [] }
        const evaluation = evaluateVerification(completeInput, duplicateCheck)
        expect(evaluation.status).toBe('VERIFIED')
        expect(evaluation.requiresManualReview).toBe(false)
        expect(evaluation.warnings).toHaveLength(0)
    })
})

describe('coordinator verification updates', () => {
    const incidentId = new mongoose.Types.ObjectId()
    const coordinatorId = new mongoose.Types.ObjectId()

    beforeEach(() => {
        jest.spyOn(Incident, 'init').mockResolvedValue(new Incident())
        jest.spyOn(Team, 'init').mockResolvedValue(new Team())
        jest.spyOn(Assignment, 'init').mockResolvedValue(new Assignment())
        jest.spyOn(mongoose.connection, 'transaction').mockImplementation(async (work) => work({} as ClientSession))
    })

    afterEach(() => jest.restoreAllMocks())

    it('updates verification status to VERIFIED and clears requiresManualReview', async () => {
        const incident = new Incident({
            _id: incidentId,
            ...completeInput,
            locationVerificationRequired: false,
            priorityScore: 80,
            priorityLevel: 'CRITICAL',
            confidenceLevel: 'HIGH',
            priorityReasons: ['Immediate danger'],
            verification: {
                status: 'NEEDS_REVIEW',
                requiresManualReview: true,
                isPotentialDuplicate: false,
                potentialDuplicateIncidents: [],
                missingFields: ['waterLevel'],
                warnings: ['Water level is unknown']
            }
        })

        jest.spyOn(incident, 'save').mockResolvedValue(incident)
        jest.spyOn(Incident, 'findById').mockReturnValue({
            session: jest.fn().mockResolvedValue(incident)
        } as unknown as ReturnType<typeof Incident.findById>)

        const updated = await updateVerification(
            String(incidentId),
            'VERIFIED',
            'Confirmed water depth with citizen via telephone',
            String(coordinatorId)
        )

        expect(updated.verification.status).toBe('VERIFIED')
        expect(updated.verification.requiresManualReview).toBe(false)
        expect(updated.verification.reviewNotes).toBe('Confirmed water depth with citizen via telephone')
        expect(updated.verification.reviewedBy).toEqual(coordinatorId)
        expect(updated.verification.reviewedAt).toBeInstanceOf(Date)
        // Ensure incident lifecycle status is untouched
        expect(updated.status).toBe('PENDING')
        expect(updated.priorityLevel).toBe('CRITICAL')
    })

    it('allows dismissing a duplicate flag without merging or deleting either incident', async () => {
        const incident = new Incident({
            _id: incidentId,
            ...completeInput,
            locationVerificationRequired: false,
            priorityScore: 70,
            priorityLevel: 'HIGH',
            confidenceLevel: 'MEDIUM',
            priorityReasons: ['High water level'],
            verification: {
                status: 'FLAGGED_DUPLICATE',
                requiresManualReview: true,
                isPotentialDuplicate: true,
                potentialDuplicateIncidents: [new mongoose.Types.ObjectId()],
                missingFields: [],
                warnings: ['Matches nearby incident']
            }
        })

        jest.spyOn(incident, 'save').mockResolvedValue(incident)
        jest.spyOn(Incident, 'findById').mockReturnValue({
            session: jest.fn().mockResolvedValue(incident)
        } as unknown as ReturnType<typeof Incident.findById>)

        const updated = await updateVerification(
            String(incidentId),
            'DISMISSED',
            'Verified distinct house: neighbors confirmed 2 separate stranded families',
            String(coordinatorId)
        )

        expect(updated.verification.status).toBe('DISMISSED')
        expect(updated.verification.requiresManualReview).toBe(false)
        expect(updated.verification.reviewNotes).toContain('Verified distinct house')
        expect(updated.status).toBe('PENDING')
    })

    it('safely initializes verification fallback on older incidents without verification subdocument', async () => {
        const olderIncident = new Incident({
            _id: incidentId,
            ...completeInput,
            locationVerificationRequired: false,
            priorityScore: 50,
            priorityLevel: 'HIGH',
            confidenceLevel: 'MEDIUM',
            priorityReasons: ['High water level']
        })
        olderIncident.set('verification', undefined)

        jest.spyOn(olderIncident, 'save').mockResolvedValue(olderIncident)
        jest.spyOn(Incident, 'findById').mockReturnValue({
            session: jest.fn().mockResolvedValue(olderIncident)
        } as unknown as ReturnType<typeof Incident.findById>)

        const updated = await updateVerification(
            String(incidentId),
            'VERIFIED',
            'Backfilled and verified older incident record',
            String(coordinatorId)
        )

        expect(updated.verification).toBeDefined()
        expect(updated.verification.status).toBe('VERIFIED')
        expect(updated.verification.requiresManualReview).toBe(false)
        expect(updated.verification.reviewNotes).toBe('Backfilled and verified older incident record')
        expect(updated.verification.reviewedBy).toEqual(coordinatorId)
        expect(updated.verification.reviewedAt).toBeInstanceOf(Date)
        expect(updated.verification.isPotentialDuplicate).toBe(false)
        expect(updated.status).toBe('PENDING')
        expect(updated.priorityLevel).toBe('HIGH')
    })

    it('throws 404 when updating nonexistent incident', async () => {
        jest.spyOn(Incident, 'findById').mockReturnValue({
            session: jest.fn().mockResolvedValue(null)
        } as unknown as ReturnType<typeof Incident.findById>)

        await expect(updateVerification(String(incidentId), 'VERIFIED', 'Valid note', String(coordinatorId))).rejects.toThrow('Incident not found')
    })
})

describe('verification validation schemas', () => {
    it('validates correct verification update payload', () => {
        const payload = validate(verificationUpdateSchema, {
            status: 'VERIFIED',
            notes: 'Spoke with field team; address verified'
        })
        expect(payload).toEqual({
            status: 'VERIFIED',
            notes: 'Spoke with field team; address verified'
        })
    })

    it.each([
        { status: 'INVALID_STATUS', notes: 'Valid note here' },
        { status: 'VERIFIED', notes: 'ab' }, // too short (min 3)
        { status: 'VERIFIED' } // missing notes
    ])('rejects invalid verification payload %o', (invalidPayload) => {
        expect(() => validate(verificationUpdateSchema, invalidPayload)).toThrow()
    })

    it('accepts verificationStatus query parameter on incident list', () => {
        const query = validate(incidentQuerySchema, {
            verificationStatus: 'NEEDS_REVIEW',
            status: 'PENDING'
        })
        expect((query as { verificationStatus: string }).verificationStatus).toBe('NEEDS_REVIEW')
    })
})
