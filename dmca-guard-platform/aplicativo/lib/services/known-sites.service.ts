// lib/services/known-sites.service.ts - Service for managing known sites from database

import { prisma } from '@/lib/prisma'
import { KnownSite, SiteCategory, Prisma } from '@prisma/client'

export interface KnownSiteWithStats extends KnownSite {
  recentViolations: number
  successRate: number
}

export class KnownSitesService {
  private static instance: KnownSitesService
  private siteCache: Map<string, KnownSite> = new Map()
  private lastCacheUpdate: Date = new Date(0)
  private readonly CACHE_TTL = 3600000 // 1 hour

  private constructor() {}

  static getInstance(): KnownSitesService {
    if (!KnownSitesService.instance) {
      KnownSitesService.instance = new KnownSitesService()
    }
    return KnownSitesService.instance
  }

  /**
   * Get all active known sites with optional filtering
   */
  async getActiveSites(options?: {
    category?: SiteCategory
    platform?: string
    minRiskScore?: number
    limit?: number
  }): Promise<KnownSite[]> {
    // Check cache first
    if (this.isCacheValid() && !options) {
      return Array.from(this.siteCache.values())
    }

    const where: Prisma.KnownSiteWhereInput = {
      isActive: true,
      ...(options?.category && { category: options.category }),
      ...(options?.platform && { platform: options.platform }),
      ...(options?.minRiskScore && { riskScore: { gte: options.minRiskScore } })
    }

    const sites = await prisma.knownSite.findMany({
      where,
      orderBy: [
        { riskScore: 'desc' },
        { totalViolations: 'desc' }
      ],
      take: options?.limit
    })

    // Update cache if fetching all sites
    if (!options) {
      this.updateCache(sites)
    }

    return sites
  }

  /**
   * Get high-risk sites (risk score >= 80)
   */
  async getHighRiskSites(limit?: number): Promise<KnownSite[]> {
    return this.getActiveSites({
      minRiskScore: 80,
      limit
    })
  }

  /**
   * Get sites by category
   */
  async getSitesByCategory(category: SiteCategory): Promise<KnownSite[]> {
    return this.getActiveSites({ category })
  }

  /**
   * Get leak-specific sites
   */
  async getLeakSites(): Promise<KnownSite[]> {
    return this.getActiveSites({ category: 'ADULT_CONTENT' })
  }

  /**
   * Get site domains as array (for compatibility with old code)
   */
  async getSiteDomains(options?: {
    category?: SiteCategory
    asUrls?: boolean
  }): Promise<string[]> {
    const sites = await this.getActiveSites(options)
    
    return sites.map(site => 
      options?.asUrls ? site.baseUrl : site.domain
    )
  }

  /**
   * Search for sites by domain pattern
   */
  async searchSites(query: string): Promise<KnownSite[]> {
    return prisma.knownSite.findMany({
      where: {
        OR: [
          { domain: { contains: query, mode: 'insensitive' } },
          { baseUrl: { contains: query, mode: 'insensitive' } }
        ],
        isActive: true
      },
      orderBy: { riskScore: 'desc' }
    })
  }

  /**
   * Get site statistics
   */
  async getSiteStats(): Promise<{
    total: number
    byCategory: Record<string, number>
    byRiskLevel: {
      high: number
      medium: number
      low: number
    }
    recentlyChecked: number
    withViolations: number
  }> {
    const [
      total,
      byCategory,
      highRisk,
      mediumRisk,
      lowRisk,
      recentlyChecked,
      withViolations
    ] = await Promise.all([
      prisma.knownSite.count({ where: { isActive: true } }),
      prisma.knownSite.groupBy({
        by: ['category'],
        where: { isActive: true },
        _count: { category: true }
      }),
      prisma.knownSite.count({ where: { isActive: true, riskScore: { gte: 80 } } }),
      prisma.knownSite.count({ where: { isActive: true, riskScore: { gte: 50, lt: 80 } } }),
      prisma.knownSite.count({ where: { isActive: true, riskScore: { lt: 50 } } }),
      prisma.knownSite.count({
        where: {
          isActive: true,
          lastChecked: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.knownSite.count({ where: { isActive: true, totalViolations: { gt: 0 } } })
    ])

    const categoryMap: Record<string, number> = {}
    byCategory.forEach(item => {
      categoryMap[item.category] = item._count.category
    })

    return {
      total,
      byCategory: categoryMap,
      byRiskLevel: {
        high: highRisk,
        medium: mediumRisk,
        low: lowRisk
      },
      recentlyChecked,
      withViolations
    }
  }

  /**
   * Add a new site
   */
  async addSite(data: {
    domain: string
    category: SiteCategory
    platform?: string
    riskScore?: number
    userId: string
  }): Promise<KnownSite> {
    const baseUrl = data.domain.startsWith('http') 
      ? data.domain 
      : `https://${data.domain}`

    const cleanDomain = data.domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]

    return prisma.knownSite.create({
      data: {
        baseUrl,
        domain: cleanDomain,
        category: data.category,
        platform: data.platform,
        riskScore: data.riskScore || 50,
        isActive: true,
        userId: data.userId
      }
    })
  }

  /**
   * Update site information
   */
  async updateSite(
    id: string,
    data: Partial<{
      category: SiteCategory
      platform: string
      riskScore: number
      isActive: boolean
      crawlDelay: number
    }>
  ): Promise<KnownSite> {
    const updated = await prisma.knownSite.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    })

    // Invalidate cache
    this.invalidateCache()

    return updated
  }

