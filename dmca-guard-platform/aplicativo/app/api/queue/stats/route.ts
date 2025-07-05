import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { fairQueueManager } from '@/lib/services/security/fair-queue-manager'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return ApiResponse.unauthorized()
    }

    const stats = fairQueueManager.getQueueStats()
    
    return ApiResponse.success(stats)
  } catch (error) {
    console.error('Error fetching queue stats:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to fetch queue stats'),
      process.env.NODE_ENV === 'development'
    )
  }
}