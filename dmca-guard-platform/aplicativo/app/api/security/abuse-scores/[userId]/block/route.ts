import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { AbuseState, UserStatus } from '@prisma/client'
import { logActivity } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
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

    const { userId } = params

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        abuseScore: true
      }
    })

    if (!user) {
      return ApiResponse.notFound('User not found')
    }

    // Update or create abuse score
    const abuseScore = await prisma.abuseScore.upsert({
      where: { userId },
      update: {
        state: AbuseState.BLOCKED,
        currentScore: 999 // Max score
      },
      create: {
        userId,
        state: AbuseState.BLOCKED,
        currentScore: 999
      }
    })

    // Suspend the user
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.SUSPENDED
      }
    })

    // Log the action
    await logActivity({
      userId: session.user.id,
      action: 'BLOCK_USER',
      resource: 'user',
      details: {
        targetUserId: userId,
        reason: 'Manual block by admin',
        previousStatus: user.status
      }
    })

    return ApiResponse.success({
      message: 'User blocked successfully',
      abuseScore
    })
  } catch (error) {
    console.error('Error blocking user:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to block user'),
      process.env.NODE_ENV === 'development'
    )
  }
}