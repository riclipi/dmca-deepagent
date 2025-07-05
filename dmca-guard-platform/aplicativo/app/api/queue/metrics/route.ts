import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return ApiResponse.unauthorized()
    }

    // Get the latest metrics from the database
    const latestMetrics = await prisma.agentMetric.findMany({
      where: {
        agentType: 'QUEUE_MANAGER',
        timestamp: {
          gte: new Date(Date.now() - 300000) // Last 5 minutes
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 4 // We need the 4 different metric types
    })

    // Extract metrics
    const metrics = {
      avgWaitTime: 0,
      completionRate: 0,
      errorRate: 0,
      planDistribution: {} as Record<string, number>
    }

    latestMetrics.forEach(metric => {
      switch (metric.name) {
        case 'avg_wait_time':
          metrics.avgWaitTime = metric.value
          break
        case 'completion_rate':
          metrics.completionRate = metric.value
          break
        case 'error_rate':
          metrics.errorRate = metric.value
          break
      }
      
      // Extract plan distribution from metadata
      if (metric.metadata && typeof metric.metadata === 'object' && 'planDistribution' in metric.metadata) {
        const metadata = metric.metadata as any
        if (metadata.planDistribution) {
          metrics.planDistribution = metadata.planDistribution
        }
      }
    })

    // If no recent metrics, calculate them on the fly
    if (latestMetrics.length === 0) {
      const oneHourAgo = new Date(Date.now() - 3600000)
      
      // Calculate completion rate
      const completedSessions = await prisma.scanSession.count({
        where: {
          completedAt: {
            gte: oneHourAgo
          }
        }
      })
      
      const totalSessions = await prisma.scanSession.count({
        where: {
          startedAt: {
            gte: oneHourAgo
          }
        }
      })
      
      const errorSessions = await prisma.scanSession.count({
        where: {
          startedAt: {
            gte: oneHourAgo
          },
          status: 'ERROR'
        }
      })
      
      metrics.completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0
      metrics.errorRate = totalSessions > 0 ? (errorSessions / totalSessions) * 100 : 0
      
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
      
      metrics.planDistribution = userPlans.reduce((acc, item) => {
        acc[item.planType] = item._count.planType
        return acc
      }, {} as Record<string, number>)
    }
    
    return ApiResponse.success(metrics)
  } catch (error) {
    console.error('Error fetching queue metrics:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to fetch queue metrics'),
      process.env.NODE_ENV === 'development'
    )
  }
}