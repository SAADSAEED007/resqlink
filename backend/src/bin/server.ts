import app from '../app'
import { bootstrap } from '../bootstrap'
import config from '../config/config'
import logger from '../handlers/logger'

void (async () => {
    try {
        await bootstrap()
        app.listen(config.PORT, () => {
            logger.info(`Application started on port ${config.PORT}`)
        }).on('error', () => {
            logger.error('Unable to listen on configured port')
            process.exit(1)
        })
    } catch {
        logger.error('Server startup failed; verify database connection and core indexes')
        process.exit(1)
    }
})()
