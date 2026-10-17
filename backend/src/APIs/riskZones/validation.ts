import Joi from 'joi'
import { CustomError } from '../../utils/errors'
import { validateSchema } from '../../utils/joi-validate'
import { HAZARD_TYPES, HAZARD_SEVERITIES, CONNECTIVITY_STATUSES, ASSESSMENT_STATUSES, ASSESSMENT_URGENCIES, CONFIDENCE_LEVELS } from './types'

const text = (max: number) =>
    Joi.string()
        .trim()
        .max(max)
        // eslint-disable-next-line no-control-regex
        .pattern(/^[^<>\u0000-\u001f]*$/)

export const locationSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).allow(null),
    longitude: Joi.number().min(-180).max(180).allow(null),
    landmarkDescription: text(400).min(3).required(),
    isLocationEstimated: Joi.boolean().default(true)
})

export const vulnerablePopulationSchema = Joi.object({
    estimatedTotalPopulation: Joi.number().integer().min(0).max(1000000).allow(null),
    estimatedVulnerableCount: Joi.number().integer().min(0).max(1000000).allow(null),
    vulnerabilityDetails: text(500).allow(null, '')
})

export const riskZoneSchema = Joi.object({
    communityName: text(150).min(2).required(),
    district: text(100).min(2).required(),
    tehsil: text(100),
    approximateLocation: locationSchema.required(),
    hazardType: Joi.string()
        .valid(...HAZARD_TYPES)
        .required(),
    hazardSeverity: Joi.string()
        .valid(...HAZARD_SEVERITIES)
        .required(),
    connectivityStatus: Joi.string()
        .valid(...CONNECTIVITY_STATUSES)
        .default('UNKNOWN'),
    accessObstacles: Joi.array().items(text(100)).max(10),
    vulnerablePopulation: vulnerablePopulationSchema,
    informationConfidence: Joi.string()
        .valid(...CONFIDENCE_LEVELS)
        .default('MEDIUM'),
    confidenceReasons: Joi.array().items(text(200)).max(10),
    assessmentStatus: Joi.string()
        .valid(...ASSESSMENT_STATUSES)
        .default('PENDING_ASSESSMENT'),
    notes: text(1000),
    isSimulated: Joi.boolean().default(false),
    demoKey: text(100)
})

export const fieldAssessmentSchema = Joi.object({
    priorityUrgency: Joi.string()
        .valid(...ASSESSMENT_URGENCIES)
        .required(),
    assignedOfficer: text(100),
    assessmentNotes: text(1000).min(5).required()
})

export const statusUpdateSchema = Joi.object({
    status: Joi.string()
        .valid(...ASSESSMENT_STATUSES)
        .required(),
    notes: text(1000).min(3).required()
})

export const idSchema = Joi.string().hex().length(24).required()

const paging = {
    page: Joi.number().integer().min(1).max(100000).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
}

export const riskZoneQuerySchema = Joi.object({
    ...paging,
    hazardSeverity: Joi.string().valid(...HAZARD_SEVERITIES),
    assessmentStatus: Joi.string().valid(...ASSESSMENT_STATUSES),
    district: text(100),
    connectivityStatus: Joi.string().valid(...CONNECTIVITY_STATUSES),
    sort: Joi.string().valid('severity', 'oldest', 'newest').default('severity')
})

export function validate<T>(schema: Joi.Schema, input: unknown): T {
    const { payload, error } = validateSchema<T>(schema, input)
    if (error) throw new CustomError(error.details.map((detail) => detail.message).join('; '), 400)
    return payload
}
