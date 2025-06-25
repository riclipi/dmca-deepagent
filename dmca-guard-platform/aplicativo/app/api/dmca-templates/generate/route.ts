import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dmcaTemplateGenerator } from '@/lib/dmca-template-generator'

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
    const { detectedContentId, dmcaEmail, customMessage } = body

    if (!detectedContentId) {
      return NextResponse.json(
        { error: 'detectedContentId is required' },
        { status: 400 }
      )
    }

    // Get detected content with DMCA contact info
    const detectedContent = await prisma.detectedContent.findFirst({
      where: {
        id: detectedContentId,
        userId: session.user.id
      },
      include: {
        dmcaContactInfo: true,
        user: true
      }
    })

    if (!detectedContent) {
      return NextResponse.json(
        { error: 'Detected content not found' },
        { status: 404 }
      )
    }

    // Use provided email or detected email
    const contactEmail = dmcaEmail || detectedContent.dmcaContactInfo?.email

    if (!contactEmail) {
      return NextResponse.json(
        { error: 'No DMCA contact email available. Please detect contact first or provide email manually.' },
        { status: 400 }
      )
    }

    // Prepare user info
    const userInfo = {
      name: detectedContent.user.name,
      email: detectedContent.user.email,
      phone: detectedContent.user.phone || undefined,
      address: detectedContent.user.address || undefined
    }

    console.log(`🔧 Generating DMCA template for content: ${detectedContentId}`)

    // Generate template
    const template = dmcaTemplateGenerator.generateDmcaTemplate(
      detectedContent,
      contactEmail,
      userInfo,
      customMessage
    )

    console.log(`✅ DMCA template generated for ${contactEmail}`)

    return NextResponse.json({
      success: true,
      template: {
        subject: template.subject,
        body: template.body,
        isUrgent: template.isUrgent,
        legalReferences: template.legalReferences,
        recipientEmail: contactEmail,
        contactInfo: detectedContent.dmcaContactInfo
      },
      metadata: {
        contentUrl: detectedContent.infringingUrl,
        platform: detectedContent.platform,
        priority: detectedContent.priority,
        detectedAt: detectedContent.detectedAt
      }
    })

  } catch (error) {
    console.error('Error generating DMCA template:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Bulk template generation
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { detectedContentIds, customMessage } = body

    if (!detectedContentIds || !Array.isArray(detectedContentIds)) {
      return NextResponse.json(
        { error: 'detectedContentIds array is required' },
        { status: 400 }
      )
    }

    console.log(`🔧 Generating bulk DMCA templates for ${detectedContentIds.length} items`)

    // Get all detected content with DMCA contact info
    const detectedContents = await prisma.detectedContent.findMany({
      where: {
        id: { in: detectedContentIds },
        userId: session.user.id
      },
      include: {
        dmcaContactInfo: true,
        user: true
      }
    })

    if (detectedContents.length === 0) {
      return NextResponse.json(
        { error: 'No detected content found' },
        { status: 404 }
      )
    }

    // Prepare user info (same for all)
    const userInfo = {
      name: detectedContents[0].user.name,
      email: detectedContents[0].user.email,
      phone: detectedContents[0].user.phone || undefined,
      address: detectedContents[0].user.address || undefined
    }

    const templates = []
    const errors = []

    for (const content of detectedContents) {
      try {
        const contactEmail = content.dmcaContactInfo?.email

        if (!contactEmail) {
          errors.push({
            detectedContentId: content.id,
            error: 'No DMCA contact email available'
          })
          continue
        }

        const template = dmcaTemplateGenerator.generateDmcaTemplate(
          content,
          contactEmail,
          userInfo,
          customMessage
        )

        templates.push({
          detectedContentId: content.id,
          template: {
            subject: template.subject,
            body: template.body,
            isUrgent: template.isUrgent,
            recipientEmail: contactEmail
          },
          metadata: {
            contentUrl: content.infringingUrl,
            platform: content.platform,
            priority: content.priority
          }
        })

      } catch (error) {
        errors.push({
          detectedContentId: content.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`✅ Generated ${templates.length} DMCA templates, ${errors.length} errors`)

    return NextResponse.json({
      success: true,
      templates,
      errors,
      summary: {
        total: detectedContentIds.length,
        successful: templates.length,
        failed: errors.length
      }
    })

  } catch (error) {
    console.error('Error generating bulk DMCA templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}