/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
jest.mock('../../handlers/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }))
import { Request, Response } from 'express'
import config from '../../config/config'
import { EApplicationEnvironment } from '../../constant/application'
import * as rateLimiterModule from '../../config/rate-limiter'
import rateLimiter from '../../middlewares/rateLimiter'

describe('Rate Limiter Middleware', () => {
    const originalEnv = config.ENV
    let mockReq: Partial<Request>
    let mockRes: Partial<Response>
    let nextFn: jest.Mock

    beforeEach(() => {
        mockReq = {
            ip: '127.0.0.1'
        }
        mockRes = {}
        nextFn = jest.fn()
    })

    afterEach(() => {
        config.ENV = originalEnv
        jest.restoreAllMocks()
    })

    it('bypasses rate limiting in development environment', () => {
        config.ENV = EApplicationEnvironment.DEVELOPMENT
        rateLimiter(mockReq as Request, mockRes as Response, nextFn)
        expect(nextFn).toHaveBeenCalled()
    })

    it('safely calls next() when rateLimiterMongo is null in production', () => {
        config.ENV = EApplicationEnvironment.PRODUCTION
        // Set rateLimiterMongo to null
        ;(rateLimiterModule as any).rateLimiterMongo = null

        rateLimiter(mockReq as Request, mockRes as Response, nextFn)
        expect(nextFn).toHaveBeenCalled()
    })

    it('calls next() when rateLimiterMongo consumes token successfully', async () => {
        config.ENV = EApplicationEnvironment.PRODUCTION
        const mockLimiter = {
            consume: jest.fn().mockResolvedValue({ remainingPoints: 9 })
        }
        ;(rateLimiterModule as any).rateLimiterMongo = mockLimiter

        rateLimiter(mockReq as Request, mockRes as Response, nextFn)
        await Promise.resolve()

        expect(mockLimiter.consume).toHaveBeenCalledWith('127.0.0.1', 1)
        expect(nextFn).toHaveBeenCalled()
    })

    it('passes 429 error when rate limit is exceeded', async () => {
        config.ENV = EApplicationEnvironment.PRODUCTION
        const mockLimiter = {
            consume: jest.fn().mockRejectedValue(new Error('Rate limit exceeded'))
        }
        ;(rateLimiterModule as any).rateLimiterMongo = mockLimiter

        rateLimiter(mockReq as Request, mockRes as Response, nextFn)
        await new Promise((resolve) => setTimeout(resolve, 20))

        expect(mockLimiter.consume).toHaveBeenCalledWith('127.0.0.1', 1)
        expect(nextFn).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 429
            })
        )
    })
})
