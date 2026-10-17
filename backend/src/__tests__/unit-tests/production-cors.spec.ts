jest.mock('../../handlers/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }))

import request from 'supertest'
import app from '../../app'
import config from '../../config/config'

describe('production CORS policy', () => {
    const frontend = 'https://resqlink-drab.vercel.app'
    const originalProduction = config.IS_PRODUCTION
    const originalOrigins = config.TRUSTED_ORIGINS

    beforeEach(() => {
        config.IS_PRODUCTION = true
        config.TRUSTED_ORIGINS = [frontend]
    })

    afterAll(() => {
        config.IS_PRODUCTION = originalProduction
        config.TRUSTED_ORIGINS = originalOrigins
    })

    it('allows the configured frontend with credentialed CORS', async () => {
        const response = await request(app).get('/v1/health').set('Origin', frontend)
        expect(response.status).toBe(200)
        expect(response.headers['access-control-allow-origin']).toBe(frontend)
        expect(response.headers['access-control-allow-credentials']).toBe('true')
    })

    it('handles an authenticated-route preflight before route authentication', async () => {
        const response = await request(app)
            .options('/v1/logout')
            .set('Origin', frontend)
            .set('Access-Control-Request-Method', 'PUT')
            .set('Access-Control-Request-Headers', 'content-type')
        expect(response.status).toBe(204)
        expect(response.headers['access-control-allow-origin']).toBe(frontend)
        expect(response.headers['access-control-allow-credentials']).toBe('true')
        expect(response.headers['access-control-allow-methods']).toContain('PUT')
    })

    it('rejects arbitrary browser origins', async () => {
        const response = await request(app).get('/v1/health').set('Origin', 'https://attacker.example')
        expect(response.status).toBe(403)
        expect(response.headers['access-control-allow-origin']).toBeUndefined()
    })
})
