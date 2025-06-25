import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dmcaContactDetector } from '@/lib/dmca-contact-detector'
import { canPerformAction } from '@/lib/plans'

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
    const { detectedContentId, url } = body

    if (!detectedContentId && !url) {
      return NextResponse.json(
        { error: 'detectedContentId or url is required' },
        { status: 400 }
      )
    }

    // Check user plan limits
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Count current DMCA contact detections this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const monthlyDetections = await prisma.dmcaContactInfo.count({
      where: {
        detectedContent: {
          userId: session.user.id
        },
        createdAt: {
          gte: startOfMonth
        }
      }
    })

    const canDetect = canPerformAction(
      user.planType,
      'dmcaContactDetection',
      monthlyDetections,
      user.email
    )

    if (!canDetect) {
      return NextResponse.json(
        { error: 'Plan limit reached for DMCA contact detections this month' },
        { status: 403 }
      )
    }

    let targetUrl = url

    // If detectedContentId provided, get URL from database
    if (detectedContentId) {
      const detectedContent = await prisma.detectedContent.findFirst({
        where: {
          id: detectedContentId,
          userId: session.user.id
        }
      })

      if (!detectedContent) {
        return NextResponse.json(
          { error: 'Detected content not found' },
          { status: 404 }
        )
      }

      targetUrl = detectedContent.infringingUrl
    }

    console.log(`🔍 Detecting DMCA contact for: ${targetUrl}`)

    // Detect DMCA contact
    const contactInfo = await dmcaContactDetector.findDmcaContact(targetUrl)

    // Save to database if detectedContentId provided
    if (detectedContentId) {
      // Check if contact info already exists
      const existingContact = await prisma.dmcaContactInfo.findUnique({
        where: { detectedContentId }
      })

      if (existingContact) {
        // Update existing
        await prisma.dmcaContactInfo.update({
          where: { detectedContentId },
          data: {
            email: contactInfo.email,
            isCompliant: contactInfo.isCompliant,
            contactPage: contactInfo.contactPage,
            detectedMethod: contactInfo.detectedMethod,
            confidence: contactInfo.confidence,
            additionalEmails: contactInfo.additionalEmails,
            lastCheckedAt: new Date()
          }
        })
      } else {
        // Create new
        await prisma.dmcaContactInfo.create({
          data: {
            detectedContentId,
            email: contactInfo.email,
            isCompliant: contactInfo.isCompliant,
            contactPage: contactInfo.contactPage,
            detectedMethod: contactInfo.detectedMethod,
            confidence: contactInfo.confidence,
            additionalEmails: contactInfo.additionalEmails
          }
        })
      }

      console.log(`✅ DMCA contact saved for content: ${detectedContentId}`)
    }

    return NextResponse.json({
      success: true,
      contactInfo,
      message: contactInfo.email 
        ? `DMCA contact found: ${contactInfo.email}` 
        : 'No DMCA contact found'
    })

  } catch (error) {
    console.error('Error detecting DMCA contact:', error)
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

    const { searchParams } = new URL(request.url)
    const detectedContentId = searchParams.get('detectedContentId')

    if (!detectedContentId) {
      return NextResponse.json(
        { error: 'detectedContentId is required' },
        { status: 400 }
      )
    }

    // Get existing DMCA contact info
    const contactInfo = await prisma.dmcaContactInfo.findUnique({
      where: { detectedContentId },
      include: {
        detectedContent: {
          select: {
            userId: true,
            infringingUrl: true,
            platform: true
          }
        }
      }
    })

    if (!contactInfo) {
      return NextResponse.json(
        { error: 'DMCA contact info not found' },
        { status: 404 }
      )
    }

    // Verify user owns this content
    if (contactInfo.detectedContent.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      contactInfo: {
        email: contactInfo.email,
        isCompliant: contactInfo.isCompliant,
        contactPage: contactInfo.contactPage,
        detectedMethod: contactInfo.detectedMethod,
        confidence: contactInfo.confidence,
        additionalEmails: contactInfo.additionalEmails,
        lastCheckedAt: contactInfo.lastCheckedAt
      }
    })

  } catch (error) {
    console.error('Error getting DMCA contact info:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}