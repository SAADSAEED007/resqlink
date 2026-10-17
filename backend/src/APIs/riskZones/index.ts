import { RequestHandler, ErrorRequestHandler, Router } from 'express'
import mongoose from 'mongoose'
import asyncHandler from '../../handlers/async'
import httpResponse from '../../handlers/httpResponse'
import authenticate from '../../middlewares/authenticate'
import { IAuthenticateRequest } from '../../types/types'
import { IUserWithId } from '../user/_shared/types/users.interface'
import { EUserRoles } from '../../constant/users'
import { CustomError } from '../../utils/errors'
import * as schema from './validation'
import * as service from './risk-zones.service'
import { CommunityRiskZoneInput, FieldAssessmentInput, AssessmentStatus } from './types'

const coordinator: RequestHandler = (req, _res, next) => {
    const user = (req as IAuthenticateRequest).authenticatedUser
    if (!user || user.role !== EUserRoles.ADMIN) {
        return next(new CustomError('Coordinator (admin) access required', 403))
    }
    next()
}

const router = Router()

// All community risk zone operations are coordinator-only
router.use(authenticate, coordinator)

router.param('id', (_req, _res, next, id: string) => {
    try {
        schema.validate<string>(schema.idSchema, id)
        next()
    } catch (error) {
        next(error)
    }
})

router.post(
    '/',
    asyncHandler(async (req, res) => {
        const input = schema.validate<CommunityRiskZoneInput>(schema.riskZoneSchema, req.body)
        const data = await service.createRiskZone(input)
        httpResponse(res, req, 201, 'Community risk zone registered successfully', data)
    })
)

router.get(
    '/',
    asyncHandler(async (req, res) => {
        const query = schema.validate<service.RiskZoneQuery>(schema.riskZoneQuerySchema, req.query)
        const data = await service.listRiskZones(query)
        httpResponse(res, req, 200, 'Community risk zones retrieved', data)
    })
)

router.post(
    '/seed',
    asyncHandler(async (req, res) => {
        const data = await service.seedDemoRiskZones()
        httpResponse(res, req, 201, 'Sindh demo risk zones seeded successfully', data)
    })
)

router.get(
    '/:id',
    asyncHandler(async (req, res) => {
        const data = await service.getRiskZone(req.params.id)
        httpResponse(res, req, 200, 'Community risk zone retrieved', data)
    })
)

router.post(
    '/:id/assessment',
    asyncHandler(async (req, res) => {
        const input = schema.validate<FieldAssessmentInput>(schema.fieldAssessmentSchema, req.body)
        const user = (req as IAuthenticateRequest).authenticatedUser as IUserWithId
        const data = await service.requestFieldAssessment(req.params.id, input, String(user._id))
        httpResponse(res, req, 201, 'Field assessment requested successfully; no automatic dispatch performed', data)
    })
)

router.patch(
    '/:id/status',
    asyncHandler(async (req, res) => {
        const input = schema.validate<{ status: AssessmentStatus; notes: string }>(schema.statusUpdateSchema, req.body)
        const user = (req as IAuthenticateRequest).authenticatedUser as IUserWithId
        const data = await service.updateAssessmentStatus(req.params.id, input.status, input.notes, String(user._id))
        httpResponse(res, req, 200, 'Assessment status updated successfully', data)
    })
)

router.use((_req, _res, next) => next(new CustomError('Risk zone route not found', 404)))

export const riskZoneErrorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    void _next
    let status = error instanceof CustomError ? error.statusCode : 500
    let message = error instanceof CustomError ? error.message : 'Unexpected server error'
    if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
        status = 400
        message = 'Validation failed'
    }
    if (error instanceof mongoose.Error.VersionError) {
        status = 409
        message = 'Record changed; refresh and retry'
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        status = 409
        message = 'A demo risk zone with this key already exists'
    }
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 401) {
        status = 401
        message = 'Authentication required'
    }
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 403) {
        status = 403
        message = 'Coordinator (admin) access required'
    }
    res.status(status).json({ success: false, statusCode: status, message, errors: [] })
}

router.use(riskZoneErrorHandler)

export default router

