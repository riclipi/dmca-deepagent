import { AbuseMonitoringService } from '@/lib/services/security/abuse-monitoring.service'
import { prisma } from '@/lib/prisma'
import { AbuseState, ViolationType } from '@prisma/client'

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    abuseScore: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn()
    },
    abuseViolation: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    user: {
      update: jest.fn(),
      findMany: jest.fn()
    },
    $transaction: jest.fn()
  }
}))

jest.mock('@/lib/audit', () => ({
  logActivity: jest.fn()
}))

describe('AbuseMonitoringService', () => {
  let service: AbuseMonitoringService

  beforeEach(() => {
    service = new AbuseMonitoringService()
    jest.clearAllMocks()
  })

  describe('recordViolation', () => {
    it('should create new abuse score if none exists', async () => {
      const userId = 'user-1'
      const violation = {
        type: ViolationType.SPAM_KEYWORDS,
        severity: 0.5,
        description: 'Using spam keywords'
      }

      ;(prisma.abuseScore.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma)
      })
      ;(prisma.abuseScore.create as jest.Mock).mockResolvedValue({
        id: 'score-1',
        userId,
        currentScore: 50,
        state: AbuseState.WARNING
      })

      await service.recordViolation(userId, violation)

      expect(prisma.abuseScore.create).toHaveBeenCalledWith({
        data: {
          userId,
          currentScore: 50,
          state: AbuseState.WARNING,
          lastViolation: expect.any(Date)
        }
      })
      expect(prisma.abuseViolation.create).toHaveBeenCalled()
    })

    it('should update existing abuse score', async () => {
      const userId = 'user-1'
      const existingScore = {
        id: 'score-1',
        userId,
        currentScore: 30,
        state: AbuseState.CLEAN
      }
      const violation = {
        type: ViolationType.EXCESSIVE_REQUESTS,
        severity: 0.8,
        description: 'Too many requests'
      }

      ;(prisma.abuseScore.findUnique as jest.Mock).mockResolvedValue(existingScore)
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma)
      })
      ;(prisma.abuseScore.update as jest.Mock).mockResolvedValue({
        ...existingScore,
        currentScore: 110,
        state: AbuseState.HIGH_RISK
      })

      await service.recordViolation(userId, violation)

      expect(prisma.abuseScore.update).toHaveBeenCalledWith({
        where: { id: 'score-1' },
        data: {
          currentScore: 110,
          state: AbuseState.HIGH_RISK,
          lastViolation: expect.any(Date)
        }
      })
    })

    it('should block user when score exceeds threshold', async () => {
      const userId = 'user-1'
      const existingScore = {
        id: 'score-1',
        userId,
        currentScore: 180,
        state: AbuseState.HIGH_RISK
      }
      const violation = {
        type: ViolationType.FAKE_OWNERSHIP,
        severity: 1.0,
        description: 'Fake ownership claim'
      }

      ;(prisma.abuseScore.findUnique as jest.Mock).mockResolvedValue(existingScore)
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma)
      })
      ;(prisma.abuseScore.update as jest.Mock).mockResolvedValue({
        ...existingScore,
        currentScore: 280,
        state: AbuseState.BLOCKED
      })

      await service.recordViolation(userId, violation)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { status: 'SUSPENDED' }
      })
    })
  })

  describe('checkUserAbuse', () => {
    it('should return clean state for user with no violations', async () => {
      ;(prisma.abuseScore.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await service.checkUserAbuse('user-1')

      expect(result.state).toBe(AbuseState.CLEAN)
      expect(result.score).toBe(0)
      expect(result.canProceed).toBe(true)
    })

    it('should allow proceed for WARNING state', async () => {
      ;(prisma.abuseScore.findUnique as jest.Mock).mockResolvedValue({
        currentScore: 60,
        state: AbuseState.WARNING
      })

      const result = await service.checkUserAbuse('user-1')

      expect(result.state).toBe(AbuseState.WARNING)
      expect(result.score).toBe(60)
      expect(result.canProceed).toBe(true)
    })

    it('should block proceed for BLOCKED state', async () => {
      ;(prisma.abuseScore.findUnique as jest.Mock).mockResolvedValue({
        currentScore: 250,
        state: AbuseState.BLOCKED
      })

      const result = await service.checkUserAbuse('user-1')

      expect(result.state).toBe(AbuseState.BLOCKED)
      expect(result.score).toBe(250)
      expect(result.canProceed).toBe(false)
      expect(result.message).toContain('blocked')
    })
  })

  describe('applyTemporalDecay', () => {
    it('should apply decay to old violations', async () => {
      const userId = 'user-1'
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 10) // 10 days ago

      const abuseScore = {
        id: 'score-1',
        userId,
        currentScore: 100,
        state: AbuseState.WARNING,
        lastViolation: oldDate
      }

      ;(prisma.abuseScore.findUnique as jest.Mock).mockResolvedValue(abuseScore)
      ;(prisma.abuseScore.update as jest.Mock).mockResolvedValue({
        ...abuseScore,
        currentScore: 50
      })

      await service.applyTemporalDecay(userId)

      expect(prisma.abuseScore.update).toHaveBeenCalledWith({
        where: { id: 'score-1' },
        data: {
          currentScore: 50,
          state: AbuseState.CLEAN
        }
      })
    })

    it('should not apply decay to recent violations', async () => {
      const userId = 'user-1'
      const recentDate = new Date() // Now

      const abuseScore = {
        id: 'score-1',
        userId,
        currentScore: 100,
        state: AbuseState.WARNING,
        lastViolation: recentDate
      }

      ;(prisma.abuseScore.findUnique as jest.Mock).mockResolvedValue(abuseScore)

      await service.applyTemporalDecay(userId)

      expect(prisma.abuseScore.update).not.toHaveBeenCalled()
    })
  })

  describe('monitorAllUsers', () => {
    it('should apply decay and take actions for all users', async () => {
      const mockScores = [
        {
          id: 'score-1',
          userId: 'user-1',
          currentScore: 80,
          state: AbuseState.WARNING,
          lastViolation: new Date(Date.now() - 864000000) // 10 days ago
        },
        {
          id: 'score-2',
          userId: 'user-2',
          currentScore: 180,
          state: AbuseState.HIGH_RISK,
          lastViolation: new Date()
        }
      ]

      ;(prisma.abuseScore.findMany as jest.Mock).mockResolvedValue(mockScores)
      ;(prisma.abuseScore.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockScores[0])
        .mockResolvedValueOnce(mockScores[1])
      ;(prisma.abuseScore.update as jest.Mock).mockResolvedValue({})
      
      // Mock checkUserAbuse for HIGH_RISK user
      const checkUserAbuseSpy = jest.spyOn(service, 'checkUserAbuse')
        .mockResolvedValueOnce({
          state: AbuseState.WARNING,
          score: 40,
          canProceed: true
        })
        .mockResolvedValueOnce({
          state: AbuseState.HIGH_RISK,
          score: 180,
          canProceed: true,
          message: 'High risk user'
        })

      await service.monitorAllUsers()

      expect(prisma.abuseScore.findMany).toHaveBeenCalled()
      expect(checkUserAbuseSpy).toHaveBeenCalledTimes(2)
      
      // Should update decay for user-1
      expect(prisma.abuseScore.update).toHaveBeenCalledWith({
        where: { id: 'score-1' },
        data: expect.objectContaining({
          currentScore: 40
        })
      })

      checkUserAbuseSpy.mockRestore()
    })
  })

  describe('getAbuseReport', () => {
    it('should generate comprehensive abuse report', async () => {
      const userId = 'user-1'
      const mockScore = {
        id: 'score-1',
        userId,
        currentScore: 75,
        state: AbuseState.WARNING,
        lastViolation: new Date()
      }
      const mockViolations = [
        {
          type: ViolationType.SPAM_KEYWORDS,
          severity: 0.5,
          occurredAt: new Date(),
          description: 'Spam detected'
        },
        {
          type: ViolationType.EXCESSIVE_REQUESTS,
          severity: 0.3,
          occurredAt: new Date(Date.now() - 3600000),
          description: 'Too many requests'
        }
      ]

      ;(prisma.abuseScore.findUnique as jest.Mock).mockResolvedValue(mockScore)
      ;(prisma.abuseViolation.findMany as jest.Mock).mockResolvedValue(mockViolations)

      const report = await service.getAbuseReport(userId)

      expect(report).toEqual({
        userId,
        currentScore: 75,
        state: AbuseState.WARNING,
        lastViolation: mockScore.lastViolation,
        violationHistory: mockViolations,
        totalViolations: 2,
        violationsByType: {
          [ViolationType.SPAM_KEYWORDS]: 1,
          [ViolationType.EXCESSIVE_REQUESTS]: 1
        }
      })
    })
  })
})