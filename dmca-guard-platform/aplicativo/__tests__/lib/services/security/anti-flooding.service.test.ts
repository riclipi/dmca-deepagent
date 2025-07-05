import { AntiFloodingService } from '@/lib/services/security/anti-flooding.service'
import { analyzeKeywordSpam } from '@/lib/utils/keyword-analyzer'
import { prisma } from '@/lib/prisma'
import { PlanType } from '@prisma/client'

// Mock dependencies
jest.mock('@/lib/utils/keyword-analyzer', () => ({
  analyzeKeywordSpam: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    keywordSearch: {
      count: jest.fn()
    },
    monitoringSession: {
      count: jest.fn()
    },
    scanSession: {
      count: jest.fn()
    },
    userActivity: {
      create: jest.fn(),
      count: jest.fn()
    }
  }
}))

jest.mock('@/lib/services/security/abuse-monitoring.service', () => ({
  abuseMonitoringService: {
    recordViolation: jest.fn()
  }
}))

describe('AntiFloodingService', () => {
  let service: AntiFloodingService

  beforeEach(() => {
    service = new AntiFloodingService()
    jest.clearAllMocks()
  })

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit for FREE plan', async () => {
      const userId = 'user-1'
      const action = 'keyword_search'
      
      ;(prisma.userActivity.count as jest.Mock).mockResolvedValue(5)

      const result = await service.checkRateLimit(userId, action, PlanType.FREE)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(5) // 10 - 5
      expect(result.resetAt).toBeDefined()
    })

    it('should block requests exceeding rate limit', async () => {
      const userId = 'user-1'
      const action = 'keyword_search'
      
      ;(prisma.userActivity.count as jest.Mock).mockResolvedValue(15) // Exceeds FREE limit of 10

      const result = await service.checkRateLimit(userId, action, PlanType.FREE)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.message).toContain('Rate limit exceeded')
    })

    it('should have higher limits for PREMIUM plan', async () => {
      const userId = 'user-1'
      const action = 'keyword_search'
      
      ;(prisma.userActivity.count as jest.Mock).mockResolvedValue(40)

      const result = await service.checkRateLimit(userId, action, PlanType.PREMIUM)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(60) // 100 - 40
    })

    it('should have unlimited requests for SUPER_USER', async () => {
      const userId = 'user-1'
      const action = 'keyword_search'
      
      ;(prisma.userActivity.count as jest.Mock).mockResolvedValue(1000)

      const result = await service.checkRateLimit(userId, action, PlanType.SUPER_USER)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(999999)
    })

    it('should record activity when allowed', async () => {
      const userId = 'user-1'
      const action = 'keyword_search'
      
      ;(prisma.userActivity.count as jest.Mock).mockResolvedValue(0)

      await service.checkRateLimit(userId, action, PlanType.FREE)

      expect(prisma.userActivity.create).toHaveBeenCalledWith({
        data: {
          userId,
          action,
          metadata: expect.any(Object)
        }
      })
    })
  })

  describe('checkKeywordQuality', () => {
    it('should allow high quality keywords', async () => {
      const keywords = ['official brand', 'authentic product', 'genuine item']
      
      ;(analyzeKeywordSpam as jest.Mock).mockResolvedValue({
        isSpam: false,
        spamScore: 0.1,
        reasons: []
      })

      const result = await service.checkKeywordQuality('user-1', keywords)

      expect(result.allowed).toBe(true)
      expect(result.qualityScore).toBeGreaterThan(0.7)
      expect(result.flaggedKeywords).toHaveLength(0)
    })

    it('should flag spam keywords', async () => {
      const keywords = ['buy cheap', 'free download', 'hack tool']
      
      ;(analyzeKeywordSpam as jest.Mock)
        .mockResolvedValueOnce({
          isSpam: true,
          spamScore: 0.8,
          reasons: ['Commercial intent']
        })
        .mockResolvedValueOnce({
          isSpam: true,
          spamScore: 0.9,
          reasons: ['Piracy related']
        })
        .mockResolvedValueOnce({
          isSpam: true,
          spamScore: 0.95,
          reasons: ['Hacking tool']
        })

      const result = await service.checkKeywordQuality('user-1', keywords)

      expect(result.allowed).toBe(false)
      expect(result.qualityScore).toBeLessThan(0.3)
      expect(result.flaggedKeywords).toHaveLength(3)
      expect(result.message).toContain('spam or low quality')
    })

    it('should handle mixed quality keywords', async () => {
      const keywords = ['official store', 'buy cheap', 'authentic product']
      
      ;(analyzeKeywordSpam as jest.Mock)
        .mockResolvedValueOnce({
          isSpam: false,
          spamScore: 0.1,
          reasons: []
        })
        .mockResolvedValueOnce({
          isSpam: true,
          spamScore: 0.8,
          reasons: ['Commercial spam']
        })
        .mockResolvedValueOnce({
          isSpam: false,
          spamScore: 0.15,
          reasons: []
        })

      const result = await service.checkKeywordQuality('user-1', keywords)

      expect(result.allowed).toBe(true) // Still allowed with some good keywords
      expect(result.qualityScore).toBeGreaterThan(0.3)
      expect(result.qualityScore).toBeLessThan(0.7)
      expect(result.flaggedKeywords).toHaveLength(1)
      expect(result.flaggedKeywords[0].keyword).toBe('buy cheap')
    })
  })

  describe('checkScanPatterns', () => {
    it('should allow normal scanning patterns', async () => {
      ;(prisma.scanSession.count as jest.Mock)
        .mockResolvedValueOnce(5) // Last hour
        .mockResolvedValueOnce(20) // Last 24 hours
      ;(prisma.monitoringSession.count as jest.Mock).mockResolvedValue(3)

      const result = await service.checkScanPatterns('user-1', PlanType.BASIC)

      expect(result.allowed).toBe(true)
      expect(result.riskFactors).toHaveLength(0)
    })

    it('should detect excessive scanning', async () => {
      ;(prisma.scanSession.count as jest.Mock)
        .mockResolvedValueOnce(50) // Last hour - excessive
        .mockResolvedValueOnce(200) // Last 24 hours
      ;(prisma.monitoringSession.count as jest.Mock).mockResolvedValue(5)

      const result = await service.checkScanPatterns('user-1', PlanType.BASIC)

      expect(result.allowed).toBe(false)
      expect(result.riskFactors).toContain('excessive_scanning')
      expect(result.message).toContain('Suspicious scanning pattern')
    })

    it('should detect burst activity', async () => {
      ;(prisma.scanSession.count as jest.Mock)
        .mockResolvedValueOnce(30) // Last hour - burst
        .mockResolvedValueOnce(35) // Last 24 hours - most in last hour
      ;(prisma.monitoringSession.count as jest.Mock).mockResolvedValue(2)

      const result = await service.checkScanPatterns('user-1', PlanType.FREE)

      expect(result.allowed).toBe(false)
      expect(result.riskFactors).toContain('burst_activity')
    })

    it('should allow higher activity for premium plans', async () => {
      ;(prisma.scanSession.count as jest.Mock)
        .mockResolvedValueOnce(40) // Would be excessive for FREE
        .mockResolvedValueOnce(150) // But ok for PREMIUM
      ;(prisma.monitoringSession.count as jest.Mock).mockResolvedValue(10)

      const result = await service.checkScanPatterns('user-1', PlanType.PREMIUM)

      expect(result.allowed).toBe(true)
      expect(result.riskFactors).toHaveLength(0)
    })
  })

  describe('validateRequest', () => {
    it('should validate all aspects of a request', async () => {
      const request = {
        userId: 'user-1',
        action: 'start_scan' as const,
        keywords: ['official product', 'authentic brand'],
        userPlan: PlanType.BASIC
      }

      // Mock successful checks
      ;(prisma.userActivity.count as jest.Mock).mockResolvedValue(5)
      ;(analyzeKeywordSpam as jest.Mock).mockResolvedValue({
        isSpam: false,
        spamScore: 0.1,
        reasons: []
      })
      ;(prisma.scanSession.count as jest.Mock).mockResolvedValue(10)
      ;(prisma.monitoringSession.count as jest.Mock).mockResolvedValue(2)

      const result = await service.validateRequest(request)

      expect(result.allowed).toBe(true)
      expect(result.checks).toHaveProperty('rateLimit')
      expect(result.checks).toHaveProperty('keywordQuality')
      expect(result.checks).toHaveProperty('scanPatterns')
      expect(result.riskScore).toBeLessThan(30)
    })

    it('should block request if any check fails critically', async () => {
      const request = {
        userId: 'user-1',
        action: 'start_scan' as const,
        keywords: ['hack tool', 'crack software'],
        userPlan: PlanType.FREE
      }

      // Mock rate limit ok but keywords are spam
      ;(prisma.userActivity.count as jest.Mock).mockResolvedValue(5)
      ;(analyzeKeywordSpam as jest.Mock).mockResolvedValue({
        isSpam: true,
        spamScore: 0.95,
        reasons: ['Hacking related']
      })

      const result = await service.validateRequest(request)

      expect(result.allowed).toBe(false)
      expect(result.checks.keywordQuality?.allowed).toBe(false)
      expect(result.riskScore).toBeGreaterThan(70)
    })

    it('should calculate risk score based on all factors', async () => {
      const request = {
        userId: 'user-1',
        action: 'start_scan' as const,
        keywords: ['product', 'buy cheap'], // Mixed quality
        userPlan: PlanType.FREE
      }

      // Mock borderline checks
      ;(prisma.userActivity.count as jest.Mock).mockResolvedValue(8) // Close to limit
      ;(analyzeKeywordSpam as jest.Mock)
        .mockResolvedValueOnce({ isSpam: false, spamScore: 0.2 })
        .mockResolvedValueOnce({ isSpam: true, spamScore: 0.7 })
      ;(prisma.scanSession.count as jest.Mock)
        .mockResolvedValueOnce(15) // Moderate activity
        .mockResolvedValueOnce(40)

      const result = await service.validateRequest(request)

      expect(result.allowed).toBe(true) // Still allowed but risky
      expect(result.riskScore).toBeGreaterThan(30)
      expect(result.riskScore).toBeLessThan(70)
      expect(result.checks.rateLimit?.remaining).toBe(2)
    })
  })
})