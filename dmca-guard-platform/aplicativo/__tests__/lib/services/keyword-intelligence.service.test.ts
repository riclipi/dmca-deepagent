import { KeywordIntelligenceService } from '@/lib/services/keyword-intelligence.service'
import { analyzeKeywordRisk } from '@/lib/utils/keyword-analyzer'
import { generateKeywordSuggestionsWithAI } from '@/lib/utils/ai-keyword-generator'
import { prisma } from '@/lib/prisma'
import { emitToRoom } from '@/lib/socket-server'

// Mock dependencies
jest.mock('@/lib/utils/keyword-analyzer', () => ({
  analyzeKeywordRisk: jest.fn()
}))

jest.mock('@/lib/utils/ai-keyword-generator', () => ({
  generateKeywordSuggestionsWithAI: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    brandProfile: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    detectedContent: {
      groupBy: jest.fn(),
      findMany: jest.fn()
    },
    monitoringSession: {
      findMany: jest.fn(),
      update: jest.fn()
    },
    keywordReview: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  }
}))

jest.mock('@/lib/socket-server', () => ({
  emitToRoom: jest.fn()
}))

describe('KeywordIntelligenceService', () => {
  let service: KeywordIntelligenceService

  beforeEach(() => {
    service = new KeywordIntelligenceService()
    jest.clearAllMocks()
  })

  describe('analyzeAndClassifyKeywords', () => {
    const mockBrandContext = {
      brandName: 'TestBrand',
      description: 'A test brand for unit tests',
      officialUrls: ['https://testbrand.com']
    }

    it('should classify keywords correctly based on risk', async () => {
      const keywords = ['testbrand', 'fake testbrand', 'cheap knockoff', 'official store']

      ;(analyzeKeywordRisk as jest.Mock)
        .mockResolvedValueOnce({ 
          riskScore: 10, 
          reasons: ['Brand name match'],
          category: 'SAFE' 
        })
        .mockResolvedValueOnce({ 
          riskScore: 65, 
          reasons: ['Contains "fake"'],
          category: 'MODERATE' 
        })
        .mockResolvedValueOnce({ 
          riskScore: 90, 
          reasons: ['Counterfeit indicator'],
          category: 'DANGEROUS' 
        })
        .mockResolvedValueOnce({ 
          riskScore: 5, 
          reasons: ['Official term'],
          category: 'SAFE' 
        })

      const result = await service.analyzeAndClassifyKeywords(keywords, mockBrandContext)

      expect(result.safe).toEqual(['testbrand', 'official store'])
      expect(result.moderate).toEqual(['fake testbrand'])
      expect(result.dangerous).toEqual(['cheap knockoff'])
      expect(result.analysis).toHaveLength(4)
      expect(analyzeKeywordRisk).toHaveBeenCalledTimes(4)
    })

    it('should handle empty keywords array', async () => {
      const result = await service.analyzeAndClassifyKeywords([], mockBrandContext)

      expect(result.safe).toEqual([])
      expect(result.moderate).toEqual([])
      expect(result.dangerous).toEqual([])
      expect(result.analysis).toEqual([])
    })

    it('should handle analysis errors gracefully', async () => {
      const keywords = ['test-keyword']

      ;(analyzeKeywordRisk as jest.Mock).mockRejectedValue(new Error('API error'))

      const result = await service.analyzeAndClassifyKeywords(keywords, mockBrandContext)

      expect(result.safe).toEqual([])
      expect(result.moderate).toEqual(['test-keyword']) // Default to moderate on error
      expect(result.dangerous).toEqual([])
    })
  })

  describe('generateKeywordSuggestions', () => {
    const mockBrandProfile = {
      id: 'brand-1',
      brandName: 'TestBrand',
      description: 'Test description',
      keywords: ['existing', 'keywords']
    }

    it('should generate AI-powered suggestions', async () => {
      ;(prisma.brandProfile.findUnique as jest.Mock).mockResolvedValue(mockBrandProfile)
      ;(generateKeywordSuggestionsWithAI as jest.Mock).mockResolvedValue([
        'testbrand official',
        'authentic testbrand',
        'testbrand store'
      ])
      ;(analyzeKeywordRisk as jest.Mock).mockResolvedValue({
        riskScore: 15,
        reasons: ['Safe keyword'],
        category: 'SAFE'
      })

      const result = await service.generateKeywordSuggestions(
        'brand-1',
        mockBrandProfile.keywords
      )

      expect(result.suggestions).toHaveLength(3)
      expect(result.suggestions[0]).toMatchObject({
        keyword: 'testbrand official',
        riskScore: 15,
        category: 'SAFE'
      })
      expect(generateKeywordSuggestionsWithAI).toHaveBeenCalledWith(
        mockBrandProfile,
        mockBrandProfile.keywords
      )
    })

    it('should throw error if brand profile not found', async () => {
      ;(prisma.brandProfile.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(
        service.generateKeywordSuggestions('non-existent', [])
      ).rejects.toThrow('Brand profile not found')
    })

    it('should filter out existing keywords from suggestions', async () => {
      ;(prisma.brandProfile.findUnique as jest.Mock).mockResolvedValue(mockBrandProfile)
      ;(generateKeywordSuggestionsWithAI as jest.Mock).mockResolvedValue([
        'existing', // Should be filtered out
        'new keyword'
      ])
      ;(analyzeKeywordRisk as jest.Mock).mockResolvedValue({
        riskScore: 20,
        reasons: [],
        category: 'SAFE'
      })

      const result = await service.generateKeywordSuggestions(
        'brand-1',
        mockBrandProfile.keywords
      )

      expect(result.suggestions).toHaveLength(1)
      expect(result.suggestions[0].keyword).toBe('new keyword')
    })
  })

  describe('analyzeKeywordEffectiveness', () => {
    it('should calculate effectiveness metrics correctly', async () => {
      const mockDetectedContent = [
        {
          keywordSource: 'test keyword',
          _count: { id: 10 }
        },
        {
          keywordSource: 'another keyword',
          _count: { id: 5 }
        }
      ]

      const mockFalsePositives = [
        { keywordSource: 'test keyword' },
        { keywordSource: 'test keyword' }
      ]

      ;(prisma.detectedContent.groupBy as jest.Mock).mockResolvedValue(mockDetectedContent)
      ;(prisma.detectedContent.findMany as jest.Mock).mockResolvedValue(mockFalsePositives)

      const result = await service.analyzeKeywordEffectiveness('brand-1', 30)

      expect(result.totalDetections).toBe(15)
      expect(result.keywordPerformance).toHaveLength(2)
      expect(result.keywordPerformance[0]).toMatchObject({
        keyword: 'test keyword',
        detections: 10,
        effectiveness: 80, // (10-2)/10 * 100
        falsePositives: 2
      })
    })

    it('should handle no detections', async () => {
      ;(prisma.detectedContent.groupBy as jest.Mock).mockResolvedValue([])
      ;(prisma.detectedContent.findMany as jest.Mock).mockResolvedValue([])

      const result = await service.analyzeKeywordEffectiveness('brand-1', 30)

      expect(result.totalDetections).toBe(0)
      expect(result.keywordPerformance).toEqual([])
      expect(result.topPerformers).toEqual([])
      expect(result.underperformers).toEqual([])
    })
  })

  describe('syncProfileKeywordsWithSessions', () => {
    it('should sync keywords to all active sessions', async () => {
      const mockProfile = {
        id: 'brand-1',
        safeKeywords: ['keyword1', 'keyword2'],
        userId: 'user-1'
      }

      const mockSessions = [
        { id: 'session-1', useProfileKeywords: true },
        { id: 'session-2', useProfileKeywords: false },
        { id: 'session-3', useProfileKeywords: true }
      ]

      ;(prisma.brandProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile)
      ;(prisma.monitoringSession.findMany as jest.Mock).mockResolvedValue(mockSessions)
      ;(prisma.monitoringSession.update as jest.Mock).mockResolvedValue({})

      await KeywordIntelligenceService.syncProfileKeywordsWithSessions('brand-1')

      // Should only update sessions with useProfileKeywords = true
      expect(prisma.monitoringSession.update).toHaveBeenCalledTimes(2)
      expect(prisma.monitoringSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { updatedAt: expect.any(Date) }
      })
      expect(prisma.monitoringSession.update).toHaveBeenCalledWith({
        where: { id: 'session-3' },
        data: { updatedAt: expect.any(Date) }
      })

      // Should emit WebSocket updates
      expect(emitToRoom).toHaveBeenCalledTimes(2)
    })

    it('should handle profile not found', async () => {
      ;(prisma.brandProfile.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(
        KeywordIntelligenceService.syncProfileKeywordsWithSessions('non-existent')
      ).rejects.toThrow('Brand profile not found')
    })
  })

  describe('reviewKeyword', () => {
    it('should create new review if none exists', async () => {
      const reviewData = {
        userId: 'user-1',
        brandProfileId: 'brand-1',
        keyword: 'test keyword',
        approved: true,
        notes: 'Looks good'
      }

      ;(prisma.keywordReview.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.keywordReview.create as jest.Mock).mockResolvedValue({
        id: 'review-1',
        ...reviewData,
        status: 'APPROVED'
      })

      const result = await service.reviewKeyword(reviewData)

      expect(prisma.keywordReview.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'APPROVED',
          isApproved: true,
          reviewNotes: 'Looks good'
        })
      })
    })

    it('should update existing review', async () => {
      const existingReview = {
        id: 'review-1',
        status: 'PENDING'
      }

      const reviewData = {
        userId: 'user-1',
        brandProfileId: 'brand-1',
        keyword: 'test keyword',
        approved: false,
        notes: 'Too risky'
      }

      ;(prisma.keywordReview.findUnique as jest.Mock).mockResolvedValue(existingReview)
      ;(prisma.keywordReview.update as jest.Mock).mockResolvedValue({
        ...existingReview,
        status: 'REJECTED'
      })

      await service.reviewKeyword(reviewData)

      expect(prisma.keywordReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: expect.objectContaining({
          status: 'REJECTED',
          isApproved: false,
          reviewedBy: 'user-1'
        })
      })
    })
  })
})