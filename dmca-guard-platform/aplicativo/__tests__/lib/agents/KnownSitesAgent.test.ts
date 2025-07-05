import { KnownSitesAgent } from '@/lib/agents/KnownSitesAgent'
import { prisma } from '@/lib/prisma'
import { smartScraper } from '@/lib/scraping/smart-scraper'
import { keywordIntegrationService } from '@/lib/services/keyword-integration'
import { analyzeContentForViolation } from '@/lib/utils/ai-analyzer'
import { agentCacheManager } from '@/lib/cache/agent-cache-manager'
import { emitScanProgress } from '@/lib/socket-server'

// Mock all dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    knownSite: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn()
    },
    violationHistory: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    scanSession: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    detectedContent: {
      create: jest.fn()
    },
    $transaction: jest.fn()
  }
}))

jest.mock('@/lib/scraping/smart-scraper', () => ({
  smartScraper: {
    scrapeWithRetry: jest.fn()
  }
}))

jest.mock('@/lib/services/keyword-integration', () => ({
  keywordIntegrationService: {
    getSafeKeywordsForSession: jest.fn()
  }
}))

jest.mock('@/lib/utils/ai-analyzer', () => ({
  analyzeContentForViolation: jest.fn()
}))

jest.mock('@/lib/cache/agent-cache-manager', () => ({
  agentCacheManager: {
    getCachedViolation: jest.fn(),
    setCachedViolation: jest.fn(),
    getCachedContent: jest.fn(),
    setCachedContent: jest.fn()
  }
}))

jest.mock('@/lib/socket-server', () => ({
  emitScanProgress: jest.fn(),
  emitToRoom: jest.fn()
}))

