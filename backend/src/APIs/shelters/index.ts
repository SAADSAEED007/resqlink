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
import * as service from './shelters.service'
import { CreateShelterInput, UpdateShelterInput, CreateResourceInput, UpdateResourceInput } from './types'

const coordinator: RequestHandler = (req, _res, next) => {
    const user = (req as IAuthenticateRequest).authenticatedUser
    if (!user || user.role !== EUserRoles.ADMIN) {
        return next(new CustomError('Coordinator (admin) access required', 403))
    }
    next()
}

const router = Router()

router.param('id', (_req, _res, next, id: string) => {
    try {
        schema.validate<string>(schema.idSchema, id)
        next()
    } catch (error) {
        next(error)
    }
})

router.param('resourceId', (_req, _res, next, resourceId: string) => {
    try {
        schema.validate<string>(schema.idSchema, resourceId)
        next()
    } catch (error) {
        next(error)
    }
})

// Read APIs
router.get(
    '/',
    asyncHandler(async (req, res) => {
        const query = schema.validate<service.ShelterQuery>(schema.shelterQuerySchema, req.query)
        const data = await service.listShelters(query)
        httpResponse(res, req, 200, 'Shelters retrieved successfully', data)
    })
)

router.get(
    '/:id',
    asyncHandler(async (req, res) => {
        const data = await service.getShelterById(req.params.id)
        httpResponse(res, req, 200, 'Shelter details retrieved successfully', data)
    })
)

router.get(
    '/:id/resources',
    asyncHandler(async (req, res) => {
        const data = await service.getShelterResources(req.params.id)
        httpResponse(res, req, 200, 'Shelter relief resources retrieved successfully', data)
    })
)

// Protected Coordinator APIs
router.post(
    '/',
    authenticate,
    coordinator,
    asyncHandler(async (req, res) => {
        const input = schema.validate<CreateShelterInput>(schema.createShelterSchema, req.body)
        const user = (req as IAuthenticateRequest).authenticatedUser as IUserWithId | undefined
        const data = await service.createShelter(input, user ? String(user._id) : undefined)
        httpResponse(res, req, 201, 'Shelter created successfully', data)
    })
)

router.patch(
    '/:id',
    authenticate,
    coordinator,
    asyncHandler(async (req, res) => {
        const input = schema.validate<UpdateShelterInput>(schema.updateShelterSchema, req.body)
        const user = (req as IAuthenticateRequest).authenticatedUser as IUserWithId | undefined
        const data = await service.updateShelter(req.params.id, input)
        void user
        httpResponse(res, req, 200, 'Shelter updated successfully', data)
    })
)

router.post(
    '/:id/resources',
    authenticate,
    coordinator,
    asyncHandler(async (req, res) => {
        const input = schema.validate<CreateResourceInput>(schema.createResourceSchema, req.body)
        const user = (req as IAuthenticateRequest).authenticatedUser as IUserWithId | undefined
        const data = await service.createOrUpdateResource(req.params.id, input, user ? String(user._id) : undefined)
        httpResponse(res, req, 201, 'Relief resource added successfully', data)
    })
)

router.patch(
    '/:id/resources/:resourceId',
    authenticate,
    coordinator,
    asyncHandler(async (req, res) => {
        const input = schema.validate<UpdateResourceInput>(schema.updateResourceSchema, req.body)
        const user = (req as IAuthenticateRequest).authenticatedUser as IUserWithId | undefined
        const data = await service.updateResource(
            req.params.id,
            req.params.resourceId,
            input,
            user ? String(user._id) : undefined
        )
        httpResponse(res, req, 200, 'Relief resource updated successfully', data)
    })
)

router.post(
    '/seed',
    authenticate,
    coordinator,
    asyncHandler(async (req, res) => {
        const data = await service.seedDemoShelters()
        httpResponse(res, req, 201, 'Sindh demo shelters and relief inventories seeded successfully', data)
    })
)

router.use((_req, _res, next) => next(new CustomError('Shelter route not found', 404)))

export const shelterErrorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
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
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 11000) {
        status = 409
        message = 'A shelter with this unique key already exists'
    }
    if (typeof error === 'object' && error !== null && 'statusCode' in error && (error as { statusCode: number }).statusCode === 401) {
        status = 401
        message = 'Authentication required'
    }
    if (typeof error === 'object' && error !== null && 'statusCode' in error && (error as { statusCode: number }).statusCode === 403) {
        status = 403
        message = 'Coordinator (admin) access required'
    }
    res.status(status).json({ success: false, statusCode: status, message, errors: [] })
}

router.use(shelterErrorHandler)

export default router

