// app/api/queue/status/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { fairQueueManager } from '@/lib/services/security/fair-queue-manager'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const queueStatus = await fairQueueManager.getQueueStatus(session.user.id)

    return NextResponse.json({
      success: true,
      data: queueStatus
    })
  } catch (error) {
    console.error('[Queue Status API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}