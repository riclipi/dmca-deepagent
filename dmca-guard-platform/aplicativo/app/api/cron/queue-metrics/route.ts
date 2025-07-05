import { NextRequest } from 'next/server'
import { ApiResponse } from '@/lib/api-response'
import { runQueueMetricsJob } from '@/lib/jobs/queue-metrics-job'

// This should be called by your cron service (e.g., Vercel Cron, GitHub Actions, etc.)
// Recommended frequency: Every 5 minutes

export async function GET(request: NextRequest) {
  // Verify the request is from an authorized source
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return ApiResponse.unauthorized('Invalid cron secret')
  }
  
  const startTime = Date.now()
  
  try {
    console.log('[API] Starting queue metrics cron job at', new Date().toISOString())
    
    const metrics = await runQueueMetricsJob()
    
    return ApiResponse.success({
      message: 'Queue metrics job completed successfully',
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      metrics
    }, {
      jobType: 'queue-metrics',
      executionTime: Date.now() - startTime
    })
  } catch (error) {
    console.error('[API] Queue metrics cron job failed:', error)
    
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