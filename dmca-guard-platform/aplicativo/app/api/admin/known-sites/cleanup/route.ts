// app/api/admin/known-sites/cleanup/route.ts - Cleanup inactive sites

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { KnownSitesService } from '@/lib/services/known-sites.service'

// POST /api/admin/known-sites/cleanup
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

    const knownSitesService = KnownSitesService.getInstance()
    const count = await knownSitesService.cleanupInactiveSites()
    
    return ApiResponse.success({
      cleaned: count,
      message: `Deactivated ${count} inactive sites`
    })
  } catch (error) {
    console.error('Error cleaning up sites:', error)
    return ApiResponse.error('Failed to cleanup sites')
  }
}