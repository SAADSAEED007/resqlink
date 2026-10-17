import mongoose, { FilterQuery } from 'mongoose'
import Notification, { NotificationRecord } from './models/notification.model'
import { NotificationItem, NotificationQuery, NotificationType, NotificationSeverity, UnreadCountResponse } from './types'
import { CustomError } from '../../utils/errors'

export interface CreateNotificationInput {
    type: NotificationType
    severity: NotificationSeverity
    title: string
    message: string
    incidentId?: string | null
    teamId?: string | null
    assignmentId?: string | null
    recipientId?: string | null
    isSimulated?: boolean
}

export interface RawReadReceipt {
    coordinatorId: unknown
    readAt: Date
}

export interface RawNotificationDoc {
    _id: unknown
    type: NotificationType
    severity: NotificationSeverity
    title: string
    message: string
    incidentId?: unknown
    teamId?: unknown
    assignmentId?: unknown
    recipientId?: unknown
    readBy?: RawReadReceipt[]
    isSimulated?: boolean
    createdAt: Date
    updatedAt?: Date
}

function mapNotification(doc: RawNotificationDoc, coordinatorId: string): NotificationItem {
    const receipts = Array.isArray(doc.readBy) ? doc.readBy : []
    const isRead = receipts.some((r) => String(r.coordinatorId) === coordinatorId)
    const receipt = receipts.find((r) => String(r.coordinatorId) === coordinatorId)

    return {
        id: String(doc._id),
        type: doc.type,
        severity: doc.severity,
        title: doc.title,
        message: doc.message,
        incidentId: doc.incidentId ? String(doc.incidentId) : null,
        teamId: doc.teamId ? String(doc.teamId) : null,
        assignmentId: doc.assignmentId ? String(doc.assignmentId) : null,
        isRead,
        readAt: receipt?.readAt ? new Date(receipt.readAt) : null,
        createdAt: doc.createdAt
    }
}

export async function createNotification(input: CreateNotificationInput) {
    try {
        const isMock = Boolean((Notification.create as unknown as { _isMockFunction?: boolean })._isMockFunction)
        if (Number(mongoose.connection.readyState) === 0 && !isMock) {
            return null
        }
        return await Notification.create({
            type: input.type,
            severity: input.severity,
            title: input.title,
            message: input.message,
            incidentId: input.incidentId || null,
            teamId: input.teamId || null,
            assignmentId: input.assignmentId || null,
            recipientId: input.recipientId || null,
            isSimulated: Boolean(input.isSimulated),
            readBy: []
        })
    } catch {
        // Notification generation should never crash or roll back the core business operation.
        return null
    }
}

export async function listNotifications(coordinatorId: string, query: NotificationQuery) {
    const filter: FilterQuery<NotificationRecord> = {
        $or: [{ recipientId: null }, { recipientId: new mongoose.Types.ObjectId(coordinatorId) }]
    }

    if (query.type) {
        filter.type = query.type
    }

    if (query.isSimulated !== undefined) {
        filter.isSimulated = query.isSimulated
    }

    if (query.unreadOnly) {
        filter['readBy.coordinatorId'] = { $ne: new mongoose.Types.ObjectId(coordinatorId) }
    }

    const [docs, total] = await Promise.all([
        Notification.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((query.page - 1) * query.limit)
            .limit(query.limit)
            .lean(),
        Notification.countDocuments(filter)
    ])

    const items = (docs as unknown as RawNotificationDoc[]).map((doc) => mapNotification(doc, coordinatorId))
    const totalPages = Math.ceil(total / query.limit) || 1

    return {
        items,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages
        }
    }
}

export async function getUnreadCount(coordinatorId: string, isSimulated?: boolean): Promise<UnreadCountResponse> {
    const filter: FilterQuery<NotificationRecord> = {
        $or: [{ recipientId: null }, { recipientId: new mongoose.Types.ObjectId(coordinatorId) }],
        'readBy.coordinatorId': { $ne: new mongoose.Types.ObjectId(coordinatorId) }
    }

    if (isSimulated !== undefined) {
        filter.isSimulated = isSimulated
    }

    const unreadCount = await Notification.countDocuments(filter)
    return { unreadCount }
}

export async function markNotificationAsRead(notificationId: string, coordinatorId: string): Promise<NotificationItem> {
    const notification = await Notification.findById(notificationId)
    if (!notification) {
        throw new CustomError('Notification not found', 404)
    }

    const isAlreadyRead = notification.readBy.some((r) => String(r.coordinatorId) === coordinatorId)
    if (!isAlreadyRead) {
        notification.readBy.push({
            coordinatorId: new mongoose.Types.ObjectId(coordinatorId),
            readAt: new Date()
        })
        await notification.save()
    }

    return mapNotification(notification.toObject() as unknown as RawNotificationDoc, coordinatorId)
}

export async function markAllNotificationsAsRead(coordinatorId: string, isSimulated?: boolean) {
    const filter: FilterQuery<NotificationRecord> = {
        $or: [{ recipientId: null }, { recipientId: new mongoose.Types.ObjectId(coordinatorId) }],
        'readBy.coordinatorId': { $ne: new mongoose.Types.ObjectId(coordinatorId) }
    }

    if (isSimulated !== undefined) {
        filter.isSimulated = isSimulated
    }

    const now = new Date()
    const result = await Notification.updateMany(filter, {
        $push: {
            readBy: {
                coordinatorId: new mongoose.Types.ObjectId(coordinatorId),
                readAt: now
            }
        }
    })

    return {
        success: true,
        updatedCount: result.modifiedCount
    }
}
