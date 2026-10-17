import responseRouter from './APIs/response'
import riskZonesRouter from './APIs/riskZones'
import config from './config/config'
import express, { Application } from 'express'
import path from 'path'
import router from './APIs'
import errorHandler from './middlewares/errorHandler'
import notFound from './handlers/notFound'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'

const app: Application = express()

//Middlewares
app.use(helmet())
app.use(cookieParser())
app.use(
    cors({
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'HEAD', 'PUT', 'PATCH'],
        origin: [config.FRONTEND_URL],
        credentials: true
    })
)
app.use(express.json({ limit: '32kb' }))
app.use(express.static(path.join(__dirname, '../', 'public')))

//Router
// app.use('/v1', router)
app.use('/api/community-risk-zones', riskZonesRouter)
app.use('/api', responseRouter)
router(app)

//404 handler
app.use(notFound)

//Handlers as Middlewares
app.use(errorHandler)

export default app
