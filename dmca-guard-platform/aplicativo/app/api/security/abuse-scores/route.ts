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

    // Check if user is admin
    if (session.user.planType !== 'SUPER_USER' && session.user.planType !== 'ENTERPRISE') {
      return ApiResponse.forbidden('Admin access required')
    }

    // Get all abuse scores with user details and recent violations
    const abuseScores = await prisma.abuseScore.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            planType: true,
          }
        },
        violations: {
          orderBy: {
            occurredAt: 'desc'
          },
          take: 10 // Last 10 violations
        }
      },
      orderBy: {
        currentScore: 'desc'
      }
    })

    return ApiResponse.success(abuseScores)
  } catch (error) {
    console.error('Error fetching abuse scores:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to fetch abuse scores'),
      process.env.NODE_ENV === 'development'
    )
  }
}