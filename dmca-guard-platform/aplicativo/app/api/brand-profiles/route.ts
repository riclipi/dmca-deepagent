// app/api/brand-profiles/route.ts - Brand profiles API with Zod validation

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ApiResponse } from '@/lib/api-response'
import { 
  createValidatedHandler, 
  validateRequest,
  CommonSchemas,
  logValidationFailure 
} from '@/lib/middleware/validation'
import { ValidationSchemas } from '@/lib/validations/schemas'
import { checkPlanLimit } from '@/lib/auth-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET /api/brand-profiles - List user's brand profiles
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    // Validate query parameters
    const querySchema = z.object({
      isActive: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
      search: z.string().max(100).optional(),
      ...CommonSchemas.pagination.shape
    })

    const validation = await validateRequest(request, { query: querySchema })
    if (!validation.success) {
      return validation.error!
    }

    const { isActive, search, page, limit, sortBy, sortOrder } = validation.data?.query || {}
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      userId: session.user.id
    }

    if (isActive !== undefined) {
      where.isActive = isActive
    }

    if (search) {
      where.OR = [
        { brandName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get profiles with pagination
    const [profiles, total] = await Promise.all([
      prisma.brandProfile.findMany({
        where,
        include: {
          _count: {
            select: {
              monitoringSessions: true,
              detectedContent: true,
              referenceImages: true
            }
          }
        },
        orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.brandProfile.count({ where })
    ])

    return ApiResponse.success({
      profiles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching brand profiles:', error)
    return ApiResponse.error('Failed to fetch brand profiles')
  }
}

// POST /api/brand-profiles - Create new brand profile
export const POST = createValidatedHandler(
  {
    body: ValidationSchemas.brandProfile.create
  },
  async (request, { body }) => {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return ApiResponse.unauthorized()
      }

      // Check plan limits
      const canCreate = await checkPlanLimit(
        session.user.id,
        'BRAND_PROFILE_CREATE'
      )

      if (!canCreate) {
        return ApiResponse.forbidden(
          'You have reached the brand profile limit for your plan'
        )
      }

      // Check for duplicate brand name
      const existing = await prisma.brandProfile.findFirst({
        where: {
          userId: session.user.id,
          brandName: {
            equals: body.brandName,
            mode: 'insensitive'
          }
        }
      })

      if (existing) {
        return ApiResponse.badRequest('A brand profile with this name already exists')
      }

      // Generate safe keywords from brand name
      const safeKeywords = generateSafeKeywords(body.brandName)
      
      // Create brand profile
      const profile = await prisma.brandProfile.create({
        data: {
          userId: session.user.id,
          brandName: body.brandName,
          description: body.description,
          officialUrls: body.officialUrls,
          socialMedia: body.socialMedia || {},
          keywords: body.keywords || [],
          safeKeywords,
          moderateKeywords: [],
          dangerousKeywords: generateDangerousKeywords(body.brandName),
          isActive: true
        }
      })

      // Log creation
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'BRAND_PROFILE_CREATE',
          resource: `BrandProfile:${profile.id}`,
          details: {
            brandName: profile.brandName
          }
        }
      })

      return ApiResponse.success(profile, {
        message: 'Brand profile created successfully'
      })

    } catch (error) {
      console.error('Error creating brand profile:', error)
      
      if (error instanceof z.ZodError) {
        logValidationFailure('POST /api/brand-profiles', error, request)
        return ApiResponse.badRequest('Invalid input data', error.errors)
      }
      
      return ApiResponse.error('Failed to create brand profile')
    }
  }
)

// Helper functions
function generateSafeKeywords(brandName: string): string[] {
  const keywords = [brandName]
  const words = brandName.split(/\s+/)
  
  // Add individual words if multi-word brand
  if (words.length > 1) {
    keywords.push(...words)
  }
  
  // Add common variations
  const variations = [
    brandName.toLowerCase(),
    brandName.toUpperCase(),
    brandName.replace(/\s+/g, ''),
    brandName.replace(/\s+/g, '_'),
    brandName.replace(/\s+/g, '-')
  ]
  
  keywords.push(...variations)
  
  // Remove duplicates and empty strings
  return [...new Set(keywords.filter(k => k.length > 0))]
}

function generateDangerousKeywords(brandName: string): string[] {
  // Keywords that should trigger manual review
  const dangerous = []
  
  // Too generic single letters or numbers
  if (brandName.length === 1) {
    dangerous.push(brandName)
  }
  
  // Common words that might generate false positives
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at']
  const brandWords = brandName.toLowerCase().split(/\s+/)
  
  for (const word of brandWords) {
    if (commonWords.includes(word)) {
      dangerous.push(word)
    }
  }
  
  return dangerous
}