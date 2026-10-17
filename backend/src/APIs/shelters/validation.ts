import Joi from 'joi'
import { CustomError } from '../../utils/errors'
import { validateSchema } from '../../utils/joi-validate'
import { SHELTER_STATUSES, RESOURCE_CATEGORIES, RESOURCE_STATUSES } from './types'

const text = (max: number) =>
    Joi.string()
        .trim()
        .max(max)
        // eslint-disable-next-line no-control-regex
        .pattern(/^[^<>\u0000-\u001f]*$/)

const phoneRegex = /^[0-9+() -]{5,32}$/

export const locationSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
})

export const contactSchema = Joi.object({
    contactPerson: text(100).allow(null, ''),
    phone: Joi.string().pattern(phoneRegex).allow(null, ''),
    email: Joi.string().email().max(100).allow(null, '')
})

export const createResourceSchema = Joi.object({
    category: Joi.string()
        .valid(...RESOURCE_CATEGORIES)
        .required(),
    resourceName: text(150).min(2).required(),
    quantity: Joi.number().min(0).required(),
    unit: text(50).min(1).required(),
    status: Joi.string().valid(...RESOURCE_STATUSES),
    minimumThreshold: Joi.number().min(0).default(10),
    notes: text(1000).allow(null, ''),
    isSimulated: Joi.boolean().default(false),
    demoKey: text(100)
})

export const updateResourceSchema = Joi.object({
    category: Joi.string().valid(...RESOURCE_CATEGORIES),
    resourceName: text(150).min(2),
    quantity: Joi.number().min(0),
    unit: text(50).min(1),
    status: Joi.string().valid(...RESOURCE_STATUSES),
    minimumThreshold: Joi.number().min(0),
    notes: text(1000).allow(null, '')
}).min(1)

export const createShelterSchema = Joi.object({
    name: text(150).min(2).required(),
    address: text(300).min(3).required(),
    location: locationSchema.required(),
    totalCapacity: Joi.number().integer().min(1).max(50000).required(),
    currentOccupancy: Joi.number().integer().min(0).max(50000).default(0),
    status: Joi.string()
        .valid(...SHELTER_STATUSES)
        .default('OPEN'),
    contactInformation: contactSchema,
    notes: text(1000).allow(null, ''),
    isSimulated: Joi.boolean().default(false),
    demoKey: text(100),
    initialResources: Joi.array().items(createResourceSchema).max(50)
})

export const updateShelterSchema = Joi.object({
    name: text(150).min(2),
    address: text(300).min(3),
    location: locationSchema,
    totalCapacity: Joi.number().integer().min(1).max(50000),
    currentOccupancy: Joi.number().integer().min(0).max(50000),
    status: Joi.string().valid(...SHELTER_STATUSES),
    contactInformation: contactSchema,
    notes: text(1000).allow(null, '')
}).min(1)

export const idSchema = Joi.string().hex().length(24).required()

const paging = {
    page: Joi.number().integer().min(1).max(100000).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
}

export const shelterQuerySchema = Joi.object({
    ...paging,
    status: Joi.string().valid(...SHELTER_STATUSES),
    availableOnly: Joi.boolean().default(false),
    minAvailableSpaces: Joi.number().integer().min(0),
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
    radiusKm: Joi.number().min(1).max(500).default(25),
    isSimulated: Joi.boolean()
})

export function validate<T>(schema: Joi.Schema, input: unknown): T {
    const { payload, error } = validateSchema<T>(schema, input)
    if (error) throw new CustomError(error.details.map((detail) => detail.message).join('; '), 400)
    return payload
}

