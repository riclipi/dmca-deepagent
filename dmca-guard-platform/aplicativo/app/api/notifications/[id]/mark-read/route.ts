import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { notificationService } from '@/lib/services/notification.service'

/**
 * POST /api/notifications/[id]/mark-read
 * Mark a notification as read
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    const { id } = await params
    const notification = await notificationService.markAsRead(id, session.user.id)
    return ApiResponse.success(notification)

  } catch (error) {
    console.error('Error marking notification as read:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to mark notification as read')
    )
  }
}