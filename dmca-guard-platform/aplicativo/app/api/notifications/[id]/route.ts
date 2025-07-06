import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { notificationService } from '@/lib/services/notification.service'

/**
 * GET /api/notifications/[id]
 * Get a specific notification
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    const { id } = await params
    const { notifications } = await notificationService.getForUser(session.user.id, {
      limit: 1
    })

    const notification = notifications.find(n => n.id === id)

    if (!notification) {
      return ApiResponse.notFound('Notification')
    }

    return ApiResponse.success(notification)

  } catch (error) {
    console.error('Error fetching notification:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to fetch notification')
    )
  }
}

/**
 * PATCH /api/notifications/[id]
 * Update a notification (mark as read)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    const { id } = await params
    const body = await request.json()
    const { isRead } = body

    if (isRead === true) {
      const notification = await notificationService.markAsRead(id, session.user.id)
      return ApiResponse.success(notification)
    }

    return ApiResponse.error('Only marking as read is supported', 400)

  } catch (error) {
    console.error('Error updating notification:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to update notification')
    )
  }
}

/**
 * DELETE /api/notifications/[id]
 * Delete a notification
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    const { id } = await params
    await notificationService.delete(id, session.user.id)
    return ApiResponse.success(null)

  } catch (error) {
    console.error('Error deleting notification:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to delete notification')
    )
  }
}