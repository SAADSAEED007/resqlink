import { RequestHandler, ErrorRequestHandler, Router } from 'express'
import mongoose from 'mongoose'
import asyncHandler from '../../handlers/async'
import httpResponse from '../../handlers/httpResponse'
import authenticate from '../../middlewares/authenticate'
import rateLimiter from '../../middlewares/rateLimiter'
import { IAuthenticateRequest } from '../../types/types'
import { IUserWithId } from '../user/_shared/types/users.interface'
import { EUserRoles } from '../../constant/users'
import { CustomError } from '../../utils/errors'
import * as schema from './validation'
import * as service from './response.service'
import * as dashboardService from './dashboard.service'
import { IncidentInput, TeamInput, TeamUpdateInput, IncidentStatus, Priority, VerificationStatus, DashboardQuery, ActivityQuery, IncidentActivityQuery } from './types'

const coordinator: RequestHandler = (req, _res, next) => {
    const user = (req as IAuthenticateRequest).authenticatedUser
    if (user.role !== EUserRoles.ADMIN) return next(new CustomError('Coordinator (admin) access required', 403))
    next()
}
// Keep controller responses consistent with the existing response utility.
const router = Router()
router.post(
    '/incidents',
    rateLimiter,
    asyncHandler(async (req, res) => {
        const input = schema.validate<IncidentInput>(schema.incidentSchema, req.body)
        const data = await service.createIncident(input)
        httpResponse(res, req, 201, 'Incident created successfully', data)
    })
)
router.use(authenticate, coordinator)
router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    next()
})
router.get(
    '/dashboard/summary',
    asyncHandler(async (req, res) => {
        const query = schema.validate<DashboardQuery>(schema.dashboardQuerySchema, req.query)
        httpResponse(res, req, 200, 'Dashboard summary retrieved', await dashboardService.getDashboardSummary(query))
    })
)
router.get(
    '/dashboard/stats',
    asyncHandler(async (req, res) => {
        const query = schema.validate<DashboardQuery>(schema.dashboardQuerySchema, req.query)
        httpResponse(res, req, 200, 'Dashboard summary retrieved', await dashboardService.getDashboardSummary(query))
    })
)
router.get(
    '/dashboard/activity',
    asyncHandler(async (req, res) => {
        const query = schema.validate<ActivityQuery>(schema.activityQuerySchema, req.query)
        httpResponse(res, req, 200, 'Dashboard activity retrieved', await dashboardService.getDashboardActivity(query))
    })
)
router.get(
    '/incidents',
    asyncHandler(async (req, res) => {
        const query = schema.validate<service.IncidentQuery>(schema.incidentQuerySchema, req.query)
        httpResponse(res, req, 200, 'Incidents retrieved', await service.listIncidents(query))
    })
)
router.param('id', (_req, _res, next, id: string) => {
    try {
        schema.validate<string>(schema.idSchema, id)
        next()
    } catch (error) {
        next(error)
    }
})
router.get(
    '/incidents/:id',
    asyncHandler(async (req, res) => {
        httpResponse(res, req, 200, 'Incident retrieved', await service.getIncident(req.params.id))
    })
)
router.get(
    '/incidents/:id/activity',
    asyncHandler(async (req, res) => {
        const query = schema.validate<IncidentActivityQuery>(schema.incidentActivityQuerySchema, req.query)
        httpResponse(res, req, 200, 'Incident activity retrieved', await dashboardService.getIncidentActivity(req.params.id, query))
    })
)
router.get(
    '/incidents/:id/recommendations',
    asyncHandler(async (req, res) => {
        httpResponse(res, req, 200, 'Team recommendations', await service.recommendTeams(req.params.id))
    })
)
router.patch(
    '/incidents/:id/status',
    asyncHandler(async (req, res) => {
        const input = schema.validate<{ status: IncidentStatus }>(schema.statusSchema, req.body)
        const user = (req as IAuthenticateRequest).authenticatedUser as IUserWithId
        httpResponse(res, req, 200, 'Incident status updated', await service.changeStatus(req.params.id, input.status, user ? String(user._id) : undefined))
    })
)
router.patch(
    '/incidents/:id/priority',
    asyncHandler(async (req, res) => {
        const input = schema.validate<{ priorityLevel: Priority; reason: string }>(schema.prioritySchema, req.body)
        const user = (req as IAuthenticateRequest).authenticatedUser as IUserWithId
        httpResponse(
            res,
            req,
            200,
            'Incident priority updated',
            await service.overridePriority(req.params.id, input.priorityLevel, input.reason, String(user._id))
        )
    })
)
router.patch(
    '/incidents/:id/verification',
    asyncHandler(async (req, res) => {
        const input = schema.validate<{ status: VerificationStatus; notes: string }>(schema.verificationUpdateSchema, req.body)
        const user = (req as IAuthenticateRequest).authenticatedUser as IUserWithId
        httpResponse(
            res,
            req,
            200,
            'Incident verification updated',
            await service.updateVerification(req.params.id, input.status, input.notes, String(user._id))
        )
    })
)
router.get(
    '/rescue-teams',
    asyncHandler(async (req, res) => {
        httpResponse(res, req, 200, 'Rescue teams retrieved', await service.listTeams(schema.validate(schema.teamQuerySchema, req.query)))
    })
)
router.get(
    '/rescue-teams/:id',
    asyncHandler(async (req, res) => {
        httpResponse(res, req, 200, 'Rescue team retrieved', await service.getTeam(req.params.id))
    })
)
router.post(
    '/rescue-teams',
    asyncHandler(async (req, res) => {
        httpResponse(res, req, 201, 'Rescue team created', await service.createTeam(schema.validate<TeamInput>(schema.teamSchema, req.body)))
    })
)
router.patch(
    '/rescue-teams/:id',
    asyncHandler(async (req, res) => {
        const input = schema.validate<TeamUpdateInput>(schema.teamUpdateSchema, req.body)
        httpResponse(res, req, 200, 'Rescue team updated', await service.updateTeam(req.params.id, input))
    })
)
router.get(
    '/assignments',
    asyncHandler(async (req, res) => {
        httpResponse(res, req, 200, 'Assignments retrieved', await service.listAssignments(schema.validate(schema.assignmentQuerySchema, req.query)))
    })
)
router.get(
    '/assignments/:id',
    asyncHandler(async (req, res) => {
        httpResponse(res, req, 200, 'Assignment retrieved', await service.getAssignment(req.params.id))
    })
)
router.post(
    '/assignments',
    asyncHandler(async (req, res) => {
        httpResponse(
            res,
            req,
            201,
            'Team assigned; no real emergency dispatch performed',
            await service.assignTeam(schema.validate(schema.assignmentSchema, req.body))
        )
    })
)
router.use((_req, _res, next) => next(new CustomError('API route not found', 404)))
export const coreErrorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
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
        message = 'An active assignment or unique team/demo code already exists'
    }
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 401) {
        status = 401
        message = 'Authentication required'
    }
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 429) {
        status = 429
        message = 'Too many requests'
    }
    res.status(status).json({ success: false, statusCode: status, message, errors: [] })
}
router.use(coreErrorHandler)
export default router
