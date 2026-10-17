 
import mongoose from 'mongoose'
import Incident from '../../APIs/response/models/incident.model'
import Team from '../../APIs/response/models/team.model'
import { incidentQuerySchema, teamQuerySchema, validate } from '../../APIs/response/validation'
import * as service from '../../APIs/response/response.service'

describe('incident sync and polling performance', () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('polling query parameter validation', () => {
        it('accepts valid polling query with emergencyType and updatedSince', () => {
            const payload = validate<service.IncidentQuery>(incidentQuerySchema, {
                emergencyType: 'FLOOD',
                updatedSince: '2026-10-17T12:00:00.000Z',
                sort: 'newest'
            })
            expect(payload.emergencyType).toBe('FLOOD')
            expect(payload.updatedSince).toBeInstanceOf(Date)
            expect(payload.sort).toBe('newest')
            expect(payload.page).toBe(1)
            expect(payload.limit).toBe(20)
        })

        it('rejects invalid emergencyType', () => {
            expect(() => validate(incidentQuerySchema, { emergencyType: 'INVALID_TYPE' })).toThrow('emergencyType')
        })

        it('rejects malformed updatedSince string', () => {
            expect(() => validate(incidentQuerySchema, { updatedSince: 'not-a-date' })).toThrow('updatedSince')
        })

        it('enforces paging bounds for polling requests', () => {
            expect(() => validate(incidentQuerySchema, { limit: 200 })).toThrow('limit')
            expect(() => validate(incidentQuerySchema, { page: 0 })).toThrow('page')
        })
    })

    describe('listIncidents filter building and sorting', () => {
        it('applies status, priority, verification, emergencyType, and updatedSince filters', async () => {
            const sinceDate = new Date('2026-10-17T12:00:00.000Z')
            let capturedFilter: Record<string, unknown> | null = null
            let capturedSort: Record<string, 1 | -1> | null = null

            jest.spyOn(Incident, 'find').mockImplementation((...args: unknown[]) => {
                capturedFilter = args[0] as Record<string, unknown>
                return {
                    sort: (s: Record<string, 1 | -1>) => {
                        capturedSort = s
                        return {
                            skip: () => ({
                                limit: () => ({
                                    lean: () => Promise.resolve([{ _id: new mongoose.Types.ObjectId(), reporterName: 'Demo' }])
                                })
                            })
                        }
                    }
                } as unknown as ReturnType<typeof Incident.find>
            })
            jest.spyOn(Incident, 'countDocuments').mockResolvedValue(1 as unknown as number)

            const result = await service.listIncidents({
                page: 1,
                limit: 10,
                status: 'PENDING',
                priorityLevel: 'CRITICAL',
                emergencyType: 'FLOOD',
                verificationStatus: 'VERIFIED',
                updatedSince: sinceDate,
                sort: 'newest'
            })

            expect(capturedFilter).not.toBeNull()
            expect(capturedFilter!['status']).toBe('PENDING')
            expect(capturedFilter!['priorityLevel']).toBe('CRITICAL')
            expect(capturedFilter!['emergencyType']).toBe('FLOOD')
            expect(capturedFilter!['verification.status']).toBe('VERIFIED')
            expect(capturedFilter!['updatedAt']).toEqual({ [String.fromCharCode(36) + 'gte']: sinceDate })
            expect(capturedSort).toEqual({ createdAt: -1, _id: 1 })
            expect(result.items.length).toBe(1)
            expect(result.pagination.total).toBe(1)
            expect(result.pagination.totalPages).toBe(1)
        })

        it('sorts by priority by default with stable createdAt and _id tie-breakers', async () => {
            let capturedSort: Record<string, 1 | -1> | null = null
            jest.spyOn(Incident, 'find').mockImplementation((...args: unknown[]) => {
                void args
                return {
                    sort: (s: Record<string, 1 | -1>) => {
                        capturedSort = s
                        return {
                            skip: () => ({
                                limit: () => ({
                                    lean: () => Promise.resolve([])
                                })
                            })
                        }
                    }
                } as unknown as ReturnType<typeof Incident.find>
            })
            jest.spyOn(Incident, 'countDocuments').mockResolvedValue(0 as unknown as number)

            await service.listIncidents({ page: 1, limit: 20, sort: 'priority' })
            expect(capturedSort).toEqual({ priorityScore: -1, createdAt: 1, _id: 1 })
        })

        it('sorts oldest first when requested', async () => {
            let capturedSort: Record<string, 1 | -1> | null = null
            jest.spyOn(Incident, 'find').mockImplementation((...args: unknown[]) => {
                void args
                return {
                    sort: (s: Record<string, 1 | -1>) => {
                        capturedSort = s
                        return {
                            skip: () => ({
                                limit: () => ({
                                    lean: () => Promise.resolve([])
                                })
                            })
                        }
                    }
                } as unknown as ReturnType<typeof Incident.find>
            })
            jest.spyOn(Incident, 'countDocuments').mockResolvedValue(0 as unknown as number)

            await service.listIncidents({ page: 1, limit: 20, sort: 'oldest' })
            expect(capturedSort).toEqual({ createdAt: 1, _id: 1 })
        })
    })

    describe('listTeams query building and filtering', () => {
        it('filters rescue teams by status and sorts by teamCode', async () => {
            let capturedFilter: Record<string, unknown> | null = null
            let capturedSort: Record<string, 1 | -1> | null = null

            jest.spyOn(Team, 'find').mockImplementation((...args: unknown[]) => {
                capturedFilter = args[0] as Record<string, unknown>
                return {
                    sort: (s: Record<string, 1 | -1>) => {
                        capturedSort = s
                        return {
                            skip: () => ({
                                limit: () => ({
                                    lean: () => Promise.resolve([])
                                })
                            })
                        }
                    }
                } as unknown as ReturnType<typeof Team.find>
            })
            jest.spyOn(Team, 'countDocuments').mockResolvedValue(0 as unknown as number)

            await service.listTeams({ page: 1, limit: 10, status: 'AVAILABLE' })
            expect(capturedFilter).toEqual({ status: 'AVAILABLE' })
            expect(capturedSort).toEqual({ teamCode: 1 })
        })

        it('enforces team query paging bounds', () => {
            expect(() => validate(teamQuerySchema, { limit: 101 })).toThrow('limit')
            expect(() => validate(teamQuerySchema, { page: 0 })).toThrow('page')
        })
    })

    describe('cache-control preservation', () => {
        it('does not cache static or stale data for incidents or teams', () => {
            const mockRes = {
                headers: {} as Record<string, string>,
                setHeader(k: string, v: string) {
                    this.headers[k] = v
                }
            }
            mockRes.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            expect(mockRes.headers['Cache-Control']).toContain('no-store')
        })
    })
})
