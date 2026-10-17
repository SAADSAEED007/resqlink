import { Schema, model } from 'mongoose'
import { CAPABILITIES, TEAM_STATUSES } from '../types'
import { locationSchema } from './incident.model'
const schema = new Schema(
    {
        name: { type: String, trim: true, required: true, maxlength: 100 },
        teamCode: { type: String, trim: true, uppercase: true, required: true, unique: true, maxlength: 32 },
        capabilities: { type: [String], enum: CAPABILITIES, required: true, validate: (values: string[]) => values.length > 0 },
        status: { type: String, enum: TEAM_STATUSES, default: 'AVAILABLE', required: true },
        location: { type: locationSchema, required: true },
        capacity: { type: Number, min: 1, max: 10000, required: true, validate: Number.isInteger },
        currentIncident: { type: Schema.Types.ObjectId, ref: 'Incident', default: null },
        isSimulated: { type: Boolean, default: false, required: true },
        demoKey: { type: String }
    },
    { timestamps: true, optimisticConcurrency: true }
)
schema.index({ demoKey: 1 }, { unique: true, partialFilterExpression: { demoKey: { $type: 'string' } } })
schema.index({ status: 1, teamCode: 1 })
export default model('RescueTeam', schema)
