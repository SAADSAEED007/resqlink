/* Jest matchers inspect mock methods without invoking their receiver. */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
jest.mock('../../handlers/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }))
import mongoose from 'mongoose'
import request from 'supertest'
import Assignment from '../../APIs/response/models/assignment.model'
import { listAssignments, getAssignment } from '../../APIs/response/response.service'
import { assignmentQuerySchema, validate } from '../../APIs/response/validation'
import app from '../../app'
import config from '../../config/config'
import jwt from '../../utils/jwt'
import userRepo from '../../APIs/user/_shared/repo/user.repository'
import { CustomError } from '../../utils/errors'
import { EUserRoles } from '../../constant/users'

describe('Assignment Management and Operational History APIs', () => {
    const mockAssignmentId = new mongoose.Types.ObjectId()
    const mockIncidentId = new mongoose.Types.ObjectId()
    const mockTeamId = new mongoose.Types.ObjectId()

    function createMockAssignmentDoc(overrides: Record<string, any> = {}) {
        return {
            _id: mockAssignmentId,
            incidentId: {
                _id: mockIncidentId,
                emergencyType: 'FLOOD',
                priorityLevel: 'CRITICAL',
                status: 'ASSIGNED',
                location: { latitude: 24.86, longitude: 67.01, address: 'Test Location' },
                reporterName: 'Test Citizen',
                peopleAffected: 5,
                createdAt: new Date('2026-10-17T10:00:00.000Z')
            },
            teamId: {
                _id: mockTeamId,
                name: 'Alpha Boat Team',
                teamCode: 'ALPHA-01',
                capabilities: ['WATER_RESCUE', 'EVACUATION'],
                status: 'BUSY',
                capacity: 8,
                location: { latitude: 24.85, longitude: 67.02 }
            },
            status: 'ACTIVE',
            assignedAt: new Date('2026-10-17T10:30:00.000Z'),
            completedAt: null,
            notes: 'Immediate boat evacuation required',
            isSimulated: false,
            createdAt: new Date('2026-10-17T10:30:00.000Z'),
            updatedAt: new Date('2026-10-17T10:30:00.000Z'),
            ...overrides
        }
    }

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('Validation Schema (assignmentQuerySchema)', () => {
        it('accepts valid query parameters and sets defaults', () => {
            const parsed = validate<any>(assignmentQuerySchema, {})
            expect(parsed.page).toBe(1)
            expect(parsed.limit).toBe(20)
            expect(parsed.status).toBeUndefined()
        })

        it('validates status filter for ACTIVE, COMPLETED, CANCELLED', () => {
            expect(validate<any>(assignmentQuerySchema, { status: 'ACTIVE' }).status).toBe('ACTIVE')
            expect(validate<any>(assignmentQuerySchema, { status: 'COMPLETED' }).status).toBe('COMPLETED')
            expect(validate<any>(assignmentQuerySchema, { status: 'CANCELLED' }).status).toBe('CANCELLED')
        })

        it('rejects invalid status filter', () => {
            expect(() => validate(assignmentQuerySchema, { status: 'PENDING' })).toThrow(CustomError)
        })

        it('validates incidentId, teamId, and isSimulated', () => {
            const valid = validate<any>(assignmentQuerySchema, {
                incidentId: mockIncidentId.toHexString(),
                teamId: mockTeamId.toHexString(),
                isSimulated: false
            })
            expect(valid.incidentId).toBe(mockIncidentId.toHexString())
            expect(valid.teamId).toBe(mockTeamId.toHexString())
            expect(valid.isSimulated).toBe(false)
        })

        it('rejects malformed incidentId or teamId', () => {
            expect(() => validate(assignmentQuerySchema, { incidentId: 'invalid-id' })).toThrow(CustomError)
            expect(() => validate(assignmentQuerySchema, { teamId: 'not-hex' })).toThrow(CustomError)
        })
    })

    describe('Service Logic (listAssignments)', () => {
        it('queries assignments with populate, sorting, and pagination', async () => {
            const mockItems = [createMockAssignmentDoc()]
            const queryChain: any = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockItems)
            }
            jest.spyOn(Assignment, 'find').mockReturnValue(queryChain)
            jest.spyOn(Assignment, 'countDocuments').mockResolvedValue(1 as any)

            const result = await listAssignments({ page: 1, limit: 10, status: 'ACTIVE' })
            expect(Assignment.find).toHaveBeenCalledWith({ status: 'ACTIVE' })
            expect(queryChain.populate).toHaveBeenCalledTimes(2)
            expect(queryChain.sort).toHaveBeenCalledWith({ assignedAt: -1, _id: 1 })
            expect(queryChain.skip).toHaveBeenCalledWith(0)
            expect(queryChain.limit).toHaveBeenCalledWith(10)
            expect(result.items).toHaveLength(1)
            expect(result.pagination.total).toBe(1)
        })

        it('filters by incidentId, teamId, and isSimulated', async () => {
            const queryChain: any = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            }
            jest.spyOn(Assignment, 'find').mockReturnValue(queryChain)
            jest.spyOn(Assignment, 'countDocuments').mockResolvedValue(0 as any)

            await listAssignments({
                page: 1,
                limit: 20,
                incidentId: mockIncidentId.toHexString(),
                teamId: mockTeamId.toHexString(),
                isSimulated: true
            })
            expect(Assignment.find).toHaveBeenCalledWith({
                incidentId: mockIncidentId.toHexString(),
                teamId: mockTeamId.toHexString(),
                isSimulated: true
            })
        })

        it('handles empty database returns safely', async () => {
            const queryChain: any = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            }
            jest.spyOn(Assignment, 'find').mockReturnValue(queryChain)
            jest.spyOn(Assignment, 'countDocuments').mockResolvedValue(0 as any)

            const result = await listAssignments({ page: 1, limit: 20 })
            expect(result.items).toEqual([])
            expect(result.pagination.total).toBe(0)
        })
    })

    describe('Service Logic (getAssignment)', () => {
        it('returns populated assignment by id', async () => {
            const mockDoc = createMockAssignmentDoc()
            const queryChain: any = {
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockDoc)
            }
            jest.spyOn(Assignment, 'findById').mockReturnValue(queryChain)

            const result = await getAssignment(mockAssignmentId.toHexString())
            expect(Assignment.findById).toHaveBeenCalledWith(mockAssignmentId.toHexString())
            expect(queryChain.populate).toHaveBeenCalledTimes(2)
            expect(result._id).toBe(mockAssignmentId)
            expect((result.incidentId as any).emergencyType).toBe('FLOOD')
            expect((result.teamId as any).teamCode).toBe('ALPHA-01')
        })

        it('throws 404 when assignment is not found', async () => {
            const queryChain: any = {
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(null)
            }
            jest.spyOn(Assignment, 'findById').mockReturnValue(queryChain)

            await expect(getAssignment(mockAssignmentId.toHexString())).rejects.toMatchObject({
                statusCode: 404,
                message: 'Assignment not found'
            })
        })
    })

    describe('Coordinator Route Access and Security', () => {
        const adminId = '67b0965d1b32d20b7a2d8888'
        const userId = '67b0965d1b32d20b7a2d9999'
        config.TOKENS.ACCESS.SECRET = 'test-secret-key-32-bytes-minimum-length-needed'
        const adminToken = jwt.generateToken({ userId: adminId }, config.TOKENS.ACCESS.SECRET, 3600)
        const userToken = jwt.generateToken({ userId: userId }, config.TOKENS.ACCESS.SECRET, 3600)

        it('rejects unauthenticated requests to /api/assignments with 401', async () => {
            const res = await request(app).get('/api/assignments')
            expect(res.status).toBe(401)
        })

        it('rejects non-coordinator (citizen/user) with 403 Forbidden', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: userId,
                role: EUserRoles.USER
            } as any)

            const res = await request(app)
                .get('/api/assignments')
                .set('Cookie', ['accessToken=' + userToken])

            expect(res.status).toBe(403)
            expect(res.body.message).toMatch(/Coordinator \(admin\) access required/)
        })

        it('returns 200 with populated items and pagination for coordinator', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)

            const mockDoc = createMockAssignmentDoc()
            const queryChain: any = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([mockDoc])
            }
            jest.spyOn(Assignment, 'find').mockReturnValue(queryChain)
            jest.spyOn(Assignment, 'countDocuments').mockResolvedValue(1 as any)

            const res = await request(app)
                .get('/api/assignments?status=ACTIVE')
                .set('Cookie', ['accessToken=' + adminToken])

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.items).toHaveLength(1)
            expect(res.body.data.items[0].incidentId.emergencyType).toBe('FLOOD')
            expect(res.body.data.items[0].teamId.teamCode).toBe('ALPHA-01')
            expect(res.body.data.pagination.total).toBe(1)
        })

        it('GET /api/assignments/:id rejects unauthenticated request with 401', async () => {
            const res = await request(app).get('/api/assignments/' + mockAssignmentId.toHexString())
            expect(res.status).toBe(401)
        })

        it('GET /api/assignments/:id rejects invalid 24-hex ID with 400', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)

            const res = await request(app)
                .get('/api/assignments/not-a-valid-hex-id')
                .set('Cookie', ['accessToken=' + adminToken])

            expect(res.status).toBe(400)
        })

        it('GET /api/assignments/:id returns 404 when record does not exist', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)

            const queryChain: any = {
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(null)
            }
            jest.spyOn(Assignment, 'findById').mockReturnValue(queryChain)

            const res = await request(app)
                .get('/api/assignments/' + mockAssignmentId.toHexString())
                .set('Cookie', ['accessToken=' + adminToken])

            expect(res.status).toBe(404)
            expect(res.body.message).toBe('Assignment not found')
        })

        it('GET /api/assignments/:id returns 200 with full details for coordinator', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)

            const mockDoc = createMockAssignmentDoc()
            const queryChain: any = {
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockDoc)
            }
            jest.spyOn(Assignment, 'findById').mockReturnValue(queryChain)

            const res = await request(app)
                .get('/api/assignments/' + mockAssignmentId.toHexString())
                .set('Cookie', ['accessToken=' + adminToken])

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.status).toBe('ACTIVE')
            expect(res.body.data.incidentId.emergencyType).toBe('FLOOD')
            expect(res.body.data.teamId.teamCode).toBe('ALPHA-01')
        })
    })
})
