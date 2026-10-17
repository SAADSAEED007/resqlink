import { ErrorRequestHandler } from 'express'
import { CustomError } from '../utils/errors'

// Never expose stack traces, driver errors, request bodies, or credentials.
const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    void _next
    let status = err instanceof CustomError ? err.statusCode : 500
    if (typeof err === 'object' && err !== null) {
        if ('statusCode' in err && typeof err.statusCode === 'number') status = err.statusCode
        else if ('status' in err && typeof err.status === 'number') status = err.status
    }
    if (status < 400 || status > 599) status = 500
    const message =
        status >= 500
            ? 'Unexpected server error'
            : status === 413
              ? 'Request body exceeds 32kb limit'
              : status === 400
                ? 'Invalid request'
                : err instanceof Error
                  ? err.message
                  : 'Request failed'
    res.status(status).json({ success: false, statusCode: status, message, errors: [] })
}
export default errorHandler
