import dotenvFlow from 'dotenv-flow'

dotenvFlow.config()

const isProduction = process.env.NODE_ENV === 'production' || process.env.ENV === 'production'
const configuredOrigins = [process.env.FRONTEND_URL, process.env.CORS_ALLOWED_ORIGINS]
    .flatMap((value) => (value || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new URL(value).origin)
const trustedOrigins = Array.from(new Set([...configuredOrigins, ...(isProduction ? [] : ['http://localhost:3000'])]))

export default {
    // General
    ENV: process.env.ENV,
    IS_PRODUCTION: isProduction,
    PORT: process.env.PORT,
    SERVER_URL: process.env.SERVER_URL,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    TRUSTED_ORIGINS: trustedOrigins,

    // Database
    DATABASE_URL: process.env.DATABASE_URL,

    //Email
    EMAIL_API_KEY: process.env.EMAIL_SERVICE_API_KEY,

    //Tokens
    TOKENS: {
        ACCESS: {
            SECRET: process.env.ACCESS_TOKEN_SECRET as string,
            EXPIRY: 3600
        },
        REFRESH: {
            SECRET: process.env.REFRESH_TOKEN_SECRET as string,
            EXPIRY: 3600 * 24 * 365
        }
    }
}
