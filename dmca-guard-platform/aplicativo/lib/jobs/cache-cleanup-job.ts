import { prisma } from '@/lib/prisma'

interface CleanupStats {
  totalScanned: number
  totalDeleted: number
  errors: number
  duration: number
  retries?: number
}

/**
 * Retry a database operation with exponential backoff
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      // Check if it's a connection error
      if (error instanceof Error && 
          (error.message.includes('closed the connection') ||
           error.message.includes('ECONNREFUSED') ||
           error.message.includes('P1001'))) {
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1)
          console.warn(`[Job] Database connection error on attempt ${attempt}/${maxRetries}, retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          
          // Try to reconnect
          try {
            await prisma.$disconnect()
            await prisma.$connect()
          } catch (reconnectError) {
            console.error('[Job] Failed to reconnect to database:', reconnectError)
          }
        }
      } else {
        // For non-connection errors, throw immediately
        throw error
      }
    }
  }
  
  throw lastError || new Error('Operation failed after retries')
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
    duration: 0,
    retries: 0
  }
  
  try {
    // Ensure database connection
    await retryOperation(async () => {
      await prisma.$connect()
    })
    
    // Count total cache entries before cleanup
    const totalBefore = await retryOperation(async () => {
      return await prisma.cacheEntry.count()
    })
    stats.totalScanned = totalBefore
    
    // Delete expired cache entries in batches
    const batchSize = 1000
    let deletedCount = 0
    
    // First, get the count of expired entries
    const expiredCount = await retryOperation(async () => {
      return await prisma.cacheEntry.count({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      })
    })
    
    // Delete in batches to avoid large transactions
    for (let offset = 0; offset < expiredCount; offset += batchSize) {
      const deleteResult = await retryOperation(async () => {
        // Get IDs to delete in this batch
        const toDelete = await prisma.cacheEntry.findMany({
          where: {
            expiresAt: {
              lt: new Date()
            }
          },
          select: { id: true },
          take: batchSize
        })
        
        if (toDelete.length === 0) return { count: 0 }
        
        // Delete this batch
        return await prisma.cacheEntry.deleteMany({
          where: {
            id: {
              in: toDelete.map(entry => entry.id)
            }
          }
        })
      })
      
      deletedCount += deleteResult.count
      
      // Small delay between batches to avoid overwhelming the database
      if (deleteResult.count > 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    stats.totalDeleted = deletedCount
    
    // Also clean up old entries that haven't been hit recently (> 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const oldEntriesResult = await retryOperation(async () => {
      return await prisma.cacheEntry.deleteMany({
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
    })
    
    stats.totalDeleted += oldEntriesResult.count
    
    // Clean up orphaned removal proofs (older than 90 days)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    
    await retryOperation(async () => {
      return await prisma.removalProof.deleteMany({
        where: {
          createdAt: {
            lt: ninetyDaysAgo
          }
        }
      })
    })
    
    // Clean up old audit logs (older than 180 days)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180)
    
    await retryOperation(async () => {
      return await prisma.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: sixMonthsAgo
          }
        }
      })
    })
    
    // Clean up old agent events (older than 30 days)
    await retryOperation(async () => {
      return await prisma.agentEvent.deleteMany({
        where: {
          timestamp: {
            lt: thirtyDaysAgo
          }
        }
      })
    })
    
    // Clean up old agent metrics (older than 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    await retryOperation(async () => {
      return await prisma.agentMetric.deleteMany({
        where: {
          timestamp: {
            lt: sevenDaysAgo
          }
        }
      })
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
  } finally {
    // Always disconnect to avoid connection leaks
    try {
      await prisma.$disconnect()
    } catch (disconnectError) {
      console.error('[Job] Failed to disconnect from database:', disconnectError)
    }
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