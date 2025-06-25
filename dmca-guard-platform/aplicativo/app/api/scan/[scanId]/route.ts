import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { realTimeScanner } from '@/lib/real-time-scanner'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { scanId } = await params

    const scanProgress = realTimeScanner.getScanProgress(scanId)
    
    if (!scanProgress) {
      return NextResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      )
    }

    // Verify user owns the scan
    if (scanProgress.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const scanMethods = realTimeScanner.getScanMethods(scanId)
    const scanInsights = realTimeScanner.getScanInsights(scanId)
    const scanActivities = realTimeScanner.getScanActivities(scanId)

    return NextResponse.json({
      success: true,
      scan: {
        progress: scanProgress,
        methods: scanMethods,
        insights: scanInsights,
        activities: scanActivities.slice(0, 20) // Latest 20 activities
      }
    })

  } catch (error) {
    console.error('Error getting scan data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { scanId } = await params

    const scanProgress = realTimeScanner.getScanProgress(scanId)
    
    if (!scanProgress) {
      return NextResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      )
    }

    // Verify user owns the scan
    if (scanProgress.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const stopped = realTimeScanner.stopScan(scanId)

    if (stopped) {
      return NextResponse.json({
        success: true,
        message: 'Scan stopped successfully'
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to stop scan or scan already completed' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error stopping scan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}