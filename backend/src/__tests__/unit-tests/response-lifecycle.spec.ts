/* Jest matchers inspect mock methods without invoking their receiver. */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import mongoose, { ClientSession } from 'mongoose'
import Incident from '../../APIs/response/models/incident.model'
import Team from '../../APIs/response/models/team.model'
import Assignment from '../../APIs/response/models/assignment.model'
import { assignTeam, changeStatus, overridePriority } from '../../APIs/response/response.service'

const incidentId = new mongoose.Types.ObjectId()
const teamId = new mongoose.Types.ObjectId()
function fixtures(status = 'PENDING', teamStatus = 'AVAILABLE', capabilities = ['WATER_RESCUE']) {
    const incident = new Incident({
        _id: incidentId,
        reporterName: 'SIMULATED household',
        emergencyType: 'FLOOD',
        description: 'SIMULATED emergency',
        peopleAffected: 3,
        locationVerificationRequired: true,
        priorityScore: 50,
        priorityLevel: 'HIGH',
        confidenceLevel: 'LOW',
        priorityReasons: ['Manual review'],
        status,
        assignedTeam: status === 'PENDING' ? null : teamId
    })
    const team = new Team({
        _id: teamId,
        name: 'SIMULATED crew',
        teamCode: 'DEMO',
        capacity: 5,
        capabilities,
        location: { latitude: 24, longitude: 67 },
        status: teamStatus,
        currentIncident: teamStatus === 'BUSY' ? incidentId : null
    })
    jest.spyOn(incident, 'save').mockResolvedValue(incident)
    jest.spyOn(team, 'save').mockResolvedValue(team)
    jest.spyOn(Incident, 'findById').mockReturnValue({ session: jest.fn().mockResolvedValue(incident) } as unknown as ReturnType<
        typeof Incident.findById
    >)
    jest.spyOn(Team, 'findById').mockReturnValue({ session: jest.fn().mockResolvedValue(team) } as unknown as ReturnType<typeof Team.findById>)
    return { incident, team }
}
beforeEach(() => {
    jest.spyOn(Incident, 'init').mockResolvedValue(new Incident())
    jest.spyOn(Team, 'init').mockResolvedValue(new Team())
    jest.spyOn(Assignment, 'init').mockResolvedValue(new Assignment())
    jest.spyOn(mongoose.connection, 'transaction').mockImplementation(async (work) => work({} as ClientSession))
    jest.spyOn(Assignment, 'exists').mockReturnValue({ session: jest.fn().mockResolvedValue(null) } as unknown as ReturnType<
        typeof Assignment.exists
    >)
})
afterEach(() => jest.restoreAllMocks())
const input = { incidentId: String(incidentId), teamId: String(teamId) }
describe('assignment service orchestration (isolated; no live database)', () => {
    it('creates an assignment and updates both records within the same session', async () => {
        const { incident, team } = fixtures()
        const create = jest.spyOn(Assignment, 'create').mockResolvedValue([new Assignment(input)] as never)
        const result = await assignTeam(input)
        expect(result.incidentId).toEqual(incidentId)
        expect(incident.status).toBe('ASSIGNED')
        expect(incident.assignedTeam).toEqual(teamId)
        expect(team.status).toBe('BUSY')
        expect(team.currentIncident).toEqual(incidentId)
        expect(create).toHaveBeenCalledWith([expect.objectContaining(input)], { session: expect.anything() })
        expect(incident.save).toHaveBeenCalledWith({ session: expect.anything() })
        expect(team.save).toHaveBeenCalledWith({ session: expect.anything() })
    })
    it.each([
        ['PENDING', 'BUSY', ['WATER_RESCUE'], 'unavailable'],
        ['PENDING', 'AVAILABLE', ['MEDICAL'], 'capability'],
        ['ASSIGNED', 'AVAILABLE', ['WATER_RESCUE'], 'already']
    ])('rejects invalid assignment %s %s', async (status, teamStatus, capabilities, message) => {
        fixtures(status, teamStatus, capabilities)
        await expect(assignTeam(input)).rejects.toThrow(message)
    })
    it('rejects an existing active assignment before writing', async () => {
        const { incident } = fixtures()
        jest.spyOn(Assignment, 'exists').mockReturnValue({
            session: jest.fn().mockResolvedValue({ _id: new mongoose.Types.ObjectId() })
        } as unknown as ReturnType<typeof Assignment.exists>)
        await expect(assignTeam(input)).rejects.toThrow('active assignment')
        expect(incident.save).not.toHaveBeenCalled()
    })
    it('rejects a nonexistent incident or team', async () => {
        fixtures()
        jest.spyOn(Team, 'findById').mockReturnValue({ session: jest.fn().mockResolvedValue(null) } as unknown as ReturnType<typeof Team.findById>)
        await expect(assignTeam(input)).rejects.toThrow('team not found')
        jest.spyOn(Incident, 'findById').mockReturnValue({ session: jest.fn().mockResolvedValue(null) } as unknown as ReturnType<
            typeof Incident.findById
        >)
        await expect(assignTeam(input)).rejects.toThrow('Incident not found')
    })
    it('does not mix simulated incidents with real teams', async () => {
        const { incident } = fixtures()
        incident.isSimulated = true
        await expect(assignTeam(input)).rejects.toThrow('Simulated')
    })
    it.each([
        ['IN_PROGRESS', 'RESOLVED', 'COMPLETED'],
        ['ASSIGNED', 'CANCELLED', 'CANCELLED']
    ])('releases a busy team on %s -> %s', async (from, to, final) => {
        const { incident, team } = fixtures(from, 'BUSY')
        const assignment = new Assignment(input)
        jest.spyOn(assignment, 'save').mockResolvedValue(assignment)
        jest.spyOn(Assignment, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(assignment) } as unknown as ReturnType<
            typeof Assignment.findOne
        >)
        jest.spyOn(Team, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(team) } as unknown as ReturnType<typeof Team.findOne>)
        await changeStatus(String(incidentId), to as 'RESOLVED' | 'CANCELLED')
        expect(incident.status).toBe(to)
        expect(incident.assignedTeam).toBeNull()
        expect(team.status).toBe('AVAILABLE')
        expect(team.currentIncident).toBeNull()
        expect(assignment.status).toBe(final)
        expect(assignment.completedAt).toBeInstanceOf(Date)
    })
    it('refuses to advance inconsistent assigned records', async () => {
        fixtures('ASSIGNED', 'BUSY')
        jest.spyOn(Assignment, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(null) } as unknown as ReturnType<
            typeof Assignment.findOne
        >)
        jest.spyOn(Team, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(null) } as unknown as ReturnType<typeof Team.findOne>)
        await expect(changeStatus(String(incidentId), 'IN_PROGRESS')).rejects.toThrow('inconsistent')
    })
    it('records coordinator identity and priority history without removing uncertainty', async () => {
        const { incident } = fixtures()
        await overridePriority(String(incidentId), 'CRITICAL', 'Verified worsening water conditions', String(new mongoose.Types.ObjectId()))
        expect(incident.priorityScore).toBe(75)
        expect(incident.priorityLevel).toBe('CRITICAL')
        expect(incident.priorityOverrides[0].previousPriority).toBe('HIGH')
        expect(incident.priorityOverrides[0].coordinatorId).toBeDefined()
        expect(incident.confidenceLevel).toBe('LOW')
        expect(incident.priorityReasons).toContain('Manual review')
    })
    it('reports unsupported transactions without making writes', async () => {
        const { incident } = fixtures()
        jest.spyOn(mongoose.connection, 'transaction').mockRejectedValue(
            new Error('Transaction numbers are only allowed on a replica set member or mongos')
        )
        await expect(assignTeam(input)).rejects.toThrow('replica set')
        expect(incident.save).not.toHaveBeenCalled()
    })
})
