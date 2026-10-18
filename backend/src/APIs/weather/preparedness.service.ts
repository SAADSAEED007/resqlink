import { createHash } from 'crypto'
import Joi from 'joi'
import { Schema, model } from 'mongoose'
import { CustomError } from '../../utils/errors'
import { district } from './districts'
import { attention } from './attention'
import { getCachedForecast } from '../riskZones/weather.service'

export const decisionActions = ['CONTINUE_MONITORING', 'REQUEST_FIELD_ASSESSMENT', 'REVIEW_RESOURCES', 'ESCALATE_REVIEW'] as const
export const decisionInput = Joi.object({
    clientRequestId: Joi.string().guid({ version: 'uuidv4' }).required(),
    action: Joi.string()
        .valid(...decisionActions)
        .required(),
    notes: Joi.string()
        .trim()
        .min(5)
        .max(600)
        // eslint-disable-next-line no-control-regex
        .pattern(/^[^<>\u0000-\u001f]*$/)
        .required(),
    weatherRetrievedAt: Joi.string().isoDate().allow(null).required()
}).unknown(false)
export interface DecisionInput {
    clientRequestId: string
    action: (typeof decisionActions)[number]
    notes: string
    weatherRetrievedAt: string | null
}
const snapshot = new Schema(
    {
        provider: { type: String, default: null },
        retrievedAt: { type: String, default: null },
        observationTime: { type: String, default: null },
        freshness: { type: String, enum: ['fresh', 'cached', 'stale', 'unavailable'], required: true },
        precipitationMm: { type: Number, default: null },
        intervalStart: { type: String, default: null },
        intervalEnd: { type: String, default: null },
        attention: { type: String, enum: ['ROUTINE', 'ELEVATED', 'URGENT_REVIEW', 'DATA_UNAVAILABLE'], required: true }
    },
    { _id: false }
)
export const PreparednessDecision = model(
    'PreparednessDecision',
    new Schema(
        {
            districtId: { type: String, required: true, index: true },
            districtName: { type: String, required: true },
            latitude: { type: Number, required: true },
            longitude: { type: Number, required: true },
            coordinatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            clientRequestId: { type: String, required: true },
            requestHash: { type: String, required: true, select: false },
            action: { type: String, enum: decisionActions, required: true },
            notes: { type: String, required: true, maxlength: 600 },
            status: { type: String, enum: ['RECORDED'], default: 'RECORDED', required: true },
            weatherEvidence: { type: snapshot, required: true }
        },
        { timestamps: true }
    )
        .index({ coordinatorId: 1, clientRequestId: 1 }, { unique: true })
        .index({ districtId: 1, createdAt: -1 })
)

export function listDecisions(districtId: string) {
    district(districtId)
    return PreparednessDecision.find({ districtId }).sort({ createdAt: -1 }).limit(20).lean()
}
export async function recordDecision(districtId: string, input: DecisionInput, coordinatorId: string) {
    const record = district(districtId)
    await PreparednessDecision.init()
    const lookup = { coordinatorId, clientRequestId: input.clientRequestId }
    const requestHash = createHash('sha256')
        .update(JSON.stringify({ districtId, action: input.action, notes: input.notes, weatherRetrievedAt: input.weatherRetrievedAt }))
        .digest('hex')
    async function replay() {
        const existing = await PreparednessDecision.findOne(lookup).select('+requestHash')
        if (existing && existing.requestHash !== requestHash) throw new CustomError('Decision request ID was already used for different content', 409)
        return existing
    }
    const existing = await replay()
    if (existing) return existing
    // Decisions record existing evidence; they never trigger a provider request.
    const weather = getCachedForecast(record.latitude, record.longitude)
    if ((weather?.retrievedAt || null) !== input.weatherRetrievedAt)
        throw new CustomError('Weather evidence changed or expired. Refresh and review before recording a decision.', 409)
    try {
        return await PreparednessDecision.create({
            ...lookup,
            requestHash,
            districtId,
            districtName: record.name,
            latitude: record.latitude,
            longitude: record.longitude,
            action: input.action,
            notes: input.notes,
            status: 'RECORDED',
            weatherEvidence: {
                provider: weather?.provider || null,
                retrievedAt: weather?.retrievedAt || null,
                observationTime: weather?.current.time || null,
                freshness: weather?.freshness || 'unavailable',
                precipitationMm: weather?.next24Hours.precipitationMm ?? null,
                intervalStart: weather?.next24Hours.start || null,
                intervalEnd: weather?.next24Hours.end || null,
                attention: attention(weather).level
            }
        })
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
            const value = await replay()
            if (value) return value
        }
        throw error
    }
}