describe('KnownSitesAgent', () => {
  let agent: KnownSitesAgent

  beforeEach(() => {
    agent = new KnownSitesAgent()
    jest.clearAllMocks()
  })

  describe('scanKnownSites', () => {
    const mockSession = {
      id: 'session-1',
      userId: 'user-1',
      brandProfileId: 'brand-1',
      status: 'IDLE' as const,
      sitesScanned: 0,
      violationsFound: 0,
      errorCount: 0
    }

    const mockKnownSites = [
      {
        id: 'site-1',
        baseUrl: 'https://example.com',
        domain: 'example.com',
        category: 'FORUM',
        totalViolations: 5,
        lastChecked: new Date(Date.now() - 86400000), // 1 day ago
        riskScore: 80,
        crawlDelay: 1000,
        blockedByRobots: false
      },
      {
        id: 'site-2',
        baseUrl: 'https://test.com',
        domain: 'test.com',
        category: 'FILE_SHARING',
        totalViolations: 10,
        lastChecked: new Date(Date.now() - 172800000), // 2 days ago
        riskScore: 90,
        crawlDelay: 2000,
        blockedByRobots: false
      }
    ]

    const mockKeywords = ['brand keyword', 'product name', 'company']

    beforeEach(() => {
      ;(prisma.scanSession.findUnique as jest.Mock).mockResolvedValue(mockSession)
      ;(prisma.knownSite.findMany as jest.Mock).mockResolvedValue(mockKnownSites)
      ;(keywordIntegrationService.getSafeKeywordsForSession as jest.Mock).mockResolvedValue(mockKeywords)
      ;(agentCacheManager.getCachedViolation as jest.Mock).mockResolvedValue(null)
      ;(agentCacheManager.getCachedContent as jest.Mock).mockResolvedValue(null)
    })

    it('should successfully scan known sites and detect violations', async () => {
      // Mock scraper responses
      ;(smartScraper.scrapeWithRetry as jest.Mock)
        .mockResolvedValueOnce({
          success: true,
          content: '<div>Selling fake brand keyword products</div>',
          metadata: {
            title: 'Fake Products Forum',
            description: 'Buy cheap brand keyword items'
          }
        })
        .mockResolvedValueOnce({
          success: true,
          content: '<div>Download product name for free</div>',
          metadata: {
            title: 'Free Downloads',
            description: 'Get product name without paying'
          }
        })

      // Mock AI analysis
      ;(analyzeContentForViolation as jest.Mock)
        .mockResolvedValueOnce({
          isViolation: true,
          confidence: 0.85,
          violationType: 'Counterfeit products',
          riskLevel: 'HIGH',
          explanation: 'Selling fake branded products'
        })
        .mockResolvedValueOnce({
          isViolation: true,
          confidence: 0.92,
          violationType: 'Copyright infringement',
          riskLevel: 'CRITICAL',
          explanation: 'Distributing copyrighted content'
        })

      // Mock transaction
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma)
      })

      const sessionId = await agent.scanKnownSites({
        sessionId: 'session-1',
        brandProfileId: 'brand-1',
        userId: 'user-1'
      })

      expect(sessionId).toBe('session-1')
      expect(smartScraper.scrapeWithRetry).toHaveBeenCalledTimes(2)
      expect(analyzeContentForViolation).toHaveBeenCalledTimes(2)
      expect(prisma.violationHistory.create).toHaveBeenCalledTimes(2)
      expect(prisma.detectedContent.create).toHaveBeenCalledTimes(2)
      expect(emitScanProgress).toHaveBeenCalled()
    })

    it('should skip sites that were recently checked', async () => {
      const recentSite = {
        ...mockKnownSites[0],
        lastChecked: new Date() // Just checked
      }
      
      ;(prisma.knownSite.findMany as jest.Mock).mockResolvedValue([recentSite])

      await agent.scanKnownSites({
        sessionId: 'session-1',
        brandProfileId: 'brand-1',
        userId: 'user-1'
      })

      expect(smartScraper.scrapeWithRetry).not.toHaveBeenCalled()
    })

    it('should handle scraping errors gracefully', async () => {
      ;(smartScraper.scrapeWithRetry as jest.Mock).mockRejectedValue(
        new Error('Network error')
      )

      await agent.scanKnownSites({
        sessionId: 'session-1',
        brandProfileId: 'brand-1',
        userId: 'user-1'
      })

      expect(prisma.scanSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          errorCount: expect.any(Number),
          lastError: expect.stringContaining('Network error')
        })
      })
    })

    it('should use cached content when available', async () => {
      const cachedContent = {
        url: 'https://example.com',
        content: '<div>Cached content</div>',
        metadata: { title: 'Cached' },
        cachedAt: new Date()
      }

      ;(agentCacheManager.getCachedContent as jest.Mock).mockResolvedValue(cachedContent)
      ;(analyzeContentForViolation as jest.Mock).mockResolvedValue({
        isViolation: false,
        confidence: 0.2
      })

      await agent.scanKnownSites({
        sessionId: 'session-1',
        brandProfileId: 'brand-1',
        userId: 'user-1'
      })

      expect(smartScraper.scrapeWithRetry).not.toHaveBeenCalled()
      expect(analyzeContentForViolation).toHaveBeenCalled()
    })

    it('should respect crawl delay between site scans', async () => {
      ;(smartScraper.scrapeWithRetry as jest.Mock).mockResolvedValue({
        success: true,
        content: '<div>Content</div>',
        metadata: {}
      })
      ;(analyzeContentForViolation as jest.Mock).mockResolvedValue({
        isViolation: false,
        confidence: 0.1
      })

      const startTime = Date.now()
      await agent.scanKnownSites({
        sessionId: 'session-1',
        brandProfileId: 'brand-1',
        userId: 'user-1'
      })
      const endTime = Date.now()

      // Should have delayed at least for the first site's crawl delay
      expect(endTime - startTime).toBeGreaterThanOrEqual(mockKnownSites[0].crawlDelay)
    })

    it('should handle sites blocked by robots.txt', async () => {
      const blockedSite = {
        ...mockKnownSites[0],
        blockedByRobots: true
      }
      
      ;(prisma.knownSite.findMany as jest.Mock).mockResolvedValue([blockedSite])

      await agent.scanKnownSites({
        sessionId: 'session-1',
        brandProfileId: 'brand-1',
        userId: 'user-1'
      })

      expect(smartScraper.scrapeWithRetry).not.toHaveBeenCalled()
      expect(prisma.scanSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          status: 'COMPLETED'
        })
      })
    })
  })

  describe('addNewKnownSite', () => {
    it('should add a new known site successfully', async () => {
      const newSiteData = {
        url: 'https://newsite.com',
        category: 'FORUM' as const,
        violationFound: true
      }

      ;(prisma.knownSite.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.knownSite.create as jest.Mock).mockResolvedValue({
        id: 'new-site-1',
        baseUrl: 'https://newsite.com',
        domain: 'newsite.com',
        ...newSiteData
      })

      await agent.addNewKnownSite('user-1', newSiteData)

      expect(prisma.knownSite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          baseUrl: 'https://newsite.com',
          domain: 'newsite.com',
          category: 'FORUM',
          totalViolations: 1,
          riskScore: expect.any(Number)
        })
      })
    })

    it('should update existing site if already exists', async () => {
      const existingSite = {
        id: 'site-1',
        baseUrl: 'https://existing.com',
        domain: 'existing.com',
        totalViolations: 5
      }

      ;(prisma.knownSite.findUnique as jest.Mock).mockResolvedValue(existingSite)
      ;(prisma.knownSite.update as jest.Mock).mockResolvedValue({
        ...existingSite,
        totalViolations: 6
      })

      await agent.addNewKnownSite('user-1', {
        url: 'https://existing.com',
        category: 'FORUM' as const,
        violationFound: true
      })

      expect(prisma.knownSite.update).toHaveBeenCalledWith({
        where: { baseUrl: 'https://existing.com' },
        data: expect.objectContaining({
          totalViolations: 6
        })
      })
    })
  })

  describe('analyzePatterns', () => {
    it('should analyze violation patterns correctly', async () => {
      const mockViolations = [
        {
          knownSiteId: 'site-1',
          detectionMethod: 'KEYWORD_MATCH',
          riskLevel: 'HIGH',
          detectedAt: new Date()
        },
        {
          knownSiteId: 'site-1',
          detectionMethod: 'AI_CLASSIFICATION',
          riskLevel: 'CRITICAL',
          detectedAt: new Date()
        },
        {
          knownSiteId: 'site-2',
          detectionMethod: 'KEYWORD_MATCH',
          riskLevel: 'MEDIUM',
          detectedAt: new Date()
        }
      ]

      ;(prisma.violationHistory.findMany as jest.Mock).mockResolvedValue(mockViolations)

      const patterns = await agent.analyzePatterns('session-1')

      expect(patterns).toEqual({
        totalViolations: 3,
        siteDistribution: {
          'site-1': 2,
          'site-2': 1
        },
        methodDistribution: {
          'KEYWORD_MATCH': 2,
          'AI_CLASSIFICATION': 1
        },
        riskDistribution: {
          'HIGH': 1,
          'CRITICAL': 1,
          'MEDIUM': 1
        }
      })
    })
  })
})