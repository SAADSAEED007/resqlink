import { Schema, model } from 'mongoose'
import { RESOURCE_CATEGORIES, RESOURCE_STATUSES, IReliefResource } from '../types'

const schema = new Schema<IReliefResource>(
    {
        shelterId: { type: Schema.Types.ObjectId, ref: 'Shelter', required: true, index: true },
        category: { type: String, enum: RESOURCE_CATEGORIES, required: true },
        resourceName: { type: String, trim: true, required: true, maxlength: 150 },
        quantity: { type: Number, required: true, min: 0 },
        unit: { type: String, trim: true, required: true, maxlength: 50 },
        status: { type: String, enum: RESOURCE_STATUSES, default: 'ADEQUATE', required: true },
        minimumThreshold: { type: Number, required: true, min: 0, default: 10 },
        notes: { type: String, trim: true, maxlength: 1000, default: null },
        lastRestockedAt: { type: Date, default: Date.now, required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        isSimulated: { type: Boolean, default: false, required: true },
        demoKey: { type: String }
    },
    { timestamps: true }
)

schema.index({ shelterId: 1, category: 1 })
schema.index({ demoKey: 1 }, { unique: true, partialFilterExpression: { demoKey: { $type: 'string' } } })

export type ReliefResourceRecord = IReliefResource
export default model<IReliefResource>('ReliefResource', schema)

