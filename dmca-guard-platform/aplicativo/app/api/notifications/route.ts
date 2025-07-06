import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { notificationService, NotificationType } from '@/lib/services/notification.service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications
 * Get notifications for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const types = searchParams.get('types')?.split(',').filter(Boolean) as NotificationType[]

    const result = await notificationService.getForUser(session.user.id, {
      limit,
      offset,
      unreadOnly,
      types
    })

    return ApiResponse.success(result)

  } catch (error) {
    console.error('Error fetching notifications:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to fetch notifications')
    )
  }
}

/**
 * POST /api/notifications
 * Create a new notification (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    // Check if user is admin (using planType)
    if (session.user.planType !== 'SUPER_USER') {
      return ApiResponse.forbidden('Admin access required')
    }

    const body = await request.json()
    const { userId, type, title, message, takedownRequestId, metadata } = body

    if (!userId || !type || !title || !message) {
      return ApiResponse.error('Missing required fields: userId, type, title, message', 400)
    }

    if (!Object.values(NotificationType).includes(type)) {
      return ApiResponse.error(`Invalid notification type. Must be one of: ${Object.values(NotificationType).join(', ')}`, 400)
    }

    const notification = await notificationService.create({
      userId,
      type: type as NotificationType,
      title,
      message,
      takedownRequestId,
      metadata
    })

    return ApiResponse.created(notification)

  } catch (error) {
    console.error('Error creating notification:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to create notification')
    )
  }
}
