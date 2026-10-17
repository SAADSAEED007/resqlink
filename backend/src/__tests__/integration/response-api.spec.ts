/* Supertest response.body and Jest asymmetric matchers are intentionally dynamic. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
jest.mock('../../handlers/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }))
import mongoose from 'mongoose'
import request from 'supertest'
import { randomBytes } from 'crypto'
import bcrypt from 'bcrypt'
import app from '../../app'
import config from '../../config/config'
import jwt from '../../utils/jwt'
import User from '../../APIs/user/_shared/models/user.model'
import Incident from '../../APIs/response/models/incident.model'
import Team from '../../APIs/response/models/team.model'
import Assignment from '../../APIs/response/models/assignment.model'
import { ensureIndexes } from '../../APIs/response/response.service'

// Opt-in only. Never fall back to DATABASE_URL or allow an application database.
const uri = process.env.TEST_DATABASE_URL
const integration = uri ? describe : describe.skip
integration('core API with real MongoDB transactions', () => {
    let cookie: string
    let ordinaryCookie: string
    beforeAll(async () => {
        if (!uri || !/^resqlink_core_test_[a-f0-9]+$/.test(new URL(uri).pathname.slice(1)))
            throw new Error('TEST_DATABASE_URL must name an isolated resqlink_core_test_<hex> database')
        config.ENV = 'development'
        config.SERVER_URL = 'http://127.0.0.1'
        config.TOKENS.REFRESH.SECRET = randomBytes(32).toString('hex')
        config.TOKENS.ACCESS.SECRET = randomBytes(32).toString('hex')
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
        await ensureIndexes()
        const makeUser = async (role: 'admin' | 'user') =>
            User.create({
                name: 'SIMULATED test coordinator',
                email: `${role}@example.com`,
                phoneNumber: { isoCode: 'PK', countryCode: '92', internationalNumber: '+920000000000' },
                timezone: 'Asia/Karachi',
                password: await bcrypt.hash('Demo!Pass123', 4),
                role,
                consent: true,
                accountConfimation: { status: true }
            })
        const admin = await makeUser('admin')
        const user = await makeUser('user')
        cookie = `accessToken=${jwt.generateToken({ userId: String(admin._id) }, config.TOKENS.ACCESS.SECRET, 3600)}`
        ordinaryCookie = `accessToken=${jwt.generateToken({ userId: String(user._id) }, config.TOKENS.ACCESS.SECRET, 3600)}`
    }, 30000)
    afterAll(async () => {
        // Only this explicitly named test database is eligible for cleanup.
        if (uri && /^resqlink_core_test_[a-f0-9]+$/.test(mongoose.connection.name || '')) await mongoose.connection.dropDatabase()
        await mongoose.disconnect()
    }, 30000)
    const incidentInput = {
        reporterName: 'SIMULATED report',
        emergencyType: 'FLOOD',
        description: 'SIMULATED flood scenario for integration verification',
        peopleAffected: 3,
        immediateDanger: true,
        waterLevel: 'HIGH'
    }
    const teamInput = {
        name: 'SIMULATED boat crew',
        teamCode: 'TEST-BOAT',
        capabilities: ['WATER_RESCUE'],
        capacity: 6,
        location: { latitude: 24.86, longitude: 67.01 }
    }
    it('reuses real login cookies across /v1 and /api without returning password hashes', async () => {
        const agent = request.agent(app)
        const login = await agent.post('/v1/login').send({ email: 'admin@example.com', password: 'Demo!Pass123' })
        expect(login.status).toBe(200)
        expect(login.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringContaining('Path=/;')]))
        expect(login.body.data.user.password).toBeUndefined()
        expect((await agent.get('/api/incidents')).status).toBe(200)
    })
    it('protects coordinator data and operations with existing cookie authentication', async () => {
        expect((await request(app).get('/api/incidents')).status).toBe(401)
        expect((await request(app).get('/api/incidents').set('Cookie', 'accessToken=invalid')).status).toBe(401)
        expect((await request(app).get('/api/incidents').set('Cookie', ordinaryCookie)).status).toBe(403)
        expect((await request(app).get('/api/incidents').set('Cookie', cookie)).status).toBe(200)
    })
    it('creates public SOS, validates IDs, flags missing location, and enforces body limits', async () => {
        const created = await request(app).post('/api/incidents').send(incidentInput)
        expect(created.status).toBe(201)
        expect(created.body.data.location).toBeNull()
        expect(created.body.data.locationVerificationRequired).toBe(true)
        expect(created.body.data.confidenceLevel).toBe('LOW')
        expect((await request(app).get(`/api/incidents/${created.body.data._id}`).set('Cookie', cookie)).status).toBe(200)
        expect((await request(app).get('/api/incidents/not-an-id').set('Cookie', cookie)).status).toBe(400)
        expect(
            (
                await request(app)
                    .get(`/api/incidents/${String(new mongoose.Types.ObjectId())}`)
                    .set('Cookie', cookie)
            ).status
        ).toBe(404)
        expect(
            (
                await request(app)
                    .post('/api/incidents')
                    .send({ ...incidentInput, location: { latitude: 100, longitude: 67 } })
            ).status
        ).toBe(400)
        const large = await request(app)
            .post('/api/incidents')
            .send({ ...incidentInput, description: 'x'.repeat(40000) })
        expect(large.status).toBe(413)
        expect(large.body.trace).toBeUndefined()
        const recommendations = await request(app).get(`/api/incidents/${created.body.data._id}/recommendations`).set('Cookie', cookie)
        expect(recommendations.body.data.manualSelectionRequired).toBe(true)
        expect(recommendations.body.data.items).toEqual([])
    })
    it('allows only one coordinator to claim a team concurrently and releases it on resolution', async () => {
        const a = await request(app).post('/api/incidents').send(incidentInput)
        const b = await request(app).post('/api/incidents').send(incidentInput)
        const team = await request(app).post('/api/rescue-teams').set('Cookie', cookie).send(teamInput)
        expect(team.status).toBe(201)
        const attempts = await Promise.all(
            [a, b].map((incident) =>
                request(app).post('/api/assignments').set('Cookie', cookie).send({ incidentId: incident.body.data._id, teamId: team.body.data._id })
            )
        )
        expect(attempts.map((value) => value.status).sort()).toEqual([201, 409])
        const winner = attempts.find((value) => value.status === 201)!
        const id = String(winner.body.data.incidentId)
        expect(await Assignment.countDocuments({ teamId: team.body.data._id, status: 'ACTIVE' })).toBe(1)
        expect((await Team.findById(team.body.data._id))?.status).toBe('BUSY')
        expect((await request(app).patch(`/api/incidents/${id}/status`).set('Cookie', cookie).send({ status: 'RESOLVED' })).status).toBe(409)
        expect((await request(app).patch(`/api/incidents/${id}/status`).set('Cookie', cookie).send({ status: 'IN_PROGRESS' })).status).toBe(200)
        expect((await request(app).patch(`/api/incidents/${id}/status`).set('Cookie', cookie).send({ status: 'RESOLVED' })).status).toBe(200)
        expect((await Team.findById(team.body.data._id))?.currentIncident).toBeNull()
        expect((await Team.findById(team.body.data._id))?.status).toBe('AVAILABLE')
        expect((await Assignment.findById(winner.body.data._id))?.status).toBe('COMPLETED')
    }, 30000)
    it('ranks only available capable teams by approximate distance and warns on capacity', async () => {
        const far = await request(app)
            .post('/api/rescue-teams')
            .set('Cookie', cookie)
            .send({ ...teamInput, teamCode: 'TEST-FAR', capacity: 1, location: { latitude: 25.2, longitude: 67.4 } })
        expect(far.status).toBe(201)
        await request(app)
            .post('/api/rescue-teams')
            .set('Cookie', cookie)
            .send({ ...teamInput, teamCode: 'TEST-OFFLINE', status: 'OFFLINE' })
        await request(app)
            .post('/api/rescue-teams')
            .set('Cookie', cookie)
            .send({ ...teamInput, teamCode: 'TEST-MEDICAL', capabilities: ['MEDICAL'] })
        const incident = await request(app)
            .post('/api/incidents')
            .send({ ...incidentInput, location: { latitude: 24.86, longitude: 67.01 } })
        const result = await request(app).get(`/api/incidents/${incident.body.data._id}/recommendations`).set('Cookie', cookie)
        expect(result.status).toBe(200)
        const recommended = result.body.data.items as { team: { teamCode: string } }[]
        expect(recommended.map((item) => item.team.teamCode)).toEqual(['TEST-BOAT', 'TEST-FAR'])
        expect(result.body.data.items[0].approximateDistanceKm).toBe(0)
        expect(result.body.data.items[1].capacityWarning).toMatch(/Capacity below/)
        expect(await Assignment.countDocuments({ incidentId: incident.body.data._id })).toBe(0)
    })
    it('records priority audit and filters with pagination', async () => {
        const created = await request(app).post('/api/incidents').send(incidentInput)
        const updated = await request(app)
            .patch(`/api/incidents/${created.body.data._id}/priority`)
            .set('Cookie', cookie)
            .send({ priorityLevel: 'CRITICAL', reason: 'SIMULATED coordinator review' })
        expect(updated.status).toBe(200)
        expect(updated.body.data.priorityOverrides).toHaveLength(1)
        const list = await request(app).get('/api/incidents?priorityLevel=CRITICAL&status=PENDING&limit=1').set('Cookie', cookie)
        expect(list.status).toBe(200)
        expect(list.body.data.items).toHaveLength(1)
        expect(list.body.data.pagination.limit).toBe(1)
        expect((await request(app).get('/api/incidents?status=INVALID').set('Cookie', cookie)).status).toBe(400)
        expect((await Incident.findById(created.body.data._id))?.priorityLevel).toBe('CRITICAL')
    })
})
