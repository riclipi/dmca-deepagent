import { fairQueueManager } from '@/lib/services/security/fair-queue-manager'
import { prisma } from '@/lib/prisma'

interface QueueMetrics {
  timestamp: string
  queueStats: Awaited<ReturnType<typeof fairQueueManager.getQueueStats>>
  avgWaitTime: number
  completionRate: number
  errorRate: number
  planDistribution: Record<string, number>
}

/**
 * Job para coletar métricas de performance da fila
 * Deve ser executado a cada 5 minutos
 */
export async function runQueueMetricsJob(): Promise<QueueMetrics> {
  console.log('[Job] Starting queue metrics job at', new Date().toISOString())
  
  try {
    // Get current queue stats
    const queueStats = await fairQueueManager.getQueueStats()
    
    // Calculate average wait time from recent sessions
    const recentSessions = await prisma.scanSession.findMany({
      where: {
        completedAt: {
          gte: new Date(Date.now() - 3600000) // Last hour
        }
      },
      select: {
        startedAt: true,
        completedAt: true,
        userId: true
      }
    })
    
    let totalWaitTime = 0
    let completedCount = 0
    
    recentSessions.forEach(session => {
      if (session.completedAt) {
        const waitTime = session.completedAt.getTime() - session.startedAt.getTime()
        totalWaitTime += waitTime
        completedCount++
      }
    })
    
    const avgWaitTime = completedCount > 0 ? totalWaitTime / completedCount : 0
    
    // Calculate completion and error rates
    const allRecentSessions = await prisma.scanSession.count({
      where: {
        startedAt: {
          gte: new Date(Date.now() - 3600000) // Last hour
        }
      }
    })
    
    const errorSessions = await prisma.scanSession.count({
      where: {
        startedAt: {
          gte: new Date(Date.now() - 3600000) // Last hour
        },
        status: 'ERROR'
      }
    })
    
    const completionRate = allRecentSessions > 0 
      ? (completedCount / allRecentSessions) * 100 
      : 0
      
    const errorRate = allRecentSessions > 0 
      ? (errorSessions / allRecentSessions) * 100 
      : 0
    
    // Get plan distribution
    const userPlans = await prisma.user.groupBy({
      by: ['planType'],
      _count: {
        planType: true
      },
      where: {
        scanSessions: {
          some: {
            startedAt: {
              gte: new Date(Date.now() - 86400000) // Last 24 hours
            }
          }
        }
      }
    })
    
    const planDistribution = userPlans.reduce((acc, item) => {
      acc[item.planType] = item._count.planType
      return acc
    }, {} as Record<string, number>)
    
    const metrics: QueueMetrics = {
      timestamp: new Date().toISOString(),
      queueStats,
      avgWaitTime: Math.round(avgWaitTime),
      completionRate: Math.round(completionRate * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      planDistribution
    }
    
    // Store metrics in database for historical tracking
    await prisma.agentMetric.createMany({
      data: [
        {
          agentType: 'QUEUE_MANAGER',
          metricType: 'performance',
          name: 'avg_wait_time',
          value: metrics.avgWaitTime,
          unit: 'ms',
          metadata: metrics as any
        },
        {
          agentType: 'QUEUE_MANAGER',
          metricType: 'performance',
          name: 'completion_rate',
          value: metrics.completionRate,
          unit: 'percentage',
          metadata: metrics as any
        },
        {
          agentType: 'QUEUE_MANAGER',
          metricType: 'performance',
          name: 'error_rate',
          value: metrics.errorRate,
          unit: 'percentage',
          metadata: metrics as any
        },
        {
          agentType: 'QUEUE_MANAGER',
          metricType: 'queue',
          name: 'total_queued',
          value: metrics.queueStats.pending + metrics.queueStats.processing,
          unit: 'count',
          metadata: metrics as any
        }
      ]
    })
    
    console.log('[Job] Queue metrics job completed successfully:', {
      avgWaitTime: `${metrics.avgWaitTime}ms`,
      completionRate: `${metrics.completionRate}%`,
      errorRate: `${metrics.errorRate}%`,
      totalQueued: metrics.queueStats.pending + metrics.queueStats.processing
    })
    
    return metrics
  } catch (error) {
    console.error('[Job] Queue metrics job failed:', error)
    throw error
  }
}

// If executed directly
if (require.main === module) {
  runQueueMetricsJob()
    .then(metrics => {
      console.log('Metrics collected:', metrics)
      process.exit(0)
    })
    .catch(error => {
      console.error('Metrics collection failed:', error)
      process.exit(1)
    })
}