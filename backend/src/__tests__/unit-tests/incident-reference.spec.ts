import mongoose from 'mongoose'
import Incident from '../../APIs/response/models/incident.model'
import Counter from '../../APIs/response/models/counter.model'
import {
    formatReportReference,
    formatReportReferenceFallback,
    initializeCounterIfNeeded,
    getNextReportReference,
    createIncident,
    getIncident,
    listIncidents
} from '../../APIs/response/response.service'
import { IncidentInput } from '../../APIs/response/types'

describe('User-Friendly SOS Report Reference Number (RESQ-XXXXXX)', () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('Reference formatting rules', () => {
        it('formats sequential numbers with RESQ- prefix and minimum 6-digit zero padding', () => {
            expect(formatReportReference(1)).toBe('RESQ-000001')
            expect(formatReportReference(2)).toBe('RESQ-000002')
            expect(formatReportReference(3)).toBe('RESQ-000003')
            expect(formatReportReference(123)).toBe('RESQ-000123')
            expect(formatReportReference(999999)).toBe('RESQ-999999')
        })

        it('allows numeric portion to grow beyond six digits naturally', () => {
            expect(formatReportReference(1000000)).toBe('RESQ-1000000')
            expect(formatReportReference(12345678)).toBe('RESQ-12345678')
        })

        it('provides safe compatibility fallback for legacy records without exposing raw database IDs', () => {
            const legacyObjectId = '6ad4be5712078cdf7ae6dc0f'
            const fallback = formatReportReferenceFallback(legacyObjectId)
            expect(fallback).toBe('RESQ-E6DC0F')
            expect(fallback).toMatch(/^RESQ-[A-Z0-9]{6}$/)
            expect(fallback).not.toBe(legacyObjectId)
        })

        it('handles null or undefined id gracefully in fallback', () => {
            expect(formatReportReferenceFallback(null)).toBe('RESQ-000000')
            expect(formatReportReferenceFallback('')).toBe('RESQ-000000')
        })
    })

    describe('Counter initialization and generation', () => {
        it('does not re-initialize if incident_reference counter already exists', async () => {
            jest.spyOn(Counter, 'findById').mockResolvedValue({ _id: 'incident_reference', seq: 55 } as any)
            const updateSpy = jest.spyOn(Counter, 'updateOne')

            await initializeCounterIfNeeded()
            expect(updateSpy).not.toHaveBeenCalled()
        })

        it('initializes counter from the highest existing reference when counter document is missing', async () => {
            jest.spyOn(Counter, 'findById').mockResolvedValue(null)
            jest.spyOn(Incident, 'find').mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue([
                        { reportReference: 'RESQ-000005' },
                        { reportReference: 'RESQ-000042' },
                        { reportReference: 'RESQ-000017' }
                    ])
                })
            } as any)
            const updateSpy = jest.spyOn(Counter, 'updateOne').mockResolvedValue({} as any)

            await initializeCounterIfNeeded()
            expect(updateSpy).toHaveBeenCalledWith(
                { _id: 'incident_reference' },
                { $setOnInsert: { seq: 42 } },
                { upsert: true }
            )
        })

        it('initializes counter to 0 if no incidents exist yet', async () => {
            jest.spyOn(Counter, 'findById').mockResolvedValue(null)
            jest.spyOn(Incident, 'find').mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue([])
                })
            } as any)
            const updateSpy = jest.spyOn(Counter, 'updateOne').mockResolvedValue({} as any)

            await initializeCounterIfNeeded()
            expect(updateSpy).toHaveBeenCalledWith(
                { _id: 'incident_reference' },
                { $setOnInsert: { seq: 0 } },
                { upsert: true }
            )
        })

        it('increments counter atomically using findOneAndUpdate with $inc', async () => {
            jest.spyOn(Counter, 'findById').mockResolvedValue({ _id: 'incident_reference', seq: 1 } as any)
            const findOneAndUpdateSpy = jest.spyOn(Counter, 'findOneAndUpdate').mockResolvedValue({
                _id: 'incident_reference',
                seq: 2
            } as any)

            const ref = await getNextReportReference()
            expect(ref).toBe('RESQ-000002')
            expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
                { _id: 'incident_reference' },
                { $inc: { seq: 1 } },
                expect.objectContaining({ new: true, upsert: true, setDefaultsOnInsert: true })
            )
        })
    })

    describe('Incident creation and reference assignment', () => {
        beforeEach(() => {
            jest.spyOn(Counter, 'findById').mockResolvedValue({ _id: 'incident_reference', seq: 1 } as any)
            jest.spyOn(Counter, 'findOneAndUpdate').mockResolvedValue({ _id: 'incident_reference', seq: 2 } as any)
            jest.spyOn(Incident, 'find').mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue([])
                })
            } as any)
        })

        it('assigns sequential reportReference to newly created incident while preserving _id as ObjectId', async () => {
            const rawObjectId = new mongoose.Types.ObjectId()
            const createSpy = jest.spyOn(Incident, 'create').mockImplementation(async (doc: any) => {
                return {
                    ...doc,
                    _id: rawObjectId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                } as any
            })

            const minimalInput: IncidentInput = {
                emergencyType: 'FLOOD',
                location: { latitude: 24.86, longitude: 67.01, address: 'Test Location' }
            }

            const incident = await createIncident(minimalInput)
            expect(incident.reportReference).toBe('RESQ-000002')
            expect(incident._id).toBe(rawObjectId)
            expect(createSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    reportReference: 'RESQ-000002',
                    emergencyType: 'FLOOD'
                })
            )
        })

        it('supports minimal SOS submission with optional reporter fields omitted', async () => {
            const rawObjectId = new mongoose.Types.ObjectId()
            jest.spyOn(Incident, 'create').mockImplementation(async (doc: any) => {
                return {
                    ...doc,
                    _id: rawObjectId,
                    createdAt: new Date()
                } as any
            })

            const minimalInput: IncidentInput = {
                emergencyType: 'MEDICAL'
            }

            const incident = await createIncident(minimalInput)
            expect(incident.reportReference).toBe('RESQ-000002')
            expect(incident.reporterName).toBeUndefined()
            expect(incident.reporterPhone).toBeUndefined()
            expect(incident.description).toBeUndefined()
        })

        it('retries when duplicate key error (11000) occurs on reportReference index', async () => {
            let attempt = 0
            jest.spyOn(Counter, 'findOneAndUpdate').mockImplementation((() => {
                attempt++
                return Promise.resolve({ _id: 'incident_reference', seq: attempt + 10 })
            }) as any)

            const duplicateError: any = new Error('E11000 duplicate key error')
            duplicateError.code = 11000
            duplicateError.keyPattern = { reportReference: 1 }

            const createSpy = jest.spyOn(Incident, 'create')
                .mockRejectedValueOnce(duplicateError)
                .mockResolvedValueOnce({
                    _id: new mongoose.Types.ObjectId(),
                    reportReference: 'RESQ-000012'
                } as any)

            const incident = await createIncident({ emergencyType: 'FIRE' })
            expect(incident.reportReference).toBe('RESQ-000012')
            expect(createSpy).toHaveBeenCalledTimes(2)
        })
    })

    describe('Retrieval and fallback behavior', () => {
        it('getIncident populates reportReference fallback if missing from legacy document', async () => {
            const fakeId = new mongoose.Types.ObjectId()
            const legacyDoc = {
                _id: fakeId,
                emergencyType: 'FLOOD',
                set: jest.fn(function (key, val) {
                    (this as any)[key] = val
                })
            }
            jest.spyOn(Incident, 'findById').mockResolvedValue(legacyDoc as any)

            const incident = await getIncident(String(fakeId))
            expect(incident.reportReference).toBe(formatReportReferenceFallback(fakeId))
        })

        it('listIncidents populates reportReference fallback for legacy documents and allows searching by reportReference', async () => {
            const fakeId = new mongoose.Types.ObjectId()
            const mockLean = jest.fn().mockResolvedValue([
                { _id: fakeId, emergencyType: 'FLOOD', reportReference: null }
            ])
            jest.spyOn(Incident, 'find').mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: mockLean
            } as any)
            jest.spyOn(Incident, 'countDocuments').mockResolvedValue(1)

            const result = await listIncidents({ page: 1, limit: 10, search: 'RESQ-', sort: 'newest' })
            expect(result.items[0].reportReference).toBe(formatReportReferenceFallback(fakeId))
            expect(Incident.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    $or: expect.arrayContaining([
                        expect.objectContaining({ reportReference: { $regex: 'RESQ-', $options: 'i' } })
                    ])
                })
            )
        })
    })

    describe('Incident schema validation for reportReference', () => {
        it('validates correct reportReference pattern', () => {
            const incident = new Incident({
                emergencyType: 'FLOOD',
                reportReference: 'RESQ-000001',
                priorityScore: 50,
                priorityLevel: 'MEDIUM',
                priorityReasons: ['Test'],
                confidenceLevel: 'HIGH',
                locationVerificationRequired: false,
                verification: { status: 'NEEDS_REVIEW', requiresManualReview: false, isPotentialDuplicate: false }
            })
            const err = incident.validateSync()
            expect(err).toBeUndefined()
        })

        it('rejects invalid reportReference patterns', () => {
            const incident = new Incident({
                emergencyType: 'FLOOD',
                reportReference: 'INVALID-123',
                priorityScore: 50,
                priorityLevel: 'MEDIUM',
                priorityReasons: ['Test'],
                confidenceLevel: 'HIGH',
                locationVerificationRequired: false,
                verification: { status: 'NEEDS_REVIEW', requiresManualReview: false, isPotentialDuplicate: false }
            })
            const err = incident.validateSync()
            expect(err?.errors?.reportReference).toBeDefined()
        })
    })
})
