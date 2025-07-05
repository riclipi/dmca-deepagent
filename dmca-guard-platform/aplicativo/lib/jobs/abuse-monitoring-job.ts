// lib/jobs/abuse-monitoring-job.ts
import { abuseMonitoringService } from '@/lib/services/security/abuse-monitoring.service'

/**
 * Job para monitorar scores de abuso periodicamente
 * Deve ser executado a cada hora
 */
export async function runAbuseMonitoringJob() {
  console.log('[Job] Starting abuse monitoring job at', new Date().toISOString())
  
  try {
    await abuseMonitoringService.monitorAllUsers()
    console.log('[Job] Abuse monitoring job completed successfully')
  } catch (error) {
    console.error('[Job] Abuse monitoring job failed:', error)
    throw error
  }
}

// Se executado diretamente
if (require.main === module) {
  runAbuseMonitoringJob()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}