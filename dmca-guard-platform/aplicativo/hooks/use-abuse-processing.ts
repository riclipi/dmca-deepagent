// hooks/use-abuse-processing.ts
import { headers } from 'next/headers'
import { abuseMonitoringService } from '@/lib/services/security/abuse-monitoring.service'

/**
 * Hook to process abuse violations in API routes
 * Call this at the beginning of your API route handler
 */
export async function useAbuseProcessing() {
  try {
    const headersList = await headers()
    
    // Check if there's an abuse violation to process
    const violation = headersList.get('x-abuse-violation')
    const userId = headersList.get('x-abuse-user-id')
    const path = headersList.get('x-abuse-path')
    
    if (violation === 'rate-limit-exceeded' && userId) {
      // Process asynchronously to not block the response
      setImmediate(async () => {
        try {
          console.log(`[Abuse Processing] Recording rate limit violation for user ${userId}`)
          
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
        } catch (error) {
          console.error('[Abuse Processing] Error recording violation:', error)
        }
      })
    }
  } catch (error) {
    console.error('[Abuse Processing] Error:', error)
  }
}