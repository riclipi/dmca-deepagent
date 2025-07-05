import { NextRequest } from 'next/server'
import { ApiResponse } from '@/lib/api-response'
import { runAbuseMonitoringJob } from '@/lib/jobs/abuse-monitoring-job'

// This should be called by your cron service (e.g., Vercel Cron, GitHub Actions, etc.)
// Recommended frequency: Every hour

export async function GET(request: NextRequest) {
  // Verify the request is from an authorized source
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return ApiResponse.unauthorized('Invalid cron secret')
  }
  
  const startTime = Date.now()
  
  try {
    console.log('[API] Starting abuse monitoring cron job at', new Date().toISOString())
    
    await runAbuseMonitoringJob()
    
    const duration = Date.now() - startTime
    
    return ApiResponse.success({
      message: 'Abuse monitoring job completed successfully',
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      duration: `${duration}ms`
    }, {
      jobType: 'abuse-monitoring',
      executionTime: duration
    })
  } catch (error) {
    console.error('[API] Abuse monitoring cron job failed:', error)
    
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