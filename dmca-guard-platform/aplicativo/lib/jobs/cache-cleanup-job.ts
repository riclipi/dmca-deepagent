import { prisma } from '@/lib/prisma'

interface CleanupStats {
  totalScanned: number
  totalDeleted: number
  errors: number
  duration: number
}

/**
 * Job para limpar entradas expiradas do cache no banco de dados
 * Deve ser executado diariamente
 */
export async function runCacheCleanupJob(): Promise<CleanupStats> {
  console.log('[Job] Starting cache cleanup job at', new Date().toISOString())
  
  const startTime = Date.now()
  const stats: CleanupStats = {
    totalScanned: 0,
    totalDeleted: 0,
    errors: 0,
    duration: 0
  }
  
  try {
    // Count total cache entries before cleanup
    const totalBefore = await prisma.cacheEntry.count()
    stats.totalScanned = totalBefore
    
    // Delete expired cache entries
    const deleteResult = await prisma.cacheEntry.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })
    
    stats.totalDeleted = deleteResult.count
    
    // Also clean up old entries that haven't been hit recently (> 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const oldEntriesResult = await prisma.cacheEntry.deleteMany({
      where: {
        AND: [
          {
            createdAt: {
              lt: thirtyDaysAgo
            }
          },
          {
            hits: {
              lt: 5 // Low hit count
            }
          }
        ]
      }
    })
    
    stats.totalDeleted += oldEntriesResult.count
    
    // Clean up orphaned removal proofs (older than 90 days)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    
    await prisma.removalProof.deleteMany({
      where: {
        createdAt: {
          lt: ninetyDaysAgo
        }
      }
    })
    
    // Clean up old audit logs (older than 180 days)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180)
    
    await prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: sixMonthsAgo
        }
      }
    })
    
    // Clean up old agent events (older than 30 days)
    await prisma.agentEvent.deleteMany({
      where: {
        timestamp: {
          lt: thirtyDaysAgo
        }
      }
    })
    
    // Clean up old agent metrics (older than 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    await prisma.agentMetric.deleteMany({
      where: {
        timestamp: {
          lt: sevenDaysAgo
        }
      }
    })
    
    stats.duration = Date.now() - startTime
    
    console.log('[Job] Cache cleanup job completed successfully:', {
      totalScanned: stats.totalScanned,
      totalDeleted: stats.totalDeleted,
      duration: `${stats.duration}ms`
    })
    
    return stats
  } catch (error) {
    stats.errors++
    stats.duration = Date.now() - startTime
    
    console.error('[Job] Cache cleanup job failed:', error)
    throw error
  }
}

// If executed directly
if (require.main === module) {
  runCacheCleanupJob()
    .then(stats => {
      console.log('Cleanup completed:', stats)
      process.exit(0)
    })
    .catch(error => {
      console.error('Cleanup failed:', error)
      process.exit(1)
    })
}