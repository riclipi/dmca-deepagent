// app/api/brand-profiles/[id]/route.ts - Individual brand profile operations with validation

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ApiResponse } from '@/lib/api-response'
import { 
  validateRequest,
  CommonSchemas,
  logValidationFailure 
} from '@/lib/middleware/validation'
import { ValidationSchemas } from '@/lib/validations/schemas'
import { z } from 'zod'

// Params validation schema
const paramsSchema = z.object({
  id: CommonSchemas.id
})

// GET /api/brand-profiles/[id] - Get single brand profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    // Await params
    const resolvedParams = await params

    // Validate params
    const validation = paramsSchema.safeParse(resolvedParams)
    if (!validation.success) {
      return ApiResponse.badRequest('Invalid profile ID')
    }

    const profile = await prisma.brandProfile.findFirst({
      where: {
        id: validation.data.id,
        userId: session.user.id
      },
      include: {
        _count: {
          select: {
            monitoringSessions: true,
            detectedContent: true,
            referenceImages: true
          }
        },
        monitoringSessions: {
          take: 5,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            status: true,
            isActive: true,
            lastScanAt: true,
            resultsFound: true
          }
        }
      }
    })

    if (!profile) {
      return ApiResponse.notFound('Brand profile not found')
    }

    return ApiResponse.success(profile)

  } catch (error) {
    console.error('Error fetching brand profile:', error)
    return ApiResponse.error('Failed to fetch brand profile')
  }
}

// PATCH /api/brand-profiles/[id] - Update brand profile
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    // Await params
    const resolvedParams = await params

    // Validate params
    const paramsValidation = paramsSchema.safeParse(resolvedParams)
    if (!paramsValidation.success) {
      return ApiResponse.badRequest('Invalid profile ID')
    }

    // Parse and validate body
    let body
    try {
      body = await request.json()
    } catch {
      return ApiResponse.badRequest('Invalid JSON in request body')
    }

    const bodyValidation = ValidationSchemas.brandProfile.update.safeParse(body)
    
    if (!bodyValidation.success) {
      logValidationFailure('PATCH /api/brand-profiles/[id]', bodyValidation.error, request)
      return ApiResponse.badRequest('Invalid input data', bodyValidation.error.errors)
    }

    // Check ownership
    const existing = await prisma.brandProfile.findFirst({
      where: {
        id: paramsValidation.data.id,
        userId: session.user.id
      }
    })

    if (!existing) {
      return ApiResponse.notFound('Brand profile not found')
    }

    // Check for duplicate name if updating brandName
    if (bodyValidation.data.brandName && bodyValidation.data.brandName !== existing.brandName) {
      const duplicate = await prisma.brandProfile.findFirst({
        where: {
          userId: session.user.id,
          brandName: {
            equals: bodyValidation.data.brandName,
            mode: 'insensitive'
          },
          id: { not: existing.id }
        }
      })

      if (duplicate) {
        return ApiResponse.badRequest('A brand profile with this name already exists')
      }
    }

    // Update profile
    const updated = await prisma.brandProfile.update({
      where: { id: existing.id },
      data: {
        ...bodyValidation.data,
        // Regenerate safe keywords if brand name changed
        ...(bodyValidation.data.brandName && {
          safeKeywords: generateSafeKeywords(bodyValidation.data.brandName),
          dangerousKeywords: generateDangerousKeywords(bodyValidation.data.brandName)
        }),
        updatedAt: new Date()
      }
    })

    // Log update
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'BRAND_PROFILE_UPDATE',
        entityType: 'BrandProfile',
        entityId: updated.id,
        metadata: {
          changes: Object.keys(bodyValidation.data)
        }
      }
    })

    return ApiResponse.success(updated, {
      message: 'Brand profile updated successfully'
    })

  } catch (error) {
    console.error('Error updating brand profile:', error)
    return ApiResponse.error('Failed to update brand profile')
  }
}

// DELETE /api/brand-profiles/[id] - Delete brand profile
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    // Await params
    const resolvedParams = await params

    // Validate params
    const validation = paramsSchema.safeParse(resolvedParams)
    if (!validation.success) {
      return ApiResponse.badRequest('Invalid profile ID')
    }

    // Check ownership
    const profile = await prisma.brandProfile.findFirst({
      where: {
        id: validation.data.id,
        userId: session.user.id
      },
      include: {
        _count: {
          select: {
            monitoringSessions: true,
            detectedContent: true
          }
        }
      }
    })

    if (!profile) {
      return ApiResponse.notFound('Brand profile not found')
    }

    // Check if profile has active monitoring sessions
    if (profile._count.monitoringSessions > 0) {
      return ApiResponse.badRequest(
        'Cannot delete brand profile with active monitoring sessions. ' +
        'Please delete all monitoring sessions first.'
      )
    }

    // Check if profile has detected content
    if (profile._count.detectedContent > 0) {
      return ApiResponse.badRequest(
        'Cannot delete brand profile with detected content. ' +
        'Please handle all detected content first.'
      )
    }

    // Soft delete (set isActive to false)
    await prisma.brandProfile.update({
      where: { id: profile.id },
      data: { isActive: false }
    })

    // Log deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'BRAND_PROFILE_DELETE',
        entityType: 'BrandProfile',
        entityId: profile.id,
        metadata: {
          brandName: profile.brandName
        }
      }
    })

    return ApiResponse.success(null, {
      message: 'Brand profile deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting brand profile:', error)
    return ApiResponse.error('Failed to delete brand profile')
  }
}

// Helper functions (same as in parent route)
function generateSafeKeywords(brandName: string): string[] {
  const keywords = [brandName]
  const words = brandName.split(/\s+/)
  
  if (words.length > 1) {
    keywords.push(...words)
  }
  
  const variations = [
    brandName.toLowerCase(),
    brandName.toUpperCase(),
    brandName.replace(/\s+/g, ''),
    brandName.replace(/\s+/g, '_'),
    brandName.replace(/\s+/g, '-')
  ]
  
  keywords.push(...variations)
  
  return [...new Set(keywords.filter(k => k.length > 0))]
}

function generateDangerousKeywords(brandName: string): string[] {
  const dangerous = []
  
  if (brandName.length === 1) {
    dangerous.push(brandName)
  }
  
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at']
  const brandWords = brandName.toLowerCase().split(/\s+/)
  
  for (const word of brandWords) {
    if (commonWords.includes(word)) {
      dangerous.push(word)
    }
  }
  
  return dangerous
}