// app/api/admin/known-sites/route.ts - Admin API for managing known sites

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { knownSitesService } from '@/lib/services/known-sites.service'
import { SiteCategory } from '@prisma/client'
import { z } from 'zod'

// Input validation schemas
const GetSitesSchema = z.object({
  category: z.nativeEnum(SiteCategory).optional(),
  platform: z.string().optional(),
  minRiskScore: z.number().min(0).max(100).optional(),
  limit: z.number().min(1).max(1000).optional(),
  search: z.string().optional()
})

const AddSiteSchema = z.object({
  domain: z.string().min(3).max(255),
  category: z.nativeEnum(SiteCategory),
  platform: z.string().optional(),
  riskScore: z.number().min(0).max(100).optional()
})

const UpdateSiteSchema = z.object({
  category: z.nativeEnum(SiteCategory).optional(),
  platform: z.string().optional(),
  riskScore: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  crawlDelay: z.number().min(0).max(10000).optional()
})

const BulkImportSchema = z.object({
  sites: z.array(z.object({
    domain: z.string(),
    category: z.nativeEnum(SiteCategory),
    platform: z.string().optional(),
    riskScore: z.number().min(0).max(100).optional()
  })).min(1).max(1000)
})

// Middleware to check admin access
async function requireAdmin(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return ApiResponse.unauthorized('Authentication required')
  }
  
  // Check if user is admin or super user
  const isAdmin = session.user.email === process.env.SUPER_USER_EMAIL ||
                  session.user.planType === 'SUPER_USER' ||
                  session.user.planType === 'ENTERPRISE'
  
  if (!isAdmin) {
    return ApiResponse.forbidden('Admin access required')
  }
  
  return null
}

// GET /api/admin/known-sites
export async function GET(request: NextRequest) {
  // Check admin access
  const authError = await requireAdmin(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())
    
    // Validate input
    const validation = GetSitesSchema.safeParse({
      ...params,
      minRiskScore: params.minRiskScore ? parseInt(params.minRiskScore) : undefined,
      limit: params.limit ? parseInt(params.limit) : undefined
    })
    
    if (!validation.success) {
      return ApiResponse.badRequest('Invalid parameters', validation.error.errors)
    }
    
    const { search, ...options } = validation.data
    
    // Search or get sites
    let sites
    if (search) {
      sites = await knownSitesService.searchSites(search)
    } else {
      sites = await knownSitesService.getActiveSites(options)
    }
    
    // Get statistics
    const stats = await knownSitesService.getSiteStats()
    
    return ApiResponse.success({
      sites,
      stats,
      total: sites.length
    })
  } catch (error) {
    console.error('Error fetching known sites:', error)
    return ApiResponse.error('Failed to fetch sites')
  }
}

// POST /api/admin/known-sites
export async function POST(request: NextRequest) {
  // Check admin access
  const authError = await requireAdmin(request)
  if (authError) return authError

  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    
    // Validate input
    const validation = AddSiteSchema.safeParse(body)
    if (!validation.success) {
      return ApiResponse.badRequest('Invalid site data', validation.error.errors)
    }
    
    // Add site
    const site = await knownSitesService.addSite({
      ...validation.data,
      userId: session!.user.id
    })
    
    return ApiResponse.success({
      site,
      message: 'Site added successfully'
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return ApiResponse.badRequest('Site already exists')
    }
    
    console.error('Error adding site:', error)
    return ApiResponse.error('Failed to add site')
  }
}