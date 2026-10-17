import { Schema, model } from 'mongoose'
const schema = new Schema(
    {
        incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', required: true },
        teamId: { type: Schema.Types.ObjectId, ref: 'RescueTeam', required: true },
        assignedAt: { type: Date, default: Date.now, required: true },
        completedAt: { type: Date, default: null },
        status: { type: String, enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE', required: true },
        notes: { type: String, trim: true, maxlength: 1000 },
        isSimulated: { type: Boolean, default: false, required: true },
        demoKey: { type: String }
    },
    { timestamps: true }
)
schema.index({ incidentId: 1 }, { unique: true, partialFilterExpression: { status: 'ACTIVE' } })
schema.index({ teamId: 1 }, { unique: true, partialFilterExpression: { status: 'ACTIVE' } })
schema.index({ demoKey: 1 }, { unique: true, partialFilterExpression: { demoKey: { $type: 'string' } } })
schema.index({ status: 1, assignedAt: -1 })
schema.index({ isSimulated: 1, status: 1, completedAt: -1 })
schema.index({ incidentId: 1, assignedAt: -1 })
schema.index({ teamId: 1, assignedAt: -1 })
export default model('Assignment', schema)
