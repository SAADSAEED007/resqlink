/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
jest.mock('../../handlers/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }))
import mongoose, { ClientSession } from 'mongoose'
import request from 'supertest'
import app from '../../app'
import config from '../../config/config'
import jwt from '../../utils/jwt'
import userRepo from '../../APIs/user/_shared/repo/user.repository'
import Notification from '../../APIs/response/models/notification.model'
import Incident from '../../APIs/response/models/incident.model'
import Team from '../../APIs/response/models/team.model'
import Assignment from '../../APIs/response/models/assignment.model'
import { EUserRoles } from '../../constant/users'
import {
    createNotification,
    listNotifications,
    getUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead
} from '../../APIs/response/notification.service'
import { assignTeam, changeStatus, createIncident } from '../../APIs/response/response.service'

describe('Coordinator Notification System Backend', () => {
    const adminId = new mongoose.Types.ObjectId().toString()
    const coordinatorBId = new mongoose.Types.ObjectId().toString()
    const citizenUserId = new mongoose.Types.ObjectId().toString()

    config.TOKENS.ACCESS.SECRET = 'test-secret-key-32-bytes-minimum-length-needed'
    const adminToken = jwt.generateToken({ userId: adminId }, config.TOKENS.ACCESS.SECRET, 3600)
    const citizenToken = jwt.generateToken({ userId: citizenUserId }, config.TOKENS.ACCESS.SECRET, 3600)

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('Notification Service Unit Tests', () => {
        it('safely handles creation errors without throwing', async () => {
            jest.spyOn(Notification, 'create').mockRejectedValue(new Error('MongoDB write error') as never)
            const result = await createNotification({
                type: 'INCIDENT_CREATED',
                severity: 'MEDIUM',
                title: 'Test',
                message: 'Test message'
            })
            expect(result).toBeNull()
        })

        it('lists notifications and computes isRead per requesting coordinator', async () => {
            const notif1 = {
                _id: new mongoose.Types.ObjectId(),
                type: 'CRITICAL_INCIDENT',
                severity: 'CRITICAL',
                title: 'Critical Flood',
                message: 'Immediate response required',
                incidentId: new mongoose.Types.ObjectId(),
                teamId: null,
                assignmentId: null,
                readBy: [
                    {
                        coordinatorId: new mongoose.Types.ObjectId(adminId),
                        readAt: new Date('2026-10-17T10:00:00.000Z')
                    }
                ],
                isSimulated: false,
                createdAt: new Date('2026-10-17T09:55:00.000Z')
            }

            const notif2 = {
                _id: new mongoose.Types.ObjectId(),
                type: 'INCIDENT_CREATED',
                severity: 'MEDIUM',
                title: 'Minor Fire',
                message: 'Reported',
                incidentId: new mongoose.Types.ObjectId(),
                teamId: null,
                assignmentId: null,
                readBy: [],
                isSimulated: false,
                createdAt: new Date('2026-10-17T10:05:00.000Z')
            }

            const mockQuery = {
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([notif2, notif1])
            }
            jest.spyOn(Notification, 'find').mockReturnValue(mockQuery as any)
            jest.spyOn(Notification, 'countDocuments').mockResolvedValue(2 as any)

            // Admin perspective
            const adminResult = await listNotifications(adminId, { page: 1, limit: 10 })
            expect(adminResult.items).toHaveLength(2)
            expect(adminResult.items[0].isRead).toBe(false)
            expect(adminResult.items[1].isRead).toBe(true)
            expect(adminResult.items[1].readAt).toEqual(new Date('2026-10-17T10:00:00.000Z'))

            // Coordinator B perspective (has not read either)
            const coordBResult = await listNotifications(coordinatorBId, { page: 1, limit: 10 })
            expect(coordBResult.items[0].isRead).toBe(false)
            expect(coordBResult.items[1].isRead).toBe(false)
        })

        it('counts unread notifications accurately for a specific coordinator', async () => {
            const countSpy = jest.spyOn(Notification, 'countDocuments').mockResolvedValue(5 as any)
            const result = await getUnreadCount(adminId, false)
            expect(result.unreadCount).toBe(5)
            expect(countSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    $or: [{ recipientId: null }, { recipientId: new mongoose.Types.ObjectId(adminId) }],
                    'readBy.coordinatorId': { $ne: new mongoose.Types.ObjectId(adminId) },
                    isSimulated: false
                })
            )
        })

        it('marks a single notification as read idempotently', async () => {
            const notifId = new mongoose.Types.ObjectId()
            const mockDoc: any = {
                _id: notifId,
                type: 'TEAM_ASSIGNED',
                severity: 'HIGH',
                title: 'Team Dispatched',
                message: 'Crew en route',
                readBy: [],
                createdAt: new Date(),
                save: jest.fn().mockResolvedValue(true),
                toObject: function () {
                    return this
                }
            }

            jest.spyOn(Notification, 'findById').mockResolvedValue(mockDoc)

            const result = await markNotificationAsRead(String(notifId), adminId)
            expect(result.isRead).toBe(true)
            expect(mockDoc.save).toHaveBeenCalledTimes(1)
            expect(mockDoc.readBy).toHaveLength(1)
            expect(String(mockDoc.readBy[0].coordinatorId)).toBe(adminId)

            // Call again: should be idempotent and not add duplicate receipt
            await markNotificationAsRead(String(notifId), adminId)
            expect(mockDoc.save).toHaveBeenCalledTimes(1) // Still 1, not called again
        })

        it('throws 404 when marking a nonexistent notification as read', async () => {
            jest.spyOn(Notification, 'findById').mockResolvedValue(null)
            await expect(markNotificationAsRead(String(new mongoose.Types.ObjectId()), adminId)).rejects.toThrow('Notification not found')
        })

        it('marks all unread notifications as read for the requesting coordinator in batch', async () => {
            const updateSpy = jest.spyOn(Notification, 'updateMany').mockResolvedValue({
                matchedCount: 3,
                modifiedCount: 3,
                acknowledged: true,
                upsertedId: null,
                upsertedCount: 0
            } as any)

            const result = await markAllNotificationsAsRead(adminId)
            expect(result.success).toBe(true)
            expect(result.updatedCount).toBe(3)
            expect(updateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    $or: [{ recipientId: null }, { recipientId: new mongoose.Types.ObjectId(adminId) }],
                    'readBy.coordinatorId': { $ne: new mongoose.Types.ObjectId(adminId) }
                }),
                expect.objectContaining({
                    $push: {
                        readBy: expect.objectContaining({
                            coordinatorId: new mongoose.Types.ObjectId(adminId)
                        })
                    }
                })
            )
        })
    })

    describe('Response Service Event Notification Hooks', () => {
        const incidentId = new mongoose.Types.ObjectId()
        const teamId = new mongoose.Types.ObjectId()
        const assignmentId = new mongoose.Types.ObjectId()

        beforeEach(() => {
            jest.spyOn(Incident, 'init').mockResolvedValue(new Incident())
            jest.spyOn(Team, 'init').mockResolvedValue(new Team())
            jest.spyOn(Assignment, 'init').mockResolvedValue(new Assignment())
            jest.spyOn(mongoose.connection, 'transaction').mockImplementation(async (work) => work({} as ClientSession))
        })

        it('emits CRITICAL_INCIDENT and review notification on critical incident creation', async () => {
            const notifCreateSpy = jest.spyOn(Notification, 'create').mockResolvedValue({} as any)
            jest.spyOn(Incident, 'find').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            } as any)

            const mockCreatedIncident = {
                _id: incidentId,
                emergencyType: 'FLOOD',
                peopleAffected: 50,
                priorityLevel: 'CRITICAL',
                locationVerificationRequired: true,
                isSimulated: false,
                location: null,
                verification: { requiresManualReview: true, status: 'NEEDS_REVIEW' }
            }
            jest.spyOn(Incident, 'create').mockResolvedValue(mockCreatedIncident as any)

            await createIncident({
                reporterName: 'Resident',
                emergencyType: 'FLOOD',
                description: 'Severe flood waters rising fast',
                peopleAffected: 50
            })

            expect(notifCreateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'CRITICAL_INCIDENT',
                    severity: 'CRITICAL',
                    incidentId: String(incidentId)
                })
            )
            expect(notifCreateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'INCIDENT_REVIEW_REQUIRED',
                    severity: 'HIGH',
                    incidentId: String(incidentId)
                })
            )
        })

        it('emits TEAM_ASSIGNED after successful team assignment', async () => {
            const notifCreateSpy = jest.spyOn(Notification, 'create').mockResolvedValue({} as any)

            const mockIncident = new Incident({
                _id: incidentId,
                emergencyType: 'FLOOD',
                peopleAffected: 3,
                status: 'PENDING',
                priorityLevel: 'HIGH',
                isSimulated: false
            })
            const mockTeam = new Team({
                _id: teamId,
                name: 'Alpha Team',
                teamCode: 'ALPHA',
                capabilities: ['WATER_RESCUE'],
                capacity: 5,
                status: 'AVAILABLE',
                location: { latitude: 24, longitude: 67 },
                isSimulated: false
            })
            const mockAssignment = new Assignment({
                _id: assignmentId,
                incidentId,
                teamId,
                status: 'ACTIVE',
                isSimulated: false
            })

            jest.spyOn(mockIncident, 'save').mockResolvedValue(mockIncident)
            jest.spyOn(mockTeam, 'save').mockResolvedValue(mockTeam)
            jest.spyOn(Incident, 'findById').mockReturnValue({ session: jest.fn().mockResolvedValue(mockIncident) } as any)
            jest.spyOn(Team, 'findById').mockReturnValue({ session: jest.fn().mockResolvedValue(mockTeam) } as any)
            jest.spyOn(Assignment, 'exists').mockReturnValue({ session: jest.fn().mockResolvedValue(null) } as any)
            jest.spyOn(Assignment, 'create').mockResolvedValue([mockAssignment] as any)

            const result = await assignTeam({ incidentId: String(incidentId), teamId: String(teamId) })

            expect(result._id).toEqual(assignmentId)
            expect(notifCreateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'TEAM_ASSIGNED',
                    severity: 'HIGH',
                    incidentId: String(incidentId),
                    teamId: String(teamId),
                    assignmentId: String(assignmentId)
                })
            )
        })

        it('does NOT emit notifications if team assignment fails or rolls back', async () => {
            const notifCreateSpy = jest.spyOn(Notification, 'create').mockResolvedValue({} as any)

            jest.spyOn(Incident, 'findById').mockReturnValue({ session: jest.fn().mockResolvedValue(null) } as any)

            await expect(assignTeam({ incidentId: String(incidentId), teamId: String(teamId) })).rejects.toThrow('Incident not found')

            expect(notifCreateSpy).not.toHaveBeenCalled()
        })

        it('emits INCIDENT_IN_PROGRESS, INCIDENT_RESOLVED, and INCIDENT_CANCELLED notifications on status changes', async () => {
            const notifCreateSpy = jest.spyOn(Notification, 'create').mockResolvedValue({} as any)

            const mockIncident = new Incident({
                _id: incidentId,
                emergencyType: 'FLOOD',
                peopleAffected: 2,
                status: 'ASSIGNED',
                assignedTeam: teamId,
                isSimulated: false
            })
            const mockTeam = new Team({
                _id: teamId,
                name: 'Alpha Team',
                teamCode: 'ALPHA',
                status: 'BUSY',
                currentIncident: incidentId,
                isSimulated: false
            })
            const mockAssignment = new Assignment({
                _id: assignmentId,
                incidentId,
                teamId,
                status: 'ACTIVE',
                isSimulated: false
            })

            jest.spyOn(mockIncident, 'save').mockResolvedValue(mockIncident)
            jest.spyOn(mockTeam, 'save').mockResolvedValue(mockTeam)
            jest.spyOn(mockAssignment, 'save').mockResolvedValue(mockAssignment)

            jest.spyOn(Incident, 'findById').mockReturnValue({ session: jest.fn().mockResolvedValue(mockIncident) } as any)
            jest.spyOn(Team, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(mockTeam) } as any)
            jest.spyOn(Assignment, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(mockAssignment) } as any)

            // Transition to IN_PROGRESS
            await changeStatus(String(incidentId), 'IN_PROGRESS')
            expect(notifCreateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'INCIDENT_IN_PROGRESS',
                    severity: 'HIGH',
                    incidentId: String(incidentId)
                })
            )

            // Transition to RESOLVED
            notifCreateSpy.mockClear()
            mockIncident.status = 'IN_PROGRESS'
            await changeStatus(String(incidentId), 'RESOLVED')
            expect(notifCreateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'INCIDENT_RESOLVED',
                    severity: 'LOW',
                    incidentId: String(incidentId)
                })
            )

            // Transition to CANCELLED
            notifCreateSpy.mockClear()
            mockIncident.status = 'ASSIGNED'
            mockIncident.assignedTeam = teamId
            mockTeam.status = 'BUSY'
            mockTeam.currentIncident = incidentId
            mockAssignment.status = 'ACTIVE'
            await changeStatus(String(incidentId), 'CANCELLED')
            expect(notifCreateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'INCIDENT_CANCELLED',
                    severity: 'LOW',
                    incidentId: String(incidentId)
                })
            )
        })
    })

    describe('Coordinator Notification HTTP Endpoints & Authorization', () => {
        it('rejects unauthenticated requests with 401', async () => {
            const res = await request(app).get('/api/notifications')
            expect(res.status).toBe(401)
            expect(res.body.success).toBe(false)
        })

        it('rejects non-admin citizen users with 403', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: citizenUserId,
                role: EUserRoles.USER
            } as any)

            const res = await request(app)
                .get('/api/notifications')
                .set('Cookie', [`accessToken=${citizenToken}`])

            expect(res.status).toBe(403)
            expect(res.body.message).toMatch(/Coordinator \(admin\) access required/)
        })

        it('returns paginated notifications for authenticated coordinator', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)

            const mockQuery = {
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([
                    {
                        _id: new mongoose.Types.ObjectId(),
                        type: 'INCIDENT_CREATED',
                        severity: 'HIGH',
                        title: 'Emergency Flood',
                        message: 'Help needed',
                        readBy: [],
                        createdAt: new Date()
                    }
                ])
            }
            jest.spyOn(Notification, 'find').mockReturnValue(mockQuery as any)
            jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1 as any)

            const res = await request(app)
                .get('/api/notifications?page=1&limit=10')
                .set('Cookie', [`accessToken=${adminToken}`])

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.items).toHaveLength(1)
            expect(res.body.data.pagination.total).toBe(1)
        })

        it('returns unread notification count for coordinator badge', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)
            jest.spyOn(Notification, 'countDocuments').mockResolvedValue(4 as any)

            const res = await request(app)
                .get('/api/notifications/unread-count')
                .set('Cookie', [`accessToken=${adminToken}`])

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.unreadCount).toBe(4)
        })

        it('marks a single notification as read via PATCH /api/notifications/:id/read', async () => {
            const notifId = new mongoose.Types.ObjectId()
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)

            const mockDoc: any = {
                _id: notifId,
                type: 'CRITICAL_INCIDENT',
                severity: 'CRITICAL',
                title: 'Flood',
                message: 'Critical',
                readBy: [],
                createdAt: new Date(),
                save: jest.fn().mockResolvedValue(true),
                toObject: function () {
                    return this
                }
            }
            jest.spyOn(Notification, 'findById').mockResolvedValue(mockDoc)

            const res = await request(app)
                .patch(`/api/notifications/${String(notifId)}/read`)
                .set('Cookie', [`accessToken=${adminToken}`])

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.isRead).toBe(true)
        })

        it('marks all notifications as read via PATCH /api/notifications/read-all', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)
            jest.spyOn(Notification, 'updateMany').mockResolvedValue({
                modifiedCount: 5
            } as any)

            const res = await request(app)
                .patch('/api/notifications/read-all')
                .set('Cookie', [`accessToken=${adminToken}`])

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.updatedCount).toBe(5)
        })
    })
})
