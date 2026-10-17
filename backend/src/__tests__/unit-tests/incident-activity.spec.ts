/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
jest.mock('../../handlers/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }))
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../../app'
import config from '../../config/config'
import jwt from '../../utils/jwt'
import userRepo from '../../APIs/user/_shared/repo/user.repository'
import Incident from '../../APIs/response/models/incident.model'
import Team from '../../APIs/response/models/team.model'
import Assignment from '../../APIs/response/models/assignment.model'
import { EUserRoles } from '../../constant/users'
import { buildActivityTimeline, getIncidentActivity, getDashboardActivity } from '../../APIs/response/dashboard.service'
import { changeStatus } from '../../APIs/response/response.service'

describe('Incident Activity Timeline & Audit History', () => {
    const validIncidentId = new mongoose.Types.ObjectId().toString()
    const validCoordinatorId = new mongoose.Types.ObjectId().toString()
    const validTeamId = new mongoose.Types.ObjectId().toString()
    const validAssignmentId = new mongoose.Types.ObjectId().toString()

    describe('buildActivityTimeline unit tests', () => {
        it('synthesizes all genuine operational events in chronological order', () => {
            const incident = {
                _id: validIncidentId,
                reporterName: 'Fatima',
                emergencyType: 'FLOOD',
                priorityLevel: 'CRITICAL',
                status: 'RESOLVED',
                peopleAffected: 5,
                createdAt: '2026-10-17T08:00:00.000Z',
                priorityOverrides: [
                    {
                        previousPriority: 'HIGH',
                        newPriority: 'CRITICAL',
                        previousScore: 60,
                        newScore: 85,
                        reason: 'Rapidly rising water near school',
                        coordinatorId: validCoordinatorId,
                        timestamp: '2026-10-17T08:15:00.000Z'
                    }
                ],
                verification: {
                    status: 'VERIFIED',
                    requiresManualReview: false,
                    reviewedBy: validCoordinatorId,
                    reviewedAt: '2026-10-17T08:20:00.000Z',
                    reviewNotes: 'Confirmed via local community focal point'
                },
                statusHistory: [
                    {
                        previousStatus: 'PENDING',
                        newStatus: 'ASSIGNED',
                        changedBy: validCoordinatorId,
                        timestamp: '2026-10-17T08:30:00.000Z',
                        notes: 'Assigned to rescue team'
                    },
                    {
                        previousStatus: 'ASSIGNED',
                        newStatus: 'IN_PROGRESS',
                        changedBy: validCoordinatorId,
                        timestamp: '2026-10-17T08:45:00.000Z',
                        notes: 'Team en route'
                    },
                    {
                        previousStatus: 'IN_PROGRESS',
                        newStatus: 'RESOLVED',
                        changedBy: validCoordinatorId,
                        timestamp: '2026-10-17T09:30:00.000Z',
                        notes: 'All 5 individuals safely evacuated to shelter'
                    }
                ]
            }

            const assignments = [
                {
                    _id: validAssignmentId,
                    incidentId: { _id: validIncidentId, emergencyType: 'FLOOD' },
                    teamId: { _id: validTeamId, teamCode: 'BOAT-SINDH-01', name: 'Sukkur Water Rescue' },
                    assignedAt: '2026-10-17T08:30:00.000Z',
                    completedAt: '2026-10-17T09:30:00.000Z',
                    status: 'COMPLETED',
                    notes: 'Rescue mission completed'
                }
            ]

            // Descending order (default)
            const timelineDesc = buildActivityTimeline([incident as any], assignments as any, 50, 'desc')
            expect(timelineDesc).toHaveLength(8)

            // Verify descending timestamps
            for (let i = 0; i < timelineDesc.length - 1; i++) {
                expect(timelineDesc[i].timestamp.getTime()).toBeGreaterThanOrEqual(timelineDesc[i + 1].timestamp.getTime())
            }

            // Check events present
            const types = timelineDesc.map((e) => e.type)
            expect(types).toContain('INCIDENT_REPORTED')
            expect(types).toContain('PRIORITY_OVERRIDE')
            expect(types).toContain('VERIFICATION_REVIEWED')
            expect(types).toContain('TEAM_ASSIGNED')
            expect(types).toContain('STATUS_CHANGED')
            expect(types).toContain('INCIDENT_RESOLVED')
            expect(types).toContain('ASSIGNMENT_COMPLETED')

            // Check verification event details
            const verEvent = timelineDesc.find((e) => e.type === 'VERIFICATION_REVIEWED')
            expect(verEvent?.actor?.id).toBe(validCoordinatorId)
            expect(verEvent?.metadata.verificationStatus).toBe('VERIFIED')
            expect(verEvent?.metadata.reviewNotes).toBe('Confirmed via local community focal point')

            // Check resolved event details
            const resEvent = timelineDesc.find((e) => e.type === 'INCIDENT_RESOLVED')
            expect(resEvent?.actor?.id).toBe(validCoordinatorId)
            expect(resEvent?.metadata.newStatus).toBe('RESOLVED')

            // Check override event details
            const ovEvent = timelineDesc.find((e) => e.type === 'PRIORITY_OVERRIDE')
            expect(ovEvent?.actor?.id).toBe(validCoordinatorId)
            expect(ovEvent?.metadata.previousPriority).toBe('HIGH')
            expect(ovEvent?.metadata.newPriority).toBe('CRITICAL')

            // Ascending order
            const timelineAsc = buildActivityTimeline([incident as any], assignments as any, 50, 'asc')
            expect(timelineAsc).toHaveLength(8)
            expect(timelineAsc[0].type).toBe('INCIDENT_REPORTED')
            for (let i = 0; i < timelineAsc.length - 1; i++) {
                expect(timelineAsc[i].timestamp.getTime()).toBeLessThanOrEqual(timelineAsc[i + 1].timestamp.getTime())
            }
        })

        it('handles older legacy incidents without verification or statusHistory safely', () => {
            const legacyIncident = {
                _id: validIncidentId,
                reporterName: 'Old Record',
                emergencyType: 'MEDICAL',
                status: 'PENDING',
                priorityLevel: 'MEDIUM',
                createdAt: '2026-10-15T10:00:00.000Z'
                // No statusHistory, no verification, no priorityOverrides
            }

            const timeline = buildActivityTimeline([legacyIncident as any], [], 20)
            expect(timeline).toHaveLength(1)
            expect(timeline[0].type).toBe('INCIDENT_REPORTED')
            expect(timeline[0].title).toMatch(/SOS Reported: MEDICAL/)
            expect(timeline[0].metadata.incidentId).toBe(validIncidentId)
        })

        it('handles unreviewed verification with null reviewedAt without emitting event', () => {
            const incident = {
                _id: validIncidentId,
                createdAt: '2026-10-17T10:00:00.000Z',
                verification: {
                    status: 'PENDING_REVIEW',
                    requiresManualReview: true,
                    reviewedBy: null,
                    reviewedAt: null,
                    reviewNotes: null
                }
            }

            const timeline = buildActivityTimeline([incident as any], [], 10)
            expect(timeline).toHaveLength(1)
            expect(timeline[0].type).toBe('INCIDENT_REPORTED')
        })

        it('provides stable deterministic tie-breaking on identical timestamps', () => {
            const sameTime = '2026-10-17T12:00:00.000Z'
            const incident = {
                _id: validIncidentId,
                createdAt: sameTime,
                priorityOverrides: [
                    {
                        newPriority: 'HIGH',
                        timestamp: sameTime,
                        reason: 'Override 1'
                    }
                ]
            }

            const timeline1 = buildActivityTimeline([incident as any], [], 10, 'asc')
            const timeline2 = buildActivityTimeline([incident as any], [], 10, 'asc')
            expect(timeline1.map((e) => e.id)).toEqual(timeline2.map((e) => e.id))
        })
    })

    describe('getIncidentActivity service', () => {
        afterEach(() => jest.restoreAllMocks())

        it('throws 404 CustomError when incident is not found', async () => {
            const mockFindById = {
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(null)
            }
            jest.spyOn(Incident, 'findById').mockReturnValue(mockFindById as any)

            await expect(getIncidentActivity(validIncidentId)).rejects.toThrow('Incident not found')
        })

        it('returns incident timeline with assignment history', async () => {
            const mockIncident = {
                _id: validIncidentId,
                reporterName: 'Tariq',
                emergencyType: 'FLOOD',
                priorityLevel: 'HIGH',
                status: 'ASSIGNED',
                createdAt: '2026-10-17T09:00:00.000Z',
                statusHistory: [
                    {
                        previousStatus: 'PENDING',
                        newStatus: 'ASSIGNED',
                        changedBy: validCoordinatorId,
                        timestamp: '2026-10-17T09:15:00.000Z',
                        notes: 'Dispatched team'
                    }
                ]
            }
            const mockAssignments = [
                {
                    _id: validAssignmentId,
                    incidentId: validIncidentId,
                    teamId: { _id: validTeamId, teamCode: 'RESCUE-1' },
                    assignedAt: '2026-10-17T09:15:00.000Z',
                    status: 'ACTIVE'
                }
            ]

            const mockFindById = {
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockIncident)
            }
            jest.spyOn(Incident, 'findById').mockReturnValue(mockFindById as any)

            const mockFindAssignment = {
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockAssignments)
            }
            jest.spyOn(Assignment, 'find').mockReturnValue(mockFindAssignment as any)

            const result = await getIncidentActivity(validIncidentId, { sort: 'desc', limit: 10 })
            expect(result.incidentId).toBe(validIncidentId)
            expect(result.total).toBe(3)
            expect(result.items.map((i) => i.type)).toEqual(
                expect.arrayContaining(['INCIDENT_REPORTED', 'STATUS_CHANGED', 'TEAM_ASSIGNED'])
            )
        })
    })

    describe('getDashboardActivity with incidentId filter', () => {
        afterEach(() => jest.restoreAllMocks())

        it('filters incidents and assignments by incidentId when provided', async () => {
            const mockIncidents = [
                {
                    _id: validIncidentId,
                    reporterName: 'Ahmed',
                    emergencyType: 'FIRE',
                    createdAt: '2026-10-17T11:00:00.000Z'
                }
            ]

            const mockIncidentQuery = {
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockIncidents)
            }
            const mockAssignmentQuery = {
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            }

            const incidentFindSpy = jest.spyOn(Incident, 'find').mockReturnValue(mockIncidentQuery as any)
            const assignmentFindSpy = jest.spyOn(Assignment, 'find').mockReturnValue(mockAssignmentQuery as any)

            const result = await getDashboardActivity({ incidentId: validIncidentId, limit: 10 })
            expect(result.total).toBe(1)
            expect(incidentFindSpy).toHaveBeenCalledWith(expect.objectContaining({ _id: validIncidentId }))
            expect(assignmentFindSpy).toHaveBeenCalledWith(expect.objectContaining({ incidentId: validIncidentId }))
        })
    })

    describe('changeStatus transactional statusHistory recording', () => {
        beforeEach(() => {
            jest.spyOn(Incident, 'init').mockResolvedValue(new Incident())
            jest.spyOn(Team, 'init').mockResolvedValue(new Team())
            jest.spyOn(Assignment, 'init').mockResolvedValue(new Assignment())
            jest.spyOn(mongoose.connection, 'transaction').mockImplementation(async (work) => work({} as any))
        })
        afterEach(() => jest.restoreAllMocks())

        it('appends a status history transition when status changes', async () => {
            const mockIncidentDoc: any = {
                _id: validIncidentId,
                status: 'PENDING',
                statusHistory: [],
                save: jest.fn().mockResolvedValue(true)
            }

            const mockFindById = {
                session: jest.fn().mockResolvedValue(mockIncidentDoc)
            }
            jest.spyOn(Incident, 'findById').mockReturnValue(mockFindById as any)

            const updated = await changeStatus(validIncidentId, 'CANCELLED', validCoordinatorId)
            expect(updated.status).toBe('CANCELLED')
            expect(mockIncidentDoc.statusHistory).toHaveLength(1)
            expect(mockIncidentDoc.statusHistory[0].previousStatus).toBe('PENDING')
            expect(mockIncidentDoc.statusHistory[0].newStatus).toBe('CANCELLED')
            expect(String(mockIncidentDoc.statusHistory[0].changedBy)).toBe(validCoordinatorId)
            expect(mockIncidentDoc.save).toHaveBeenCalled()
        })
    })

    describe('GET /api/incidents/:id/activity HTTP endpoint & RBAC', () => {
        const adminId = new mongoose.Types.ObjectId().toString()
        const regularUserId = new mongoose.Types.ObjectId().toString()
        config.TOKENS.ACCESS.SECRET = 'test-secret-key-32-bytes-minimum-length-needed'

        const adminToken = jwt.generateToken({ userId: adminId }, config.TOKENS.ACCESS.SECRET, 3600)
        const userToken = jwt.generateToken({ userId: regularUserId }, config.TOKENS.ACCESS.SECRET, 3600)

        afterEach(() => jest.restoreAllMocks())

        it('rejects unauthenticated requests with 401', async () => {
            const res = await request(app).get(`/api/incidents/${validIncidentId}/activity`)
            expect(res.status).toBe(401)
            expect(res.body.success).toBe(false)
        })

        it('rejects non-coordinator (regular user) requests with 403', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: regularUserId,
                role: EUserRoles.USER
            } as any)

            const res = await request(app)
                .get(`/api/incidents/${validIncidentId}/activity`)
                .set('Cookie', [`accessToken=${userToken}`])

            expect(res.status).toBe(403)
            expect(res.body.message).toMatch(/Coordinator \(admin\) access required/)
        })

        it('rejects malformed incident IDs with 400', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)

            const res = await request(app)
                .get('/api/incidents/not-a-valid-24-hex-id/activity')
                .set('Cookie', [`accessToken=${adminToken}`])

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('returns 404 when incident does not exist', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)

            const mockFindById = {
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(null)
            }
            jest.spyOn(Incident, 'findById').mockReturnValue(mockFindById as any)

            const res = await request(app)
                .get(`/api/incidents/${validIncidentId}/activity`)
                .set('Cookie', [`accessToken=${adminToken}`])

            expect(res.status).toBe(404)
            expect(res.body.message).toMatch(/Incident not found/)
        })

        it('returns 200 with chronological activity items for authorized coordinators', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)

            const mockIncident = {
                _id: validIncidentId,
                reporterName: 'Saima',
                emergencyType: 'FLOOD',
                priorityLevel: 'CRITICAL',
                status: 'RESOLVED',
                createdAt: '2026-10-17T07:00:00.000Z',
                statusHistory: [
                    {
                        previousStatus: 'PENDING',
                        newStatus: 'RESOLVED',
                        changedBy: adminId,
                        timestamp: '2026-10-17T08:00:00.000Z',
                        notes: 'Rescue successful'
                    }
                ]
            }

            const mockFindById = {
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockIncident)
            }
            jest.spyOn(Incident, 'findById').mockReturnValue(mockFindById as any)

            const mockFindAssignment = {
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            }
            jest.spyOn(Assignment, 'find').mockReturnValue(mockFindAssignment as any)

            const res = await request(app)
                .get(`/api/incidents/${validIncidentId}/activity?sort=asc&limit=10`)
                .set('Cookie', [`accessToken=${adminToken}`])

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.incidentId).toBe(validIncidentId)
            expect(res.body.data.total).toBe(2)
            expect(res.body.data.items[0].type).toBe('INCIDENT_REPORTED')
            expect(res.body.data.items[1].type).toBe('INCIDENT_RESOLVED')
        })
    })
})
