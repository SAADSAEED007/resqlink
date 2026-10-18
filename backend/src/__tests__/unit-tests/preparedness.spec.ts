jest.mock('../../handlers/logger', () => ({ __esModule: true, default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }))
jest.mock('../../middlewares/authenticate', () => ({
    __esModule: true,
    default: (req: Request, res: Response, next: NextFunction) => {
        const role = req.headers['x-test-role']
        if (!role) return res.status(401).json({ message: 'Authentication required' })
        Object.assign(req, { authenticatedUser: { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role } })
        return next()
    }
}))
import express, { Request, Response, NextFunction } from 'express'
import request from 'supertest'
import router from '../../APIs/weather'
import { decisionInput, PreparednessDecision, recordDecision, DecisionInput } from '../../APIs/weather/preparedness.service'
import { clearWeatherCache } from '../../APIs/riskZones/weather.service'
const app = express()
app.use(express.json())
app.use('/api/weather', router)
const coordinator = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const input: DecisionInput = {
    clientRequestId: '79ec292c-ff15-4263-b340-2efec449373c',
    action: 'CONTINUE_MONITORING',
    notes: 'Review local assessment records before further action.',
    weatherRetrievedAt: null
}
function lookup(value: unknown) {
    jest.spyOn(PreparednessDecision, 'findOne').mockReturnValue({ select: () => Promise.resolve(value) } as unknown as ReturnType<
        typeof PreparednessDecision.findOne
    >)
}
beforeEach(() => {
    jest.spyOn(PreparednessDecision, 'init').mockResolvedValue(new PreparednessDecision())
    clearWeatherCache()
    lookup(null)
})
afterEach(() => {
    jest.restoreAllMocks()
})
test.each([
    { ...input, action: 'DISPATCH_TEAM' },
    { ...input, coordinatorId: 'bbbbbbbbbbbbbbbbbbbbbbbb' },
    { ...input, clientRequestId: 'not-a-uuid' },
    { ...input, notes: '<script>bad</script>' },
    { ...input, notes: 'tiny' },
    { ...input, weatherRetrievedAt: 'invalid' }
])('rejects invalid or spoofed decision input %#', (value) => {
    expect(decisionInput.validate(value).error).toBeDefined()
})
test('requires authentication and coordinator authorization for both reads and writes', async () => {
    for (const path of ['/api/weather/districts/hyderabad/decisions']) {
        await request(app).get(path).expect(401)
        await request(app).post(path).send(input).expect(401)
        await request(app).get(path).set('x-test-role', 'user').expect(403)
        await request(app).post(path).set('x-test-role', 'user').send(input).expect(403)
    }
})
test('records trusted actor, coordinates and unavailable evidence only after persistence resolves', async () => {
    const create = jest.spyOn(PreparednessDecision, 'create').mockImplementation((value) => Promise.resolve(new PreparednessDecision(value)) as never)
    const value = await recordDecision('hyderabad', input, coordinator)
    await value.validate()
    expect(String(value.coordinatorId)).toBe(coordinator)
    expect(value.latitude).toBe(25.39689)
    expect(value.status).toBe('RECORDED')
    expect(value.weatherEvidence).toMatchObject({ provider: null, precipitationMm: null, attention: 'DATA_UNAVAILABLE', freshness: 'unavailable' })
    expect(create).toHaveBeenCalledTimes(1)
})
test('does not report success when database persistence rejects', async () => {
    jest.spyOn(PreparednessDecision, 'create').mockRejectedValue(new Error('database unavailable'))
    await expect(recordDecision('hyderabad', input, coordinator)).rejects.toThrow('database unavailable')
})
test('rejects changed/expired evidence rather than recording a mismatched snapshot', async () => {
    const create = jest.spyOn(PreparednessDecision, 'create')
    await expect(recordDecision('hyderabad', { ...input, weatherRetrievedAt: new Date().toISOString() }, coordinator)).rejects.toMatchObject({
        statusCode: 409
    })
    expect(create).not.toHaveBeenCalled()
})
test('replays identical requests without creating duplicate decisions', async () => {
    const create = jest.spyOn(PreparednessDecision, 'create').mockImplementation((value) => Promise.resolve(new PreparednessDecision(value)) as never)
    const first = await recordDecision('hyderabad', input, coordinator)
    lookup(first)
    const second = await recordDecision('hyderabad', input, coordinator)
    expect(second._id).toEqual(first._id)
    expect(create).toHaveBeenCalledTimes(1)
    await expect(
        recordDecision('hyderabad', { ...input, notes: 'A different reason cannot reuse the same request identifier.' }, coordinator)
    ).rejects.toMatchObject({ statusCode: 409 })
})
test('decision API excludes internal hash and cannot accept a team/incident dispatch payload', async () => {
    jest.spyOn(PreparednessDecision, 'create').mockImplementation((value) => Promise.resolve(new PreparednessDecision(value)) as never)
    const response = await request(app).post('/api/weather/districts/hyderabad/decisions').set('x-test-role', 'admin').send(input).expect(201)
    const body = response.body as { data: { requestHash?: string; action: string } }
    expect(body.data.requestHash).toBeUndefined()
    expect(body.data.action).toBe('CONTINUE_MONITORING')
    await request(app)
        .post('/api/weather/districts/hyderabad/decisions')
        .set('x-test-role', 'admin')
        .send({ ...input, teamId: 'bbbbbbbbbbbbbbbbbbbbbbbb', incidentId: 'cccccccccccccccccccccccc' })
        .expect(400)
})
