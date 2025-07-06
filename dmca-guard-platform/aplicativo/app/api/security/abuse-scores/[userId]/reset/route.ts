import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { AbuseState } from '@prisma/client'
import { logActivity } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return ApiResponse.unauthorized()
    }

    // Check if user is admin
    if (session.user.planType !== 'SUPER_USER') {
      return ApiResponse.forbidden('Super admin access required')
    }

    const { userId } = await params

    // Find the abuse score
    const abuseScore = await prisma.abuseScore.findUnique({
      where: { userId }
    })

    if (!abuseScore) {
      return ApiResponse.notFound('Abuse score not found')
    }

    // Reset the score
    const updated = await prisma.abuseScore.update({
      where: { userId },
      data: {
        currentScore: 0,
        state: AbuseState.CLEAN,
        lastViolation: null
      }
    })

    // Log the action
    await logActivity(
      session.user.id,
      'RESET_ABUSE_SCORE',
      'abuse_score',
      {
        targetUserId: userId,
        previousScore: abuseScore.currentScore,
        previousState: abuseScore.state
      }
    )

    return ApiResponse.success({
      message: 'Abuse score reset successfully',
      abuseScore: updated
    })
  } catch (error) {
    console.error('Error resetting abuse score:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to reset abuse score'),
      process.env.NODE_ENV === 'development'
    )
  }
}