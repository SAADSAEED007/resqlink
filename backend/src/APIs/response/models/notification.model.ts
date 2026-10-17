import { Schema, model, InferSchemaType, Types } from 'mongoose'
import { NOTIFICATION_TYPES, NOTIFICATION_SEVERITIES } from '../types'

const readReceiptSchema = new Schema(
    {
        coordinatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        readAt: { type: Date, default: Date.now, required: true }
    },
    { _id: false }
)

const notificationSchema = new Schema(
    {
        type: { type: String, enum: NOTIFICATION_TYPES, required: true },
        severity: { type: String, enum: NOTIFICATION_SEVERITIES, required: true },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        message: { type: String, required: true, trim: true, maxlength: 1000 },
        incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', default: null },
        teamId: { type: Schema.Types.ObjectId, ref: 'RescueTeam', default: null },
        assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', default: null },
        recipientId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        readBy: { type: [readReceiptSchema], default: [] },
        isSimulated: { type: Boolean, default: false, required: true }
    },
    { timestamps: true }
)

notificationSchema.index({ createdAt: -1 })
notificationSchema.index({ 'readBy.coordinatorId': 1, createdAt: -1 })
notificationSchema.index({ incidentId: 1 }, { partialFilterExpression: { incidentId: { $type: 'objectId' } } })
notificationSchema.index({ recipientId: 1 }, { partialFilterExpression: { recipientId: { $type: 'objectId' } } })

export type NotificationRecord = InferSchemaType<typeof notificationSchema> & {
    _id: Types.ObjectId
    createdAt: Date
    updatedAt: Date
}

export default model('Notification', notificationSchema)
