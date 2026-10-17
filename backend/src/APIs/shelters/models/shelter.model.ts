import { Schema, model } from 'mongoose'
import { SHELTER_STATUSES, IShelter } from '../types'

const locationSchema = new Schema(
    {
        latitude: { type: Number, required: true, min: -90, max: 90 },
        longitude: { type: Number, required: true, min: -180, max: 180 }
    },
    { _id: false }
)

const contactSchema = new Schema(
    {
        contactPerson: { type: String, trim: true, maxlength: 100, default: null },
        phone: { type: String, trim: true, maxlength: 32, default: null },
        email: { type: String, trim: true, maxlength: 100, default: null }
    },
    { _id: false }
)

const schema = new Schema<IShelter>(
    {
        name: { type: String, trim: true, required: true, maxlength: 150 },
        address: { type: String, trim: true, required: true, maxlength: 300 },
        location: { type: locationSchema, required: true },
        totalCapacity: { type: Number, required: true, min: 1, validate: Number.isInteger },
        currentOccupancy: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
        availableSpaces: { type: Number, required: true, min: 0, validate: Number.isInteger },
        status: { type: String, enum: SHELTER_STATUSES, default: 'OPEN', required: true },
        contactInformation: { type: contactSchema, default: () => ({}) },
        notes: { type: String, trim: true, maxlength: 1000, default: null },
        isSimulated: { type: Boolean, default: false, required: true },
        demoKey: { type: String }
    },
    { timestamps: true, optimisticConcurrency: true }
)

schema.index({ demoKey: 1 }, { unique: true, partialFilterExpression: { demoKey: { $type: 'string' } } })
schema.index({ status: 1, availableSpaces: -1 })
schema.index({ 'location.latitude': 1, 'location.longitude': 1 })

export type ShelterRecord = IShelter
export default model<IShelter>('Shelter', schema)

