// app/api/middleware/process-abuse-violations.ts
import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { abuseMonitoringService } from '@/lib/services/security/abuse-monitoring.service'

/**
 * Process abuse violations after the response is sent
 * This runs in the API route context, not Edge Runtime
 */
export async function processAbuseViolations(request: NextRequest) {
  try {
    const headersList = await headers()
    
    // Check if there's an abuse violation to process
    const violation = headersList.get('X-Abuse-Violation')
    const userId = headersList.get('X-Abuse-User-Id')
    const path = headersList.get('X-Abuse-Path')
    
    if (violation === 'rate-limit-exceeded' && userId) {
      console.log(`[Process Abuse] Recording rate limit violation for user ${userId}`)
      
      await abuseMonitoringService.recordViolation(
        userId,
        'EXCESSIVE_REQUESTS',
        0.15,
        `Rate limit exceeded on ${path}`,
        { 
          path,
          timestamp: new Date().toISOString()
        }
      )
    }
  } catch (error) {
    console.error('[Process Abuse] Error processing violations:', error)
  }
}