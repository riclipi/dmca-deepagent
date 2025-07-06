import { prisma } from '@/lib/prisma'
import { getIO } from '@/lib/socket-server'
import { Notification, User } from '@prisma/client'

export enum NotificationType {
  VIOLATION_DETECTED = 'VIOLATION_DETECTED',
  TAKEDOWN_SUCCESS = 'TAKEDOWN_SUCCESS',
  TAKEDOWN_FAILED = 'TAKEDOWN_FAILED',
  SCAN_COMPLETE = 'SCAN_COMPLETE',
  ABUSE_WARNING = 'ABUSE_WARNING',
  PLAN_LIMIT_WARNING = 'PLAN_LIMIT_WARNING',
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT'
}

export interface NotificationPayload {
  userId: string
  type: NotificationType
  title: string
  message: string
  takedownRequestId?: string
  metadata?: Record<string, any>
}

export interface NotificationPreferences {
  userId: string
  inApp: boolean
  email: boolean
  webhook: boolean
  preferences: {
    [key in NotificationType]?: {
      inApp?: boolean
      email?: boolean
      webhook?: boolean
    }
  }
}

class NotificationService {
  private static instance: NotificationService

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  /**
   * Create a new notification
   */
  async create(payload: NotificationPayload): Promise<Notification> {
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        takedownRequestId: payload.takedownRequestId
      },
      include: {
        user: true,
        takedownRequest: true
      }
    })

    // Emit via WebSocket for real-time delivery
    this.emitNotification(notification)

    // Check user preferences and send via other channels
    await this.sendToChannels(notification, payload.metadata)

    return notification
  }

  /**
   * Create multiple notifications in batch
   */
  async createBatch(payloads: NotificationPayload[]): Promise<Notification[]> {
    const notifications = await prisma.notification.createMany({
      data: payloads.map(payload => ({
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        takedownRequestId: payload.takedownRequestId
      }))
    })

    // Get created notifications with full data
    const createdNotifications = await prisma.notification.findMany({
      where: {
        userId: { in: payloads.map(p => p.userId) },
        createdAt: {
          gte: new Date(Date.now() - 1000) // Last second
        }
      },
      include: {
        user: true,
        takedownRequest: true
      },
      orderBy: { createdAt: 'desc' },
      take: payloads.length
    })

    // Emit each notification
    createdNotifications.forEach(notification => {
      this.emitNotification(notification)
    })

    return createdNotifications
  }

  /**
   * Get notifications for a user
   */
  async getForUser(
    userId: string,
    options?: {
      limit?: number
      offset?: number
      unreadOnly?: boolean
      types?: NotificationType[]
    }
  ): Promise<{ notifications: Notification[]; total: number; unread: number }> {
    const where: any = { userId }

    if (options?.unreadOnly) {
      where.isRead = false
    }

    if (options?.types && options.types.length > 0) {
      where.type = { in: options.types }
    }

    const [notifications, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
        include: {
          takedownRequest: true
        }
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } })
    ])

    return { notifications, total, unread }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await prisma.notification.update({
      where: {
        id: notificationId,
        userId // Ensure user owns the notification
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    })

    // Emit update via WebSocket
    this.emitNotificationUpdate(userId, notification)

    return notification
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    })

    // Emit bulk update via WebSocket
    this.emitBulkUpdate(userId, 'all_read')

    return result.count
  }

  /**
   * Delete a notification
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.delete({
      where: {
        id: notificationId,
        userId // Ensure user owns the notification
      }
    })

    // Emit deletion via WebSocket
    this.emitNotificationDeletion(userId, notificationId)
  }

  /**
   * Get user notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    // TODO: Implement user preferences storage
    // For now, return default preferences
    return {
      userId,
      inApp: true,
      email: true,
      webhook: false,
      preferences: {}
    }
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    // TODO: Implement user preferences storage
    // For now, return updated preferences
    return {
      userId,
      inApp: preferences.inApp ?? true,
      email: preferences.email ?? true,
      webhook: preferences.webhook ?? false,
      preferences: preferences.preferences || {}
    }
  }

  /**
   * Emit notification via WebSocket
   */
  private emitNotification(notification: Notification & { user?: User; takedownRequest?: any }) {
    const io = getIO()
    if (!io) {
      console.error('[NotificationService] Socket.io instance not available')
      return
    }
    
    const notificationsNamespace = io.of('/notifications')
    
    // Emit to user's room
    notificationsNamespace.to(`user:${notification.userId}`).emit('notification:new', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      takedownRequest: notification.takedownRequest
    })

    // Also emit to monitoring namespace if it's a violation or takedown notification
    if ([NotificationType.VIOLATION_DETECTED, NotificationType.TAKEDOWN_SUCCESS, NotificationType.TAKEDOWN_FAILED].includes(notification.type as NotificationType)) {
      const monitoringNamespace = io.of('/monitoring')
      monitoringNamespace.to(`user:${notification.userId}`).emit('notification', {
        type: notification.type,
        title: notification.title,
        message: notification.message
      })
    }
  }

  /**
   * Emit notification update via WebSocket
   */
  private emitNotificationUpdate(userId: string, notification: Notification) {
    const io = getIO()
    if (!io) return
    
    const notificationsNamespace = io.of('/notifications')
    notificationsNamespace.to(`user:${userId}`).emit('notification:updated', {
      id: notification.id,
      isRead: notification.isRead,
      readAt: notification.readAt
    })
  }

  /**
   * Emit bulk update via WebSocket
   */
  private emitBulkUpdate(userId: string, action: string) {
    const io = getIO()
    if (!io) return
    
    const notificationsNamespace = io.of('/notifications')
    notificationsNamespace.to(`user:${userId}`).emit('notification:bulk_update', {
      action,
      timestamp: new Date()
    })
  }

  /**
   * Emit notification deletion via WebSocket
   */
  private emitNotificationDeletion(userId: string, notificationId: string) {
    const io = getIO()
    if (!io) return
    
    const notificationsNamespace = io.of('/notifications')
    notificationsNamespace.to(`user:${userId}`).emit('notification:deleted', {
      id: notificationId
    })
  }

  /**
   * Send notification to various channels based on user preferences
   */
  private async sendToChannels(notification: Notification & { user?: User }, metadata?: Record<string, any>) {
    const preferences = await this.getPreferences(notification.userId)
    
    // Import channels dynamically to avoid circular dependencies
    const { notificationChannels } = await import('./notification-channels')
    
    // Check if this notification type has specific preferences
    const typePrefs = preferences.preferences[notification.type as NotificationType]
    
    // Send email if enabled
    if ((typePrefs?.email ?? preferences.email) && notification.user?.email) {
      await notificationChannels.email.send(notification as Notification & { user: User }, metadata)
    }
    
    // Send webhook if enabled
    if (typePrefs?.webhook ?? preferences.webhook) {
      await notificationChannels.webhook.send(notification as Notification & { user: User }, metadata)
    }
  }

  /**
   * System-wide announcement
   */
  async createSystemAnnouncement(title: string, message: string): Promise<void> {
    // Get all active users
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true }
    })

    // Create notifications in batches
    const batchSize = 100
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize)
      await this.createBatch(
        batch.map(user => ({
          userId: user.id,
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          title,
          message
        }))
      )
    }
  }
}

export const notificationService = NotificationService.getInstance()