import { Router, RequestHandler } from 'express'
import authenticate from '../../middlewares/authenticate'
import asyncHandler from '../../handlers/async'
import httpResponse from '../../handlers/httpResponse'
import { IAuthenticateRequest } from '../../types/types'
import { IUserWithId } from '../user/_shared/types/users.interface'
import { EUserRoles } from '../../constant/users'
import { CustomError } from '../../utils/errors'
import { riskZoneErrorHandler } from '../riskZones'
import { district, districts, DATASET_VERSION } from './districts'
import { districtWeather, overview, districtAnalysis } from './monitoring.service'
import { decisionInput, DecisionInput, listDecisions, recordDecision } from './preparedness.service'
import { validate } from '../riskZones/validation'
const router = Router()
const coordinator: RequestHandler = (req, _res, next) => {
    const user = (req as IAuthenticateRequest).authenticatedUser
    if (!user || user.role !== EUserRoles.ADMIN) return next(new CustomError('Coordinator access required', 403))
    next()
}
router.use(authenticate, coordinator)
router.get(
    '/districts',
    asyncHandler(async (req, res) => {
        await Promise.resolve()
        httpResponse(res, req, 200, 'Configured Sindh monitoring locations', {
            items: districts,
            datasetVersion: DATASET_VERSION,
            coverage: 'Seven verified districts; partial Sindh coverage.'
        })
    })
)
router.get(
    '/districts/overview',
    asyncHandler(async (req, res) => {
        res.setHeader('Cache-Control', 'no-store')
        httpResponse(res, req, 200, 'District forecast overview', await overview())
    })
)
router.param('districtId', (_req, _res, next, id: string) => {
    try {
        district(id)
        next()
    } catch (e) {
        next(e)
    }
})
router.get(
    '/districts/:districtId',
    asyncHandler(async (req, res) => {
        httpResponse(res, req, 200, 'District forecast', await districtWeather(req.params.districtId))
    })
)
const requests = new Map<string, number[]>(),
    running = new Set<string>()
router.get(
    '/districts/:districtId/decisions',
    asyncHandler(async (req, res) => {
        httpResponse(res, req, 200, 'Recorded preparedness decisions', await listDecisions(req.params.districtId))
    })
)
router.post(
    '/districts/:districtId/decisions',
    asyncHandler(async (req, res) => {
        const input = validate<DecisionInput>(decisionInput, req.body)
        const user = (req as IAuthenticateRequest).authenticatedUser as IUserWithId
        const value = await recordDecision(req.params.districtId, input, String(user._id))
        const { requestHash, ...data } = value.toObject()
        void requestHash
        httpResponse(
            res,
            req,
            201,
            'Coordinator decision recorded. No incident, team dispatch or field assessment was created by this decision.',
            data
        )
    })
)
router.post(
    '/districts/:districtId/ai-analysis',
    asyncHandler(async (req, res) => {
        if (Object.keys((req.body || {}) as Record<string, unknown>).length) throw new CustomError('Custom prompts are not accepted', 400)
        const user = (req as IAuthenticateRequest).authenticatedUser as IUserWithId,
            key = String(user._id),
            times = (requests.get(key) || []).filter((t) => Date.now() - t < 600000)
        if (times.length >= 5 || running.has(key)) throw new CustomError('Analysis request limit reached; retry later', 429)
        if (requests.size >= 1000) requests.delete(requests.keys().next().value as string)
        requests.set(key, [...times, Date.now()])
        running.add(key)
        try {
            httpResponse(res, req, 200, 'District preparedness analysis', await districtAnalysis(req.params.districtId))
        } finally {
            running.delete(key)
        }
    })
)
router.use(riskZoneErrorHandler)
export default router
