import { Schema, model, InferSchemaType } from 'mongoose'
import { EMERGENCY_TYPES, WATER_LEVELS, PRIORITIES, CONFIDENCES, INCIDENT_STATUSES, VERIFICATION_STATUSES } from '../types'

export const locationSchema = new Schema(
    {
        latitude: { type: Number, min: -90, max: 90, required: true },
        longitude: { type: Number, min: -180, max: 180, required: true },
        address: { type: String, trim: true, maxlength: 300 }
    },
    { _id: false }
)
const count = { type: Number, min: 0, max: 10000, validate: Number.isInteger }
const vulnerabilitySchema = new Schema({ elderly: count, children: count, disabled: count, medicalNeeds: count }, { _id: false })
const overrideSchema = new Schema(
    {
        previousPriority: { type: String, enum: PRIORITIES, required: true },
        newPriority: { type: String, enum: PRIORITIES, required: true },
        previousScore: { type: Number, required: true },
        newScore: { type: Number, required: true },
        reason: { type: String, required: true, maxlength: 1000 },
        coordinatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        timestamp: { type: Date, default: Date.now }
    },
    { _id: false }
)
const statusHistorySchema = new Schema(
    {
        previousStatus: { type: String, enum: INCIDENT_STATUSES, required: true },
        newStatus: { type: String, enum: INCIDENT_STATUSES, required: true },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        timestamp: { type: Date, default: Date.now, required: true },
        notes: { type: String, trim: true, maxlength: 1000, default: null }
    },
    { _id: false }
)
const verificationSchema = new Schema(

    {
        status: { type: String, enum: VERIFICATION_STATUSES, default: 'NEEDS_REVIEW', required: true },
        requiresManualReview: { type: Boolean, default: false, required: true },
        isPotentialDuplicate: { type: Boolean, default: false, required: true },
        potentialDuplicateIncidents: [{ type: Schema.Types.ObjectId, ref: 'Incident' }],
        missingFields: { type: [String], default: [] },
        warnings: { type: [String], default: [] },
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        reviewedAt: { type: Date, default: null },
        reviewNotes: { type: String, trim: true, maxlength: 1000, default: null }
    },
    { _id: false }
)
const schema = new Schema(
    {
        reporterName: { type: String, trim: true, required: true, maxlength: 100 },
        reporterPhone: { type: String, trim: true, maxlength: 32 },
        emergencyType: { type: String, enum: EMERGENCY_TYPES, required: true },
        description: { type: String, trim: true, required: true, maxlength: 2000 },
        location: { type: locationSchema, default: null },
        locationVerificationRequired: { type: Boolean, required: true },
        peopleAffected: { type: Number, min: 1, max: 10000, required: true, validate: Number.isInteger },
        vulnerablePeople: { type: vulnerabilitySchema, default: undefined },
        waterLevel: { type: String, enum: WATER_LEVELS },
        immediateDanger: { type: Boolean, default: undefined },
        priorityScore: { type: Number, min: 0, max: 100, required: true },
        priorityLevel: { type: String, enum: PRIORITIES, required: true },
        priorityReasons: { type: [String], required: true },
        confidenceLevel: { type: String, enum: CONFIDENCES, required: true },
        status: { type: String, enum: INCIDENT_STATUSES, default: 'PENDING', required: true },
        assignedTeam: { type: Schema.Types.ObjectId, ref: 'RescueTeam', default: null },
        priorityOverrides: { type: [overrideSchema], default: [] },
        verification: { type: verificationSchema, required: true },
        statusHistory: { type: [statusHistorySchema], default: [] },
        isSimulated: { type: Boolean, default: false, required: true },

        demoKey: { type: String }
    },
    { timestamps: true, optimisticConcurrency: true }
)
schema.index({ demoKey: 1 }, { unique: true, partialFilterExpression: { demoKey: { $type: 'string' } } })
schema.index({ status: 1, priorityScore: -1, createdAt: 1, _id: 1 })
schema.index({ 'verification.status': 1, createdAt: -1 })
schema.index({ updatedAt: -1 })
schema.index({ emergencyType: 1, status: 1, priorityScore: -1 })
export type IncidentRecord = InferSchemaType<typeof schema>
export default model('Incident', schema)
