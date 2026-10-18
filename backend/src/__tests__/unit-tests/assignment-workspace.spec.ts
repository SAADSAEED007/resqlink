/* Mongoose query mocks use structural doubles rather than live query objects. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
import Incident from '../../APIs/response/models/incident.model'
import Assignment from '../../APIs/response/models/assignment.model'
import { listIncidents, listAssignments } from '../../APIs/response/response.service'
import { validate, incidentQuerySchema, assignmentQuerySchema } from '../../APIs/response/validation'

describe('Assignment workspace query accuracy', () => {
    afterEach(() => jest.restoreAllMocks())
    function chain() {
        return { populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) }
    }
    it('counts all matching unassigned records and escapes literal search characters', async () => {
        jest.spyOn(Incident, 'find').mockReturnValue(chain() as any)
        jest.spyOn(Incident, 'countDocuments').mockResolvedValue(250)
        const result = await listIncidents({ page: 2, limit: 6, sort: 'priority', unassigned: true, isSimulated: false, search: 'Road (A)' })
        expect(result.pagination.total).toBe(250)
        expect(Incident.find).toHaveBeenCalledWith({ status: 'PENDING', assignedTeam: null, isSimulated: false, $or: [{ description: { $regex: 'Road \\(A\\)', $options: 'i' } }, { 'location.address': { $regex: 'Road \\(A\\)', $options: 'i' } }] })
        expect(Incident.countDocuments).toHaveBeenCalledWith((Incident.find as jest.Mock).mock.calls[0][0])
    })
    it('counts completion timestamps within the half-open Karachi reporting day', async () => {
        const query = chain()
        jest.spyOn(Assignment, 'find').mockReturnValue(query as any)
        jest.spyOn(Assignment, 'countDocuments').mockResolvedValue(42)
        const from = new Date('2026-10-17T19:00:00Z'), before = new Date('2026-10-18T19:00:00Z')
        const result = await listAssignments({ page: 1, limit: 1, status: 'COMPLETED', isSimulated: false, completedFrom: from, completedBefore: before, sort: 'completed' })
        expect(Assignment.find).toHaveBeenCalledWith({ status: 'COMPLETED', isSimulated: false, completedAt: { $gte: from, $lt: before } })
        expect(query.sort).toHaveBeenCalledWith({ completedAt: -1, _id: 1 })
        expect(result.pagination.total).toBe(42)
    })
    it('rejects invalid dates, reversed windows and injected search objects', () => {
        expect(() => validate(assignmentQuerySchema, { completedFrom: 'yesterday' })).toThrow()
        expect(() => validate(assignmentQuerySchema, { completedFrom: '2026-10-18T19:00:00Z', completedBefore: '2026-10-17T19:00:00Z' })).toThrow()
        expect(() => validate(incidentQuerySchema, { search: { $ne: '' } })).toThrow()
        expect(() => validate(incidentQuerySchema, { limit: 101 })).toThrow()
    })
})