  /**
   * Delete a site
   */
  async deleteSite(id: string): Promise<void> {
    const deleted = await prisma.knownSite.delete({
      where: { id }
    })

    if (!deleted) {
      throw new Error('Site not found')
    }

    // Invalidate cache
    this.invalidateCache()
  }

  /**
   * Record a violation for a site
   */
  async recordViolation(siteId: string): Promise<void> {
    await prisma.knownSite.update({
      where: { id: siteId },
      data: {
        totalViolations: { increment: 1 },
        lastViolation: new Date(),
        lastChecked: new Date()
      }
    })

    // Invalidate cache
    this.invalidateCache()
  }

  /**
   * Update site check status
   */
  async updateCheckStatus(
    siteId: string,
    success: boolean,
    responseTime?: number
  ): Promise<void> {
    await prisma.knownSite.update({
      where: { id: siteId },
      data: {
        lastChecked: new Date(),
        lastCrawlSuccess: success,
        ...(responseTime && { avgResponseTime: responseTime })
      }
    })
  }

  /**
   * Bulk import sites
   */
  async bulkImportSites(
    sites: Array<{
      domain: string
      category: SiteCategory
      platform?: string
      riskScore?: number
    }>,
    userId: string
  ): Promise<{ created: number; skipped: number }> {
    let created = 0
    let skipped = 0

    for (const site of sites) {
      try {
        await this.addSite({ ...site, userId })
        created++
      } catch (error) {
        if (error instanceof Error && error.message.includes('Unique constraint')) {
          skipped++
        } else {
          throw error
        }
      }
    }

    // Invalidate cache after bulk import
    this.invalidateCache()

    return { created, skipped }
  }

  /**
   * Validate site availability
   */
  async validateSiteAvailability(siteId: string): Promise<boolean> {
    const site = await prisma.knownSite.findUnique({
      where: { id: siteId }
    })

    if (!site) {
      throw new Error('Site not found')
    }

    try {
      const response = await fetch(site.baseUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      })

      const isAvailable = response.status < 500

      await this.updateCheckStatus(siteId, isAvailable, 0)

      return isAvailable
    } catch (error) {
      await this.updateCheckStatus(siteId, false)
      return false
    }
  }

  /**
   * Clean up inactive or dead sites
   */
  async cleanupInactiveSites(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const result = await prisma.knownSite.updateMany({
      where: {
        OR: [
          {
            lastCrawlSuccess: false,
            lastChecked: { lt: thirtyDaysAgo }
          },
          {
            totalViolations: 0,
            lastChecked: { lt: thirtyDaysAgo }
          }
        ]
      },
      data: {
        isActive: false
      }
    })

    // Invalidate cache after cleanup
    this.invalidateCache()

    return result.count
  }

  // Cache management
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate.getTime() < this.CACHE_TTL
  }

  private updateCache(sites: KnownSite[]): void {
    this.siteCache.clear()
    sites.forEach(site => {
      this.siteCache.set(site.id, site)
    })
    this.lastCacheUpdate = new Date()
  }

  private invalidateCache(): void {
    this.siteCache.clear()
    this.lastCacheUpdate = new Date(0)
  }
}

// Export singleton instance
export const knownSitesService = KnownSitesService.getInstance()