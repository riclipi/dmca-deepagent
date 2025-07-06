// app/api/queue/cancel/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { fairQueueManager } from '@/lib/services/security/fair-queue-manager'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { queueId } = body

    if (!queueId) {
      return NextResponse.json(
        { error: 'Queue ID is required' },
        { status: 400 }
      )
    }

    const cancelled = await fairQueueManager.cancelQueuedScan(session.user.id, queueId)

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Scan not found in queue or already processing' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Scan cancelled successfully'
    })
  } catch (error) {
    console.error('[Queue Cancel API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}