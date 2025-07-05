import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { AbuseState } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return ApiResponse.unauthorized()
    }

    // Check if user is admin
    if (session.user.planType !== 'SUPER_USER' && session.user.planType !== 'ENTERPRISE') {
      return ApiResponse.forbidden('Admin access required')
    }

    // Get total users
    const totalUsers = await prisma.user.count({
      where: {
        status: {
          not: 'DELETED'
        }
      }
    })

    // Get users by state
    const stateCount = await prisma.abuseScore.groupBy({
      by: ['state'],
      _count: {
        state: true
      }
    })

    // Get recent violations (last 24 hours)
    const recentViolations = await prisma.abuseViolation.count({
      where: {
        occurredAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    })

    // Calculate average score
    const avgScore = await prisma.abuseScore.aggregate({
      _avg: {
        currentScore: true
      }
    })

    // Format state counts
    const stateCounts = {
      cleanUsers: 0,
      warningUsers: 0,
      highRiskUsers: 0,
      blockedUsers: 0
    }

    stateCount.forEach(item => {
      switch (item.state) {
        case AbuseState.CLEAN:
          stateCounts.cleanUsers = item._count.state
          break
        case AbuseState.WARNING:
          stateCounts.warningUsers = item._count.state
          break
        case AbuseState.HIGH_RISK:
          stateCounts.highRiskUsers = item._count.state
          break
        case AbuseState.BLOCKED:
          stateCounts.blockedUsers = item._count.state
          break
      }
    })

    // Users without abuse scores are considered clean
    const usersWithScores = Object.values(stateCounts).reduce((sum, count) => sum + count, 0)
    stateCounts.cleanUsers += Math.max(0, totalUsers - usersWithScores)

    const stats = {
      totalUsers,
      ...stateCounts,
      recentViolations,
      averageScore: avgScore._avg.currentScore || 0
    }

    return ApiResponse.success(stats)
  } catch (error) {
    console.error('Error fetching abuse stats:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to fetch abuse stats'),
      process.env.NODE_ENV === 'development'
    )
  }
}