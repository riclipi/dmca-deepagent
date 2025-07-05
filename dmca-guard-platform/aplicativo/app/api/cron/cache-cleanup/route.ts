import { NextRequest } from 'next/server'
import { ApiResponse } from '@/lib/api-response'
import { runCacheCleanupJob } from '@/lib/jobs/cache-cleanup-job'

// This should be called by your cron service (e.g., Vercel Cron, GitHub Actions, etc.)
// Recommended frequency: Daily at 3 AM

export async function GET(request: NextRequest) {
  // Verify the request is from an authorized source
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return ApiResponse.unauthorized('Invalid cron secret')
  }
  
  const startTime = Date.now()
  
  try {
    console.log('[API] Starting cache cleanup cron job at', new Date().toISOString())
    
    const stats = await runCacheCleanupJob()
    
    return ApiResponse.success({
      message: 'Cache cleanup job completed successfully',
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      stats
    }, {
      jobType: 'cache-cleanup',
      executionTime: stats.duration
    })
  } catch (error) {
    console.error('[API] Cache cleanup cron job failed:', error)
    
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Unknown error'),
      process.env.NODE_ENV === 'development'
    )
  }
}

// Also support POST for some cron services
export async function POST(request: NextRequest) {
  return GET(request)
}