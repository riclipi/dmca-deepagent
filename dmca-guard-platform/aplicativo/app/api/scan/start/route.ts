import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { realTimeScanner } from '@/lib/real-time-scanner'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { profileId, scanType = 'full' } = body

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId is required' },
        { status: 400 }
      )
    }

    // Verify user owns the profile
    const profile = await prisma.brandProfile.findFirst({
      where: {
        id: profileId,
        userId: session.user.id
      }
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Brand profile not found' },
        { status: 404 }
      )
    }

    // Check if user already has an active scan
    const activeScans = realTimeScanner.getActiveScanIds()
    const userActiveScans = activeScans.filter(scanId => {
      const scanProgress = realTimeScanner.getScanProgress(scanId)
      return scanProgress?.userId === session.user.id
    })

    if (userActiveScans.length > 0) {
      return NextResponse.json(
        { error: 'You already have an active scan running', activeScanId: userActiveScans[0] },
        { status: 409 }
      )
    }

    console.log(`🚀 Starting scan for user ${session.user.id}, profile ${profileId}`)

    // Start the scan
    const scanId = await realTimeScanner.startScan(session.user.id, profileId, scanType)

    return NextResponse.json({
      success: true,
      scanId,
      message: 'Scan started successfully'
    })

  } catch (error) {
    console.error('Error starting scan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's active scans
    const activeScans = realTimeScanner.getActiveScanIds()
    const userActiveScans = activeScans.filter(scanId => {
      const scanProgress = realTimeScanner.getScanProgress(scanId)
      return scanProgress?.userId === session.user.id
    })

    return NextResponse.json({
      success: true,
      activeScans: userActiveScans,
      hasActiveScans: userActiveScans.length > 0
    })

  } catch (error) {
    console.error('Error getting active scans:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}