import { NextFunction, Request, Response } from 'express'
import httpResponse from '../../../handlers/httpResponse'
import responseMessage from '../../../constant/responseMessage'
import httpError from '../../../handlers/errorHandler/httpError'
import { CustomError } from '../../../utils/errors'
import { IMyUser } from './types/management.interface'

export default {
    me: (request: Request, response: Response, next: NextFunction) => {
        try {
            const { authenticatedUser } = request as unknown as IMyUser
            response.set('Cache-Control', 'no-store')
            const { _id, name, email, role } = authenticatedUser
            httpResponse(response, request, 200, responseMessage.SUCCESS, { _id, name, email, role })
        } catch (error) {
            if (error instanceof CustomError) {
                httpError(next, error, request, error.statusCode)
            } else {
                httpError(next, error, request, 500)
            }
        }
    }
}
