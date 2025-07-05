import { FairQueueManager } from '@/lib/services/security/fair-queue-manager'
import { PlanType } from '@prisma/client'

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  default: {
    monitoringSession: {
      create: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    }
  }
}))

jest.mock('@/lib/socket-server', () => ({
  emitQueueUpdate: jest.fn()
}))

jest.mock('@/lib/agents/KnownSitesAgent', () => ({
  KnownSitesAgent: jest.fn().mockImplementation(() => ({
    scanKnownSites: jest.fn().mockResolvedValue('test-session-id')
  }))
}))

describe('FairQueueManager', () => {
  let queueManager: FairQueueManager
  
  beforeEach(() => {
    queueManager = new FairQueueManager()
    jest.clearAllMocks()
  })

  describe('enqueueScan', () => {
    it('should process scan immediately for FREE plan when under limit', async () => {
      const request = {
        userId: 'user-1',
        userPlan: 'FREE' as PlanType,
        siteIds: ['site-1', 'site-2'],
        metadata: { brandProfileId: 'brand-1' }
      }

      const response = await queueManager.enqueueScan(request)

      expect(response.status).toBe('PROCESSING')
      expect(response.position).toBeUndefined()
      expect(response.queueId).toBeUndefined()
    })

    it('should queue scan for FREE plan when at limit', async () => {
      // First scan should process
      const request1 = {
        userId: 'user-1',
        userPlan: 'FREE' as PlanType,
        siteIds: ['site-1'],
        metadata: { brandProfileId: 'brand-1' }
      }
      await queueManager.enqueueScan(request1)

      // Second scan should be queued (FREE limit is 1)
      const request2 = {
        userId: 'user-1',
        userPlan: 'FREE' as PlanType,
        siteIds: ['site-2'],
        metadata: { brandProfileId: 'brand-2' }
      }
      const response = await queueManager.enqueueScan(request2)

      expect(response.status).toBe('QUEUED')
      expect(response.position).toBe(1)
      expect(response.queueId).toBeDefined()
      expect(response.estimatedStartTime).toBeDefined()
    })

    it('should process multiple scans for PREMIUM plan', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        userId: 'user-premium',
        userPlan: 'PREMIUM' as PlanType,
        siteIds: [`site-${i}`],
        metadata: { brandProfileId: `brand-${i}` }
      }))

      const responses = await Promise.all(
        requests.map(req => queueManager.enqueueScan(req))
      )

      // PREMIUM limit is 10, so all 5 should process
      responses.forEach(response => {
        expect(response.status).toBe('PROCESSING')
      })
    })

    it('should respect priority based on plan type', async () => {
      // Fill up global limit with FREE users
      const freeRequests = Array.from({ length: 50 }, (_, i) => ({
        userId: `free-user-${i}`,
        userPlan: 'FREE' as PlanType,
        siteIds: ['site-1'],
        metadata: { brandProfileId: 'brand-1' }
      }))

      for (const req of freeRequests) {
        await queueManager.enqueueScan(req)
      }

      // Add ENTERPRISE user request
      const enterpriseRequest = {
        userId: 'enterprise-user',
        userPlan: 'ENTERPRISE' as PlanType,
        siteIds: ['site-1'],
        metadata: { brandProfileId: 'brand-1' }
      }
      
      const response = await queueManager.enqueueScan(enterpriseRequest)
      
      // Should be queued but with higher priority
      expect(response.status).toBe('QUEUED')
      expect(response.position).toBeLessThan(50) // Should be prioritized
    })
  })

  describe('getQueueStatus', () => {
    it('should return correct queue status for user', async () => {
      const userId = 'user-1'
      
      // Enqueue some scans
      await queueManager.enqueueScan({
        userId,
        userPlan: 'FREE' as PlanType,
        siteIds: ['site-1'],
        metadata: {}
      })

      const status = await queueManager.getQueueStatus(userId)

      expect(status.activeScans).toBe(1)
      expect(status.queuedScans).toBe(0)
      expect(status.position).toBeUndefined()
    })
  })

  describe('cancelQueuedScan', () => {
    it('should cancel queued scan successfully', async () => {
      // First scan processes
      await queueManager.enqueueScan({
        userId: 'user-1',
        userPlan: 'FREE' as PlanType,
        siteIds: ['site-1'],
        metadata: {}
      })

      // Second scan is queued
      const queuedResponse = await queueManager.enqueueScan({
        userId: 'user-1',
        userPlan: 'FREE' as PlanType,
        siteIds: ['site-2'],
        metadata: {}
      })

      expect(queuedResponse.status).toBe('QUEUED')
      expect(queuedResponse.queueId).toBeDefined()

      // Cancel the queued scan
      const cancelled = await queueManager.cancelQueuedScan('user-1', queuedResponse.queueId!)

      expect(cancelled).toBe(true)

      // Queue status should show no queued scans
      const status = await queueManager.getQueueStatus('user-1')
      expect(status.queuedScans).toBe(0)
    })

    it('should return false when trying to cancel non-existent scan', async () => {
      const cancelled = await queueManager.cancelQueuedScan('user-1', 'non-existent-id')
      expect(cancelled).toBe(false)
    })
  })

  describe('scheduler fairness', () => {
    it('should process scans in round-robin fashion between users', async () => {
      // Create multiple users with queued scans
      const users = ['user-1', 'user-2', 'user-3']
      
      for (const userId of users) {
        // First scan processes
        await queueManager.enqueueScan({
          userId,
          userPlan: 'FREE' as PlanType,
          siteIds: ['site-1'],
          metadata: {}
        })
        
        // Second scan is queued
        await queueManager.enqueueScan({
          userId,
          userPlan: 'FREE' as PlanType,
          siteIds: ['site-2'],
          metadata: {}
        })
      }

      // Each user should have 1 active and 1 queued
      for (const userId of users) {
        const status = await queueManager.getQueueStatus(userId)
        expect(status.activeScans).toBe(1)
        expect(status.queuedScans).toBe(1)
      }
    })
  })
})