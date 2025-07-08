// app/api/admin/known-sites/[id]/validate/route.ts - Validate site availability

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { KnownSitesService } from '@/lib/services/known-sites.service'

// POST /api/admin/known-sites/[id]/validate
export async function POST(
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

    const knownSitesService = KnownSitesService.getInstance()
    const isAvailable = await knownSitesService.validateSiteAvailability(params.id)
    
    return ApiResponse.success({
      available: isAvailable,
      message: isAvailable ? 'Site is available' : 'Site is not responding'
    })
  } catch (error) {
    console.error('Error validating site:', error)
    return ApiResponse.error('Failed to validate site')
  }
}