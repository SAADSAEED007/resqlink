import { Request } from 'express'
import { IAuthenticateRequest, IDecryptedJwt } from '../types/types'
import jwt from '../utils/jwt'
import config from '../config/config'
import query from '../APIs/user/_shared/repo/user.repository'
import asyncHandler from '../handlers/async'
import { CustomError } from '../utils/errors'

export default asyncHandler(async (request: Request, _response, next) => {
    const req = request as IAuthenticateRequest
    const cookies = req.cookies as { accessToken?: string } | undefined
    if (!cookies?.accessToken) throw new CustomError('Authentication required', 401)
    let payload: IDecryptedJwt
    try {
        payload = jwt.verifyToken(cookies.accessToken, config.TOKENS.ACCESS.SECRET) as IDecryptedJwt
    } catch {
        throw new CustomError('Invalid or expired access token', 401)
    }
    if (!payload || typeof payload.userId !== 'string' || !/^[a-fA-F0-9]{24}$/.test(payload.userId))
        throw new CustomError('Invalid access token', 401)
    const user = await query.findUserById(payload.userId)
    if (!user) throw new CustomError('Authentication required', 401)
    req.authenticatedUser = user
    next()
})
