import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { notificationService } from '@/lib/services/notification.service'

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    const count = await notificationService.markAllAsRead(session.user.id)
    
    return ApiResponse.success({ count })

  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to mark notifications as read')
    )
  }
}