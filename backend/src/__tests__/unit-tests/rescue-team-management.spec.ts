/* Jest matchers inspect mock methods without invoking their receiver. */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
jest.mock('../../handlers/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }))
import mongoose, { ClientSession } from 'mongoose'
import request from 'supertest'
import Team from '../../APIs/response/models/team.model'
import Incident from '../../APIs/response/models/incident.model'
import Assignment from '../../APIs/response/models/assignment.model'
import { createTeam, updateTeam, getTeam, listTeams, assignTeam, changeStatus } from '../../APIs/response/response.service'
import { teamSchema, teamUpdateSchema, teamQuerySchema, idSchema, validate } from '../../APIs/response/validation'
import app from '../../app'
import config from '../../config/config'
import jwt from '../../utils/jwt'
import userRepo from '../../APIs/user/_shared/repo/user.repository'
import { CustomError } from '../../utils/errors'
import { EUserRoles } from '../../constant/users'

describe('Rescue Team Registry & Resource Management', () => {
    const mockTeamId = new mongoose.Types.ObjectId()
    const mockIncidentId = new mongoose.Types.ObjectId()

    function createMockTeamDoc(overrides: Record<string, any> = {}) {
        const doc: Record<string, any> = {
            _id: mockTeamId,
            name: 'Alpha Rescue Crew',
            teamCode: 'ALPHA-01',
            capabilities: ['WATER_RESCUE', 'EVACUATION'],
            status: 'AVAILABLE',
            capacity: 10,
            location: { latitude: 24.8607, longitude: 67.0011, address: 'Karachi Port' },
            contact: { phone: '+923001234567', email: 'alpha@resqlink.org', leadName: 'Commander Tariq' },
            currentIncident: null,
            isSimulated: false,
            ...overrides
        }
        doc.toObject = () => ({ ...doc })
        doc.get = (field: string) => doc[field]
        doc.set = (field: string, val: any) => {
            doc[field] = val
        }
        doc.save = jest.fn().mockResolvedValue(doc)
        doc.populate = jest.fn().mockImplementation(() => Promise.resolve(doc))
        return doc
    }

    beforeEach(() => {
        jest.clearAllMocks()
        jest.spyOn(Team, 'init').mockResolvedValue(new Team() as any)
        jest.spyOn(Incident, 'init').mockResolvedValue(new Incident() as any)
        jest.spyOn(Assignment, 'init').mockResolvedValue(new Assignment() as any)
        jest.spyOn(mongoose.connection, 'transaction').mockImplementation(async (work) => work({} as ClientSession))
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('Team Registration (Schema & Service)', () => {
        it('validates a complete and valid team registration payload', () => {
            const validPayload = {
                name: 'Bravo Medical Team',
                teamCode: 'BRAVO-02',
                capabilities: ['MEDICAL', 'EVACUATION'],
                capacity: 8,
                location: { latitude: 24.89, longitude: 67.08, address: 'Gulshan Station' },
                contact: { phone: '+923007654321', email: 'bravo@resqlink.org', leadName: 'Dr. Fatima' },
                status: 'AVAILABLE'
            }

            const parsed = validate<any>(teamSchema, validPayload)
            expect(parsed.name).toBe('Bravo Medical Team')
            expect(parsed.teamCode).toBe('BRAVO-02')
            expect(parsed.capabilities).toEqual(['MEDICAL', 'EVACUATION'])
            expect(parsed.capacity).toBe(8)
            expect(parsed.status).toBe('AVAILABLE')
        })

        it('successfully registers a new rescue team via service', async () => {
            const mockDoc = createMockTeamDoc()
            jest.spyOn(Team, 'findOne').mockResolvedValue(null)
            jest.spyOn(Team, 'create').mockResolvedValue(mockDoc as any)

            const result = await createTeam({
                name: 'Alpha Rescue Crew',
                teamCode: 'alpha-01',
                capabilities: ['WATER_RESCUE', 'EVACUATION'],
                capacity: 10,
                location: { latitude: 24.8607, longitude: 67.0011 }
            })

            expect(Team.findOne).toHaveBeenCalledWith({ teamCode: 'ALPHA-01' })
            expect(Team.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Alpha Rescue Crew',
                    teamCode: 'ALPHA-01'
                })
            )
            expect(result).toBe(mockDoc)
        })

        it('rejects registration when team code already exists with 409 Conflict', async () => {
            const existingDoc = createMockTeamDoc({ teamCode: 'ALPHA-01' })
            jest.spyOn(Team, 'findOne').mockResolvedValue(existingDoc)

            await expect(
                createTeam({
                    name: 'Duplicate Alpha',
                    teamCode: 'ALPHA-01',
                    capabilities: ['WATER_RESCUE'],
                    capacity: 5,
                    location: { latitude: 24.86, longitude: 67.0 }
                })
            ).rejects.toThrow(new CustomError('A rescue team with team code \'ALPHA-01\' already exists', 409))
        })

        it('rejects invalid or empty capabilities', () => {
            expect(() =>
                validate(teamSchema, {
                    name: 'Invalid Team',
                    teamCode: 'INV-01',
                    capabilities: ['AIRSTRIKE'],
                    capacity: 5,
                    location: { latitude: 24.8, longitude: 67.0 }
                })
            ).toThrow(/capabilities/)

            expect(() =>
                validate(teamSchema, {
                    name: 'Empty Team',
                    teamCode: 'INV-02',
                    capabilities: [],
                    capacity: 5,
                    location: { latitude: 24.8, longitude: 67.0 }
                })
            ).toThrow(/capabilities/)
        })

        it('rejects invalid coordinates', () => {
            expect(() =>
                validate(teamSchema, {
                    name: 'Out of Bounds Lat',
                    teamCode: 'COORD-01',
                    capabilities: ['WATER_RESCUE'],
                    capacity: 5,
                    location: { latitude: 91, longitude: 67.0 }
                })
            ).toThrow(/latitude/)

            expect(() =>
                validate(teamSchema, {
                    name: 'Out of Bounds Lon',
                    teamCode: 'COORD-02',
                    capabilities: ['WATER_RESCUE'],
                    capacity: 5,
                    location: { latitude: 24.0, longitude: 185 }
                })
            ).toThrow(/longitude/)
        })

        it('rejects non-positive capacity', () => {
            expect(() =>
                validate(teamSchema, {
                    name: 'Zero Cap',
                    teamCode: 'CAP-01',
                    capabilities: ['WATER_RESCUE'],
                    capacity: 0,
                    location: { latitude: 24.0, longitude: 67.0 }
                })
            ).toThrow(/capacity/)

            expect(() =>
                validate(teamSchema, {
                    name: 'Negative Cap',
                    teamCode: 'CAP-02',
                    capabilities: ['WATER_RESCUE'],
                    capacity: -5,
                    location: { latitude: 24.0, longitude: 67.0 }
                })
            ).toThrow(/capacity/)
        })
    })

    describe('Team Profile & Availability Updates (PATCH)', () => {
        it('successfully updates supported profile information', async () => {
            const mockDoc = createMockTeamDoc()
            jest.spyOn(Team, 'findById').mockResolvedValue(mockDoc as any)
            jest.spyOn(Assignment, 'exists').mockResolvedValue(null as any)

            const updated = await updateTeam(String(mockTeamId), {
                name: 'Alpha Prime Squad',
                capacity: 15,
                capabilities: ['WATER_RESCUE', 'MEDICAL', 'EVACUATION'],
                location: { latitude: 24.9, longitude: 67.1, address: 'Clifton Base' },
                contact: { phone: '+923009999999', email: 'prime@resqlink.org', leadName: 'Major Asim' }
            })

            expect(mockDoc.name).toBe('Alpha Prime Squad')
            expect(mockDoc.capacity).toBe(15)
            expect(mockDoc.capabilities).toEqual(['WATER_RESCUE', 'MEDICAL', 'EVACUATION'])
            expect(mockDoc.location.address).toBe('Clifton Base')
            expect(mockDoc.contact.leadName).toBe('Major Asim')
            expect(mockDoc.save).toHaveBeenCalled()
            expect(updated).toBe(mockDoc)
        })

        it('supports safe manual availability toggle between AVAILABLE and OFFLINE for idle teams', async () => {
            const mockDoc = createMockTeamDoc({ status: 'AVAILABLE' })
            jest.spyOn(Team, 'findById').mockResolvedValue(mockDoc as any)
            jest.spyOn(Assignment, 'exists').mockResolvedValue(null as any)

            await updateTeam(String(mockTeamId), { status: 'OFFLINE' })
            expect(mockDoc.status).toBe('OFFLINE')

            await updateTeam(String(mockTeamId), { status: 'AVAILABLE' })
            expect(mockDoc.status).toBe('AVAILABLE')
        })

        it('prevents manual status modification to AVAILABLE when team is BUSY', async () => {
            const busyTeamDoc = createMockTeamDoc({ status: 'BUSY', currentIncident: mockIncidentId })
            jest.spyOn(Team, 'findById').mockResolvedValue(busyTeamDoc as any)
            jest.spyOn(Assignment, 'exists').mockResolvedValue(null as any)

            await expect(updateTeam(String(mockTeamId), { status: 'AVAILABLE' })).rejects.toThrow(
                /Cannot manually modify availability of an actively assigned/
            )
        })

        it('prevents manual status modification when an active assignment exists', async () => {
            const idleTeamDoc = createMockTeamDoc({ status: 'AVAILABLE' })
            jest.spyOn(Team, 'findById').mockResolvedValue(idleTeamDoc as any)
            jest.spyOn(Assignment, 'exists').mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as any)

            await expect(updateTeam(String(mockTeamId), { status: 'OFFLINE' })).rejects.toThrow(
                /Cannot manually modify availability of an actively assigned/
            )
        })

        it('preserves BUSY status and active assignment when profile details are updated', async () => {
            const busyTeamDoc = createMockTeamDoc({ status: 'BUSY', currentIncident: mockIncidentId })
            jest.spyOn(Team, 'findById').mockResolvedValue(busyTeamDoc as any)
            jest.spyOn(Assignment, 'exists').mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as any)

            await updateTeam(String(mockTeamId), { name: 'Alpha Busy Edit', capacity: 12 })

            expect(busyTeamDoc.name).toBe('Alpha Busy Edit')
            expect(busyTeamDoc.capacity).toBe(12)
            expect(busyTeamDoc.status).toBe('BUSY')
            expect(busyTeamDoc.currentIncident).toBe(mockIncidentId)
        })

        it('rejects update when team ID is not found (404)', async () => {
            jest.spyOn(Team, 'findById').mockResolvedValue(null)

            await expect(updateTeam(String(mockTeamId), { name: 'Ghost' })).rejects.toThrow(new CustomError('Rescue team not found', 404))
        })

        it('rejects unsupported fields and empty payloads via teamUpdateSchema', () => {
            expect(() => validate(teamUpdateSchema, {})).toThrow(/at least 1/)
            expect(() => validate(teamUpdateSchema, { isSimulated: true })).toThrow(/not allowed/)
            expect(() => validate(teamUpdateSchema, { currentIncident: '67b0965d1b32d20b7a2d1234' })).toThrow(/not allowed/)
            expect(() => validate(teamUpdateSchema, { status: 'BUSY' })).toThrow(/status/)
        })

        it('rejects invalid ObjectId hex strings via idSchema', () => {
            expect(() => validate(idSchema, 'invalid-id')).toThrow(/hexadecimal|length/)
            expect(() => validate(idSchema, '12345')).toThrow(/hexadecimal|length/)
            expect(() => validate(idSchema, String(mockTeamId))).not.toThrow()
        })
    })

    describe('Team Detail API (GET /:id)', () => {
        it('retrieves rescue team details with populated operational incident info', async () => {
            const mockDoc = createMockTeamDoc({
                status: 'BUSY',
                currentIncident: {
                    _id: mockIncidentId,
                    emergencyType: 'FLOOD',
                    priorityLevel: 'CRITICAL',
                    status: 'IN_PROGRESS'
                }
            })
            const queryMock = {
                populate: jest.fn().mockResolvedValue(mockDoc)
            }
            jest.spyOn(Team, 'findById').mockReturnValue(queryMock as any)

            const result = await getTeam(String(mockTeamId))
            expect(Team.findById).toHaveBeenCalledWith(String(mockTeamId))
            expect(queryMock.populate).toHaveBeenCalledWith({
                path: 'currentIncident',
                select: '_id emergencyType priorityLevel status location reporterName peopleAffected createdAt'
            })
            expect(result).toBe(mockDoc)
        })

        it('throws 404 when team does not exist', async () => {
            const queryMock = {
                populate: jest.fn().mockResolvedValue(null)
            }
            jest.spyOn(Team, 'findById').mockReturnValue(queryMock as any)

            await expect(getTeam(String(mockTeamId))).rejects.toThrow(new CustomError('Rescue team not found', 404))
        })
    })

    describe('Team Listing & Filtering (GET /)', () => {
        it('filters by capability, status, and search query', async () => {
            let capturedFilter: any = null
            let capturedSort: any = null

            jest.spyOn(Team, 'find').mockImplementation((...args: any[]) => {
                capturedFilter = args[0]
                return {
                    sort: (s: any) => {
                        capturedSort = s
                        return {
                            skip: () => ({
                                limit: () => ({
                                    lean: () => Promise.resolve([createMockTeamDoc()])
                                })
                            })
                        }
                    }
                } as any
            })
            jest.spyOn(Team, 'countDocuments').mockResolvedValue(1)

            const result = await listTeams({
                page: 1,
                limit: 10,
                status: 'AVAILABLE',
                capability: 'WATER_RESCUE',
                search: 'Alpha'
            })

            expect(capturedFilter.status).toBe('AVAILABLE')
            expect(capturedFilter.capabilities).toBe('WATER_RESCUE')
            expect(capturedFilter.$or).toBeDefined()
            expect(capturedSort).toEqual({ teamCode: 1 })
            expect(result.items.length).toBe(1)
            expect(result.pagination.total).toBe(1)
        })
        it('validates teamQuerySchema bounds and allowed filters', () => {
            const parsed = validate<any>(teamQuerySchema, {
                page: 2,
                limit: 50,
                status: 'AVAILABLE',
                capability: 'WATER_RESCUE',
                search: 'Bravo'
            })
            expect(parsed.page).toBe(2)
            expect(parsed.limit).toBe(50)
            expect(parsed.status).toBe('AVAILABLE')
            expect(parsed.capability).toBe('WATER_RESCUE')
            expect(parsed.search).toBe('Bravo')
        })
    })

    describe('Coordinator Route Access & Security', () => {
        const adminId = '67b0965d1b32d20b7a2d8888'
        const userId = '67b0965d1b32d20b7a2d9999'
        config.TOKENS.ACCESS.SECRET = 'test-secret-key-32-bytes-minimum-length-needed'
        const adminToken = jwt.generateToken({ userId: adminId }, config.TOKENS.ACCESS.SECRET, 3600)
        const userToken = jwt.generateToken({ userId: userId }, config.TOKENS.ACCESS.SECRET, 3600)

        it('rejects unauthenticated requests to /api/rescue-teams with 401', async () => {
            const res = await request(app).get('/api/rescue-teams')
            expect(res.status).toBe(401)
        })

        it('rejects non-coordinator (citizen/user) with 403 Forbidden', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: userId,
                role: EUserRoles.USER
            } as any)

            const res = await request(app)
                .get('/api/rescue-teams')
                .set('Cookie', [`accessToken=${userToken}`])

            expect(res.status).toBe(403)
            expect(res.body.message).toMatch(/Coordinator \(admin\) access required/)
        })

        it('permits authorized admin coordinator requests', async () => {
            jest.spyOn(userRepo, 'findUserById').mockResolvedValue({
                _id: adminId,
                role: EUserRoles.ADMIN
            } as any)

            jest.spyOn(Team, 'find').mockImplementation(() => {
                return {
                    sort: () => ({
                        skip: () => ({
                            limit: () => ({
                                lean: () => Promise.resolve([])
                            })
                        })
                    })
                } as any
            })
            jest.spyOn(Team, 'countDocuments').mockResolvedValue(0)

            const res = await request(app)
                .get('/api/rescue-teams')
                .set('Cookie', [`accessToken=${adminToken}`])

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })
    })

    describe('Regression Safety: Assignment & Release Behavior', () => {
        it('preserves automatic transition to BUSY on assignment and back to AVAILABLE on incident resolution', async () => {
            const incident = new Incident({
                _id: mockIncidentId,
                reporterName: 'Resident',
                emergencyType: 'FLOOD',
                description: 'Flooding in area',
                peopleAffected: 4,
                locationVerificationRequired: false,
                priorityScore: 70,
                priorityLevel: 'CRITICAL',
                confidenceLevel: 'HIGH',
                status: 'PENDING'
            })
            const team = new Team({
                _id: mockTeamId,
                name: 'Alpha Response',
                teamCode: 'ALPHA-01',
                capacity: 10,
                capabilities: ['WATER_RESCUE'],
                location: { latitude: 24.86, longitude: 67.0 },
                status: 'AVAILABLE',
                currentIncident: null
            })

            jest.spyOn(incident, 'save').mockResolvedValue(incident)
            jest.spyOn(team, 'save').mockResolvedValue(team)
            jest.spyOn(Incident, 'findById').mockReturnValue({ session: jest.fn().mockResolvedValue(incident) } as any)
            jest.spyOn(Team, 'findById').mockReturnValue({ session: jest.fn().mockResolvedValue(team) } as any)
            jest.spyOn(Assignment, 'exists').mockReturnValue({ session: jest.fn().mockResolvedValue(null) } as any)
            jest.spyOn(Assignment, 'create').mockResolvedValue([new Assignment({ incidentId: mockIncidentId, teamId: mockTeamId })] as any)

            // Step 1: Assign team -> becomes BUSY
            await assignTeam({ incidentId: String(mockIncidentId), teamId: String(mockTeamId) })
            expect(team.status).toBe('BUSY')
            expect(team.currentIncident).toEqual(mockIncidentId)

            // Step 2: Resolve incident -> team automatically released to AVAILABLE
            const mockAssignment = new Assignment({
                incidentId: mockIncidentId,
                teamId: mockTeamId,
                status: 'ACTIVE'
            })
            mockAssignment.save = jest.fn().mockResolvedValue(mockAssignment)
            incident.status = 'IN_PROGRESS'
            incident.assignedTeam = mockTeamId as any

            jest.spyOn(Assignment, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(mockAssignment) } as any)
            jest.spyOn(Team, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(team) } as any)

            await changeStatus(String(mockIncidentId), 'RESOLVED')
            expect(team.status).toBe('AVAILABLE')
            expect(team.currentIncident).toBeNull()
            expect(mockAssignment.status).toBe('COMPLETED')
        })
    })
})
