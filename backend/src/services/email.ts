import { Resend } from 'resend'
import config from '../config/config'
import logger from '../handlers/logger'

const resend = config.EMAIL_API_KEY ? new Resend(config.EMAIL_API_KEY) : null

export default {
    sendEmail: async (to: string[], subject: string, text: string) => {
        if (!resend) {
            logger.warn('Email sending skipped: EMAIL_SERVICE_API_KEY is not configured.')
            return
        }

        await resend.emails.send({
            from: `Coderatory <onboarding@resend.dev>`,
            to,
            subject,
            text
        })
    }
}
