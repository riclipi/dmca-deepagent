// app/api/admin/known-sites/bulk-import/route.ts - Bulk import for known sites

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { KnownSitesService } from '@/lib/services/known-sites.service'
import { SiteCategory } from '@prisma/client'
import { z } from 'zod'

const BulkImportSchema = z.object({
  sites: z.array(z.object({
    domain: z.string(),
    category: z.nativeEnum(SiteCategory),
    platform: z.string().optional(),
    riskScore: z.number().min(0).max(100).optional()
  })).min(1).max(1000)
})

// POST /api/admin/known-sites/bulk-import
export async function POST(request: NextRequest) {
  try {
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
    const validation = BulkImportSchema.safeParse(body)
    if (!validation.success) {
      return ApiResponse.badRequest('Invalid import data', validation.error.errors)
    }
    
    // Bulk import
    const knownSitesService = KnownSitesService.getInstance()
    const result = await knownSitesService.bulkImportSites(
      validation.data.sites,
      session.user.id
    )
    
    return ApiResponse.success({
      ...result,
      message: `Imported ${result.created} sites, skipped ${result.skipped} duplicates`
    })
  } catch (error) {
    console.error('Error bulk importing sites:', error)
    return ApiResponse.error('Failed to import sites')
  }
}