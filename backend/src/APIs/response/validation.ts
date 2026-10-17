import Joi from 'joi'
import { CustomError } from '../../utils/errors'
import { validateSchema } from '../../utils/joi-validate'
import { EMERGENCY_TYPES, WATER_LEVELS, PRIORITIES, INCIDENT_STATUSES, CAPABILITIES, TEAM_STATUSES } from './types'
// Reject control characters deliberately to keep submitted text safe and predictable.

const text = (max: number) =>
    Joi.string()
        .trim()
        .max(max)
        // eslint-disable-next-line no-control-regex
        .pattern(/^[^<>\u0000-\u001f]*$/)
const count = Joi.number().integer().min(0).max(10000)
const latitude = Joi.number().min(-90).max(90).required()
const longitude = Joi.number().min(-180).max(180).required()
export const locationSchema = Joi.object({ latitude, longitude, address: text(300) })
export const incidentSchema = Joi.object({
    reporterName: text(100).min(2).required(),
    reporterPhone: Joi.string()
        .trim()
        .pattern(/^[+\d ()-]{5,32}$/),
    emergencyType: Joi.string()
        .valid(...EMERGENCY_TYPES)
        .required(),
    description: text(2000).min(5).required(),
    location: locationSchema.allow(null),
    peopleAffected: Joi.number().integer().min(1).max(10000).required(),
    vulnerablePeople: Joi.object({ elderly: count, children: count, disabled: count, medicalNeeds: count }),
    waterLevel: Joi.string().valid(...WATER_LEVELS),
    immediateDanger: Joi.boolean()
})
export const teamSchema = Joi.object({
    name: text(100).min(2).required(),
    teamCode: Joi.string()
        .trim()
        .uppercase()
        .pattern(/^[A-Z0-9-]{2,32}$/)
        .required(),
    capabilities: Joi.array()
        .items(Joi.string().valid(...CAPABILITIES))
        .min(1)
        .unique()
        .required(),
    status: Joi.string().valid('AVAILABLE', 'OFFLINE').default('AVAILABLE'),
    location: locationSchema.required(),
    capacity: Joi.number().integer().min(1).max(10000).required()
})
export const idSchema = Joi.string().hex().length(24).required()
export const assignmentSchema = Joi.object({ incidentId: idSchema, teamId: idSchema, notes: text(1000) })
export const statusSchema = Joi.object({
    status: Joi.string()
        .valid(...INCIDENT_STATUSES)
        .required()
})
export const prioritySchema = Joi.object({
    priorityLevel: Joi.string()
        .valid(...PRIORITIES)
        .required(),
    reason: text(1000).min(5).required()
})
const paging = { page: Joi.number().integer().min(1).max(100000).default(1), limit: Joi.number().integer().min(1).max(100).default(20) }
export const incidentQuerySchema = Joi.object({
    ...paging,
    status: Joi.string().valid(...INCIDENT_STATUSES),
    priorityLevel: Joi.string().valid(...PRIORITIES),
    sort: Joi.string().valid('priority', 'oldest', 'newest').default('priority')
})
export const teamQuerySchema = Joi.object({ ...paging, status: Joi.string().valid(...TEAM_STATUSES) })
export const assignmentQuerySchema = Joi.object({ ...paging, status: Joi.string().valid('ACTIVE', 'COMPLETED', 'CANCELLED') })
export const dashboardQuerySchema = Joi.object({
    isSimulated: Joi.boolean()
})
export const activityQuerySchema = Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    isSimulated: Joi.boolean()
})
export function validate<T>(schema: Joi.Schema, input: unknown): T {
    const { payload, error } = validateSchema<T>(schema, input)
    if (error) throw new CustomError(error.details.map((detail) => detail.message).join('; '), 400)
    return payload
}
