import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { notificationService } from '@/lib/services/notification.service'

/**
 * GET /api/notifications/preferences
 * Get notification preferences for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    const preferences = await notificationService.getPreferences(session.user.id)
    return ApiResponse.success(preferences)

  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to fetch preferences')
    )
  }
}

/**
 * PATCH /api/notifications/preferences
 * Update notification preferences for the authenticated user
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    const body = await request.json()
    const { inApp, email, webhook, preferences } = body

    const updatedPreferences = await notificationService.updatePreferences(session.user.id, {
      inApp,
      email,
      webhook,
      preferences
    })

    return ApiResponse.success(updatedPreferences)

  } catch (error) {
    console.error('Error updating notification preferences:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to update preferences')
    )
  }
}