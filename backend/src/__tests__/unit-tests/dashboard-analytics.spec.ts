/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
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
import { calculateTrends, buildActivityTimeline, getDashboardSummary, getDashboardActivity } from '../../APIs/response/dashboard.service'

describe('Dashboard Analytics & Activity', () => {
    describe('calculateTrends', () => {
        const refDate = new Date('2026-10-17T12:00:00.000Z')

        it('generates 24 hourly buckets and 7 daily buckets initialized to zero', () => {
            const trends = calculateTrends([], refDate)
            expect(trends.last24Hours).toHaveLength(24)
            expect(trends.last7Days).toHaveLength(7)
            expect(trends.last24Hours.every((b) => b.count === 0 && b.criticalCount === 0)).toBe(true)
            expect(trends.last7Days.every((b) => b.count === 0 && b.criticalCount === 0)).toBe(true)
        })

        it('aggregates incident counts into the correct hourly and daily buckets', () => {
            const incidents = [
                {
                    createdAt: new Date('2026-10-17T11:30:00.000Z'),
                    priorityLevel: 'CRITICAL'
                },
                {
                    createdAt: new Date('2026-10-17T11:45:00.000Z'),
                    priorityLevel: 'HIGH'
                },
                {
                    createdAt: new Date('2026-10-16T10:00:00.000Z'),
                    priorityLevel: 'LOW'
                },
                {
                    // Out of range (older than 7 days)
                    createdAt: new Date('2026-10-01T00:00:00.000Z'),
                    priorityLevel: 'CRITICAL'
                }
            ]

            const trends = calculateTrends(incidents, refDate)
            const targetHour = trends.last24Hours.find((b) => b.timestamp === '2026-10-17T11:00')
            expect(targetHour).toBeDefined()
            expect(targetHour?.count).toBe(2)
            expect(targetHour?.criticalCount).toBe(1)

            const targetDay = trends.last7Days.find((b) => b.date === '2026-10-17')
            expect(targetDay).toBeDefined()
            expect(targetDay?.count).toBe(2)
            expect(targetDay?.criticalCount).toBe(1)

            const previousDay = trends.last7Days.find((b) => b.date === '2026-10-16')
            expect(previousDay).toBeDefined()
            expect(previousDay?.count).toBe(1)
            expect(previousDay?.criticalCount).toBe(0)
        })

        it('handles missing or invalid timestamps without throwing', () => {
            const incidents = [{ createdAt: undefined }, { createdAt: 'invalid-date' }]
            expect(() => calculateTrends(incidents, refDate)).not.toThrow()
        })
    })

    describe('buildActivityTimeline', () => {
        it('builds a sorted list of activity events from incidents, assignments, and overrides', () => {
            const incidents = [
                {
                    _id: 'inc-1',
                    reporterName: 'Alice',
                    emergencyType: 'FLOOD',
                    peopleAffected: 4,
                    status: 'PENDING',
                    priorityLevel: 'CRITICAL',
                    createdAt: '2026-10-17T10:00:00.000Z',
                    priorityOverrides: [
                        {
                            previousPriority: 'HIGH',
                            newPriority: 'CRITICAL',
                            reason: 'Rising water level',
                            timestamp: '2026-10-17T10:15:00.000Z'
                        }
                    ]
                }
            ]
            const assignments = [
                {
                    _id: 'asg-1',
                    incidentId: { _id: 'inc-1', emergencyType: 'FLOOD' },
                    teamId: { _id: 'team-1', teamCode: 'BOAT-1' },
                    assignedAt: '2026-10-17T10:30:00.000Z',
                    completedAt: '2026-10-17T11:00:00.000Z',
                    status: 'COMPLETED'
                }
            ]

            const timeline = buildActivityTimeline(incidents as any, assignments as any, 10)
            expect(timeline).toHaveLength(4)
            // Latest to oldest:
            expect(timeline[0].type).toBe('ASSIGNMENT_COMPLETED')
            expect(timeline[1].type).toBe('TEAM_ASSIGNED')
            expect(timeline[2].type).toBe('PRIORITY_OVERRIDE')
            expect(timeline[3].type).toBe('INCIDENT_REPORTED')

            // Verify order
            for (let i = 0; i < timeline.length - 1; i++) {
                expect(timeline[i].timestamp.getTime()).toBeGreaterThanOrEqual(timeline[i + 1].timestamp.getTime())
            }
        })

        it('respects the limit parameter', () => {
            const incidents = [
                { _id: '1', createdAt: '2026-10-17T10:00:00.000Z' },
                { _id: '2', createdAt: '2026-10-17T09:00:00.000Z' },
                { _id: '3', createdAt: '2026-10-17T08:00:00.000Z' }
            ]
            const timeline = buildActivityTimeline(incidents as any, [], 2)
            expect(timeline).toHaveLength(2)
        })

        it('handles empty inputs safely', () => {
            const timeline = buildActivityTimeline([], [], 10)
            expect(timeline).toEqual([])
        })
    })

    describe('getDashboardSummary service logic', () => {
        afterEach(() => jest.restoreAllMocks())

        it('aggregates counts, handles zero-fills, and computes team capacity', async () => {
            jest.spyOn(Incident, 'aggregate').mockImplementation((pipeline: any[]) => {
                const group = pipeline.find((p) => p.$group)?.$group
                if (group?._id === '$status') {
                    return Promise.resolve([
                        { _id: 'PENDING', count: 3 },
                        { _id: 'RESOLVED', count: 2 }
                    ]) as any
                }
                if (group?._id === '$priorityLevel') {
                    return Promise.resolve([
                        { _id: 'CRITICAL', count: 2 },
                        { _id: 'MEDIUM', count: 3 }
                    ]) as any
                }
                if (group?._id === '$emergencyType') {
                    return Promise.resolve([
                        { _id: 'FLOOD', count: 4 },
                        { _id: 'MEDICAL', count: 1 }
                    ]) as any
                }
                if (group?.totalPeopleAffected) {
                    return Promise.resolve([{ totalPeopleAffected: 15, requiringLocationVerification: 2 }]) as any
                }
                return Promise.resolve([]) as any
            })

            jest.spyOn(Incident, 'countDocuments').mockResolvedValue(5 as any)
            jest.spyOn(Team, 'countDocuments').mockResolvedValue(4 as any)
            jest.spyOn(Assignment, 'countDocuments').mockResolvedValue(2 as any)

            jest.spyOn(Team, 'aggregate').mockResolvedValue([
                { _id: 'AVAILABLE', count: 2, capacity: 12 },
                { _id: 'BUSY', count: 1, capacity: 6 },
                { _id: 'OFFLINE', count: 1, capacity: 4 }
            ] as any)

            jest.spyOn(Assignment, 'aggregate').mockResolvedValue([
                { _id: 'ACTIVE', count: 1 },
                { _id: 'COMPLETED', count: 1 }
            ] as any)

            const mockQuery = {
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            }
            jest.spyOn(Incident, 'find').mockReturnValue(mockQuery as any)
            jest.spyOn(Assignment, 'find').mockReturnValue(mockQuery as any)

            const summary = await getDashboardSummary()

            expect(summary.incidents.total).toBe(5)
            expect(summary.incidents.byStatus.PENDING).toBe(3)
            expect(summary.incidents.byStatus.ASSIGNED).toBe(0) // Defaulted
            expect(summary.incidents.byStatus.RESOLVED).toBe(2)
            expect(summary.incidents.byPriority.CRITICAL).toBe(2)
            expect(summary.incidents.byPriority.HIGH).toBe(0) // Defaulted
            expect(summary.incidents.byPriority.MEDIUM).toBe(3)
            expect(summary.incidents.totalPeopleAffected).toBe(15)
            expect(summary.incidents.requiringLocationVerification).toBe(2)

            expect(summary.teams.total).toBe(4)
            expect(summary.teams.byStatus.AVAILABLE).toBe(2)
            expect(summary.teams.byStatus.BUSY).toBe(1)
            expect(summary.teams.byStatus.OFFLINE).toBe(1)
            expect(summary.teams.availableCapacity).toBe(12)
            expect(summary.teams.busyCapacity).toBe(6)
            expect(summary.teams.totalCapacity).toBe(22)

            expect(summary.assignments.total).toBe(2)
            expect(summary.assignments.byStatus.ACTIVE).toBe(1)
            expect(summary.assignments.byStatus.COMPLETED).toBe(1)
            expect(summary.assignments.byStatus.CANCELLED).toBe(0)
        })

        it('handles completely empty database gracefully', async () => {
            jest.spyOn(Incident, 'aggregate').mockResolvedValue([] as any)
            jest.spyOn(Incident, 'countDocuments').mockResolvedValue(0 as any)
            jest.spyOn(Team, 'aggregate').mockResolvedValue([] as any)
            jest.spyOn(Team, 'countDocuments').mockResolvedValue(0 as any)
            jest.spyOn(Assignment, 'aggregate').mockResolvedValue([] as any)
            jest.spyOn(Assignment, 'countDocuments').mockResolvedValue(0 as any)

            const mockQuery = {
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            }
            jest.spyOn(Incident, 'find').mockReturnValue(mockQuery as any)
            jest.spyOn(Assignment, 'find').mockReturnValue(mockQuery as any)

            const summary = await getDashboardSummary()
            expect(summary.incidents.total).toBe(0)
            expect(summary.incidents.totalPeopleAffected).toBe(0)
            expect(summary.teams.total).toBe(0)
            expect(summary.teams.totalCapacity).toBe(0)
            expect(summary.assignments.total).toBe(0)
            expect(summary.recentActivity).toEqual([])
        })
    })

    describe('getDashboardActivity service logic', () => {
        afterEach(() => jest.restoreAllMocks())

        it('returns activity feed and total count', async () => {
            const mockIncidents = [
                {
                    _id: 'inc-1',
                    reporterName: 'Reporter 1',
                    emergencyType: 'FLOOD',
                    peopleAffected: 2,
                    createdAt: '2026-10-17T09:00:00.000Z'
                }
            ]
            const mockAssignments = [
                {
                    _id: 'asg-1',
                    incidentId: { _id: 'inc-1', emergencyType: 'FLOOD' },
                    teamId: { _id: 'team-1', teamCode: 'TEAM-A' },
                    assignedAt: '2026-10-17T09:30:00.000Z'
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
                lean: jest.fn().mockResolvedValue(mockAssignments)
            }

            jest.spyOn(Incident, 'find').mockReturnValue(mockIncidentQuery as any)
            jest.spyOn(Assignment, 'find').mockReturnValue(mockAssignmentQuery as any)

            const result = await getDashboardActivity({ limit: 10 })
            expect(result.total).toBe(2)
            expect(result.items[0].type).toBe('TEAM_ASSIGNED')
            expect(result.items[1].type).toBe('INCIDENT_REPORTED')
        })
    })

    describe('Dashboard HTTP Endpoints & Authorization', () => {
        const adminId = new mongoose.Types.ObjectId().toString()
        const userId = new mongoose.Types.ObjectId().toString()
        config.TOKENS.ACCESS.SECRET = 'test-secret-key-32-bytes-minimum-length-needed'

        const adminToken = jwt.generateToken({ userId: adminId }, config.TOKENS.ACCESS.SECRET, 3600)
        const userToken = jwt.generateToken({ userId: userId }, config.TOKENS.ACCESS.SECRET, 3600)

        afterEach(() => jest.restoreAllMocks())

        it('rejects unauthenticated requests with 401', async () => {
            const resSummary = await request(app).get('/api/dashboard/summary')
            expect(resSummary.status).toBe(401)
            expect(resSummary.body.success).toBe(false)

            const resActivity = await request(app).get('/api/dashboard/activity')
            expect(resActivity.status).toBe(401)
            expect(resActivity.body.success).toBe(false)
        })

        it('rejects non-admin authenticated users with 403', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: userId,
                role: EUserRoles.USER
            } as any)

            const res = await request(app)
                .get('/api/dashboard/summary')
                .set('Cookie', [`accessToken=${userToken}`])

            expect(res.status).toBe(403)
            expect(res.body.message).toMatch(/Coordinator \(admin\) access required/)
        })

        it('allows admin users to access /api/dashboard/summary', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)

            jest.spyOn(Incident, 'aggregate').mockResolvedValue([] as any)
            jest.spyOn(Incident, 'countDocuments').mockResolvedValue(0 as any)
            jest.spyOn(Team, 'aggregate').mockResolvedValue([] as any)
            jest.spyOn(Team, 'countDocuments').mockResolvedValue(0 as any)
            jest.spyOn(Assignment, 'aggregate').mockResolvedValue([] as any)
            jest.spyOn(Assignment, 'countDocuments').mockResolvedValue(0 as any)

            const mockQuery = {
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            }
            jest.spyOn(Incident, 'find').mockReturnValue(mockQuery as any)
            jest.spyOn(Assignment, 'find').mockReturnValue(mockQuery as any)

            const res = await request(app)
                .get('/api/dashboard/summary')
                .set('Cookie', [`accessToken=${adminToken}`])

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.incidents).toBeDefined()
            expect(res.body.data.teams).toBeDefined()
            expect(res.body.data.assignments).toBeDefined()
            expect(res.body.data.trends).toBeDefined()
            expect(res.body.data.recentActivity).toBeDefined()
        })

        it('allows admin users to access alias /api/dashboard/stats', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)

            jest.spyOn(Incident, 'aggregate').mockResolvedValue([] as any)
            jest.spyOn(Incident, 'countDocuments').mockResolvedValue(0 as any)
            jest.spyOn(Team, 'aggregate').mockResolvedValue([] as any)
            jest.spyOn(Team, 'countDocuments').mockResolvedValue(0 as any)
            jest.spyOn(Assignment, 'aggregate').mockResolvedValue([] as any)
            jest.spyOn(Assignment, 'countDocuments').mockResolvedValue(0 as any)

            const mockQuery = {
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            }
            jest.spyOn(Incident, 'find').mockReturnValue(mockQuery as any)
            jest.spyOn(Assignment, 'find').mockReturnValue(mockQuery as any)

            const res = await request(app)
                .get('/api/dashboard/stats')
                .set('Cookie', [`accessToken=${adminToken}`])

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.incidents).toBeDefined()
        })

        it('allows admin users to access /api/dashboard/activity', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)

            const mockQuery = {
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            }
            jest.spyOn(Incident, 'find').mockReturnValue(mockQuery as any)
            jest.spyOn(Assignment, 'find').mockReturnValue(mockQuery as any)

            const res = await request(app)
                .get('/api/dashboard/activity?limit=5')
                .set('Cookie', [`accessToken=${adminToken}`])

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.items).toEqual([])
            expect(res.body.data.total).toBe(0)
        })
    })
})
