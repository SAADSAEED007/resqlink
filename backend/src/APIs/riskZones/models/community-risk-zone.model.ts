import { Schema, model } from 'mongoose'
import {
    HAZARD_TYPES,
    HAZARD_SEVERITIES,
    CONNECTIVITY_STATUSES,
    ASSESSMENT_STATUSES,
    ASSESSMENT_URGENCIES,
    CONFIDENCE_LEVELS,
    ICommunityRiskZone
} from '../types'

const locationSubSchema = new Schema(
    {
        latitude: { type: Number, min: -90, max: 90, default: null },
        longitude: { type: Number, min: -180, max: 180, default: null },
        landmarkDescription: { type: String, trim: true, required: true, maxlength: 400 },
        isLocationEstimated: { type: Boolean, default: true, required: true }
    },
    { _id: false }
)

const vulnerabilitySubSchema = new Schema(
    {
        estimatedTotalPopulation: { type: Number, min: 0, default: null },
        estimatedVulnerableCount: { type: Number, min: 0, default: null },
        vulnerabilityDetails: { type: String, trim: true, maxlength: 500, default: null }
    },
    { _id: false }
)

const assessmentSubSchema = new Schema(
    {
        priorityUrgency: { type: String, enum: ASSESSMENT_URGENCIES, required: true },
        assignedOfficer: { type: String, trim: true, maxlength: 100, default: null },
        assessmentNotes: { type: String, trim: true, required: true, maxlength: 1000 },
        requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        requestedAt: { type: Date, default: Date.now, required: true },
        completedAt: { type: Date, default: null }
    },
    { _id: false }
)

const statusHistorySubSchema = new Schema(
    {
        previousStatus: { type: String, enum: ASSESSMENT_STATUSES, required: true },
        newStatus: { type: String, enum: ASSESSMENT_STATUSES, required: true },
        notes: { type: String, trim: true, required: true, maxlength: 1000 },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        changedAt: { type: Date, default: Date.now, required: true }
    },
    { _id: false }
)

const schema = new Schema<ICommunityRiskZone>(
    {
        communityName: { type: String, trim: true, required: true, maxlength: 150 },
        district: { type: String, trim: true, required: true, maxlength: 100 },
        tehsil: { type: String, trim: true, maxlength: 100 },
        approximateLocation: { type: locationSubSchema, required: true },
        hazardType: { type: String, enum: HAZARD_TYPES, required: true },
        hazardSeverity: { type: String, enum: HAZARD_SEVERITIES, required: true },
        connectivityStatus: { type: String, enum: CONNECTIVITY_STATUSES, default: 'UNKNOWN', required: true },
        accessObstacles: { type: [String], default: [] },
        vulnerablePopulation: { type: vulnerabilitySubSchema, default: () => ({}) },
        informationConfidence: { type: String, enum: CONFIDENCE_LEVELS, default: 'MEDIUM', required: true },
        confidenceReasons: { type: [String], default: [] },
        assessmentStatus: { type: String, enum: ASSESSMENT_STATUSES, default: 'PENDING_ASSESSMENT', required: true },
        fieldAssessment: { type: assessmentSubSchema, default: null },
        statusHistory: { type: [statusHistorySubSchema], default: [] },
        notes: { type: String, trim: true, maxlength: 1000 },
        isSimulated: { type: Boolean, default: false, required: true },
        demoKey: { type: String }
    },
    { timestamps: true, optimisticConcurrency: true }
)

schema.index({ demoKey: 1 }, { unique: true, partialFilterExpression: { demoKey: { $type: 'string' } } })
schema.index({ hazardSeverity: 1, assessmentStatus: 1, createdAt: -1 })
schema.index({ district: 1, assessmentStatus: 1 })

export type CommunityRiskZoneRecord = ICommunityRiskZone
export default model<ICommunityRiskZone>('CommunityRiskZone', schema)
