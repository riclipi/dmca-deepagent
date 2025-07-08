// app/api/admin/known-sites/[id]/route.ts - Operations on specific known sites

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { KnownSitesService } from '@/lib/services/known-sites.service'
import { SiteCategory } from '@prisma/client'
import { z } from 'zod'

const UpdateSiteSchema = z.object({
  category: z.nativeEnum(SiteCategory).optional(),
  platform: z.string().optional(),
  riskScore: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  crawlDelay: z.number().min(0).max(10000).optional()
})

// PATCH /api/admin/known-sites/[id]
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get params
    const params = await context.params
    
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return ApiResponse.unauthorized('Authentication required')
    }
    
    // Check admin access
    if (session.user.planType !== 'SUPER_USER') {
      return ApiResponse.forbidden('Admin access required')
    }

    const body = await request.json()
    
    // Validate input
    const validation = UpdateSiteSchema.safeParse(body)
    if (!validation.success) {
      return ApiResponse.validationError(validation.error, 'Invalid update data')
    }
    
    // Update site
    const knownSitesService = KnownSitesService.getInstance()
    const site = await knownSitesService.updateSite(params.id, validation.data)
    
    return ApiResponse.success({
      site,
      message: 'Site updated successfully'
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return ApiResponse.notFound('Site not found')
    }
    
    console.error('Error updating site:', error)
    return ApiResponse.error('Failed to update site')
  }
}

// DELETE /api/admin/known-sites/[id]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get params
    const params = await context.params
    
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return ApiResponse.unauthorized('Authentication required')
    }
    
    // Check admin access
    if (session.user.planType !== 'SUPER_USER') {
      return ApiResponse.forbidden('Admin access required')
    }

    // Delete site
    const knownSitesService = KnownSitesService.getInstance()
    await knownSitesService.deleteSite(params.id)
    
    return ApiResponse.success({
      message: 'Site deleted successfully'
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return ApiResponse.notFound('Site not found')
    }
    
    console.error('Error deleting site:', error)
    return ApiResponse.error('Failed to delete site')
  }
}