// Notification Types and Interfaces

import { Notification as PrismaNotification, User } from '@prisma/client'

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

export interface NotificationWithRelations extends PrismaNotification {
  user?: User
  takedownRequest?: any
}

export interface NotificationListResponse {
  notifications: NotificationWithRelations[]
  total: number
  unread: number
}

export interface NotificationSocketEvents {
  'notification:new': (notification: NotificationWithRelations) => void
  'notification:updated': (update: { id: string; isRead: boolean; readAt?: Date }) => void
  'notification:bulk_update': (data: { action: string; timestamp: Date }) => void
  'notification:deleted': (data: { id: string }) => void
}

export interface NotificationChannelConfig {
  email?: {
    from?: string
    replyTo?: string
    templates?: Record<NotificationType, EmailTemplate>
  }
  webhook?: {
    defaultUrl?: string
    headers?: Record<string, string>
    timeout?: number
    retries?: number
  }
}

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface WebhookPayload {
  id: string
  type: NotificationType
  title: string
  message: string
  userId: string
  createdAt: Date
  metadata?: Record<string, any>
}

export interface NotificationStats {
  total: number
  unread: number
  byType: Record<NotificationType, number>
  last24Hours: number
  last7Days: number
  last30Days: number
}