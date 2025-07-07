// __tests__/services/security/ownership-validation.service.test.ts
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { OwnershipValidationService } from '@/lib/services/security/ownership-validation.service'
import { prisma } from '@/lib/prisma'
import { BrandProfile, ValidationMethod, ValidationStatus, ViolationType } from '@prisma/client'
import dns from 'dns/promises'

// Mock dos módulos externos
jest.mock('@/lib/prisma', () => ({
  prisma: {
    ownershipValidation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn()
    },
    brandProfile: {
      findUnique: jest.fn()
    },
    abuseScore: {
      upsert: jest.fn(),
      update: jest.fn()
    },
    abuseViolation: {
      create: jest.fn()
    }
  }
}))

jest.mock('dns/promises')

// Mock do fetch global
global.fetch = jest.fn()

describe('OwnershipValidationService', () => {
  let service: OwnershipValidationService
  let mockBrandProfile: BrandProfile

  beforeEach(() => {
    service = new OwnershipValidationService()
    mockBrandProfile = {
      id: 'test-brand-id',
      userId: 'test-user-id',
      brandName: 'Test Brand',
      description: 'Test Description',
      officialUrls: ['https://example.com'],
      socialMedia: {
        twitter: 'https://twitter.com/testbrand',
        instagram: 'https://instagram.com/testbrand'
      },
      keywords: ['test', 'brand'],
      safeKeywords: [],
      moderateKeywords: [],
      dangerousKeywords: [],
      keywordConfig: null,
      lastKeywordUpdate: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Reset all mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('validateBrandOwnership', () => {
    it('deve pular validação se já existe validação válida', async () => {
      const mockValidation = {
        id: 'validation-id',
        brandProfileId: 'test-brand-id',
        status: ValidationStatus.VERIFIED,
        expiresAt: new Date(Date.now() + 86400000) // 24h no futuro
      }

      ;(prisma.ownershipValidation.findMany as jest.Mock).mockResolvedValue([mockValidation])

      await service.validateBrandOwnership('test-user-id', mockBrandProfile)

      expect(prisma.ownershipValidation.findMany).toHaveBeenCalledWith({
        where: {
          brandProfileId: 'test-brand-id',
          status: ValidationStatus.VERIFIED,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: expect.any(Date) } }
          ]
        }
      })
      
      // Não deve executar outras validações
      expect(dns.resolveTxt).not.toHaveBeenCalled()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('deve executar múltiplas validações em paralelo', async () => {
      ;(prisma.ownershipValidation.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.ownershipValidation.upsert as jest.Mock).mockResolvedValue({
        id: 'validation-id',
        verificationToken: 'test-token'
      })
      ;(prisma.brandProfile.findUnique as jest.Mock).mockResolvedValue({
        userId: 'test-user-id'
      })
      ;(dns.resolveTxt as jest.Mock).mockResolvedValue([['other-token']])
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('<html><meta name="dmca-guard-verification" content="other-token"></html>')
      })

      await expect(service.validateBrandOwnership('test-user-id', mockBrandProfile))
        .resolves.not.toThrow()

      // Verificar que todas as validações foram executadas
      expect(dns.resolveTxt).toHaveBeenCalled()
      expect(global.fetch).toHaveBeenCalled()
    })

    it('deve registrar violação de abuso quando score é baixo', async () => {
      ;(prisma.ownershipValidation.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.ownershipValidation.upsert as jest.Mock).mockResolvedValue({
        id: 'validation-id',
        verificationToken: 'test-token'
      })
      ;(prisma.brandProfile.findUnique as jest.Mock).mockResolvedValue({
        userId: 'test-user-id'
      })
      ;(dns.resolveTxt as jest.Mock).mockRejectedValue(new Error('DNS not found'))
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false
      })
      ;(prisma.ownershipValidation.create as jest.Mock).mockResolvedValue({})
      ;(prisma.abuseScore.upsert as jest.Mock).mockResolvedValue({
        id: 'abuse-score-id',
        currentScore: 0.3
      })
      ;(prisma.abuseViolation.create as jest.Mock).mockResolvedValue({})
      ;(prisma.abuseScore.update as jest.Mock).mockResolvedValue({})

      await expect(service.validateBrandOwnership('test-user-id', mockBrandProfile))
        .rejects.toThrow('Falha na validação de propriedade')

      expect(prisma.abuseViolation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'test-user-id',
          type: ViolationType.FAKE_OWNERSHIP,
          severity: 0.7
        })
      })
    })
  })

  describe('checkDomainOwnership', () => {
    it('deve validar com sucesso quando token DNS está presente', async () => {
      const validation = {
        id: 'validation-id',
        verificationToken: 'correct-token',
        brandProfileId: 'test-brand-id',
        method: ValidationMethod.DNS_TXT,
        status: ValidationStatus.PENDING
      }

      ;(prisma.ownershipValidation.findUnique as jest.Mock).mockResolvedValue(validation)
      ;(dns.resolveTxt as jest.Mock).mockResolvedValue([['correct-token']])
      ;(prisma.ownershipValidation.update as jest.Mock).mockResolvedValue({})

      const result = await (service as any).checkDomainOwnership('test-user-id', mockBrandProfile)

      expect(result.valid).toBe(true)
      expect(result.score).toBe(1.0)
      expect(result.method).toBe(ValidationMethod.DNS_TXT)
      
      expect(prisma.ownershipValidation.update).toHaveBeenCalledWith({
        where: { id: 'validation-id' },
        data: {
          status: ValidationStatus.VERIFIED,
          validatedAt: expect.any(Date),
          score: 1.0
        }
      })
    })

    it('deve retornar inválido quando token DNS não está presente', async () => {
      const validation = {
        id: 'validation-id',
        verificationToken: 'correct-token',
        brandProfileId: 'test-brand-id',
        method: ValidationMethod.DNS_TXT,
        status: ValidationStatus.PENDING
      }

      ;(prisma.ownershipValidation.findUnique as jest.Mock).mockResolvedValue(validation)
      ;(dns.resolveTxt as jest.Mock).mockResolvedValue([['wrong-token']])

      const result = await (service as any).checkDomainOwnership('test-user-id', mockBrandProfile)

      expect(result.valid).toBe(false)
      expect(result.score).toBe(0)
      expect(prisma.ownershipValidation.update).not.toHaveBeenCalled()
    })

    it('deve lidar com erro de DNS graciosamente', async () => {
      ;(prisma.ownershipValidation.findUnique as jest.Mock).mockResolvedValue({
        id: 'validation-id',
        verificationToken: 'test-token'
      })
      ;(dns.resolveTxt as jest.Mock).mockRejectedValue(new Error('ENOTFOUND'))

      const result = await (service as any).checkDomainOwnership('test-user-id', mockBrandProfile)

      expect(result.valid).toBe(false)
      expect(result.score).toBe(0)
    })
  })

  describe('checkMetaTagOwnership', () => {
    it('deve validar com sucesso quando meta tag está presente', async () => {
      const validation = {
        id: 'validation-id',
        verificationToken: 'meta-token',
        brandProfileId: 'test-brand-id',
        method: ValidationMethod.META_TAG,
        status: ValidationStatus.PENDING
      }

      ;(prisma.ownershipValidation.findUnique as jest.Mock).mockResolvedValue(validation)
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(`
          <html>
            <head>
              <meta name="dmca-guard-verification" content="meta-token" />
            </head>
          </html>
        `)
      })
      ;(prisma.ownershipValidation.update as jest.Mock).mockResolvedValue({})

      const result = await (service as any).checkMetaTagOwnership('test-user-id', mockBrandProfile)

      expect(result.valid).toBe(true)
      expect(result.score).toBe(0.9)
      expect(result.method).toBe(ValidationMethod.META_TAG)
    })

    it('deve retornar inválido quando meta tag não está presente', async () => {
      const validation = {
        id: 'validation-id',
        verificationToken: 'meta-token'
      }

      ;(prisma.ownershipValidation.findUnique as jest.Mock).mockResolvedValue(validation)
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('<html><head></head></html>')
      })

      const result = await (service as any).checkMetaTagOwnership('test-user-id', mockBrandProfile)

      expect(result.valid).toBe(false)
      expect(result.score).toBe(0)
    })

    it('deve lidar com erro de fetch graciosamente', async () => {
      ;(prisma.ownershipValidation.findUnique as jest.Mock).mockResolvedValue({
        id: 'validation-id',
        verificationToken: 'test-token'
      })
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const result = await (service as any).checkMetaTagOwnership('test-user-id', mockBrandProfile)

      expect(result.valid).toBe(false)
      expect(result.score).toBe(0)
    })
  })

  describe('checkSocialMediaOwnership', () => {
    it('deve calcular score baseado em perfis válidos', async () => {
      const result = await (service as any).checkSocialMediaOwnership('test-user-id', mockBrandProfile)

      expect(result.valid).toBe(true)
      expect(result.score).toBeGreaterThan(0.5)
      expect(result.details.validated).toBe(2)
      expect(result.details.total).toBe(2)
    })

    it('deve retornar score 0 quando não há perfis sociais', async () => {
      const brandProfileSemSocial = { ...mockBrandProfile, socialMedia: null }
      
      const result = await (service as any).checkSocialMediaOwnership('test-user-id', brandProfileSemSocial)

      expect(result.valid).toBe(false)
      expect(result.score).toBe(0)
    })

    it('deve lidar com URLs inválidas graciosamente', async () => {
      const brandProfileComUrlsInvalidas = {
        ...mockBrandProfile,
        socialMedia: {
          twitter: 'not-a-url',
          instagram: 'https://instagram.com/testbrand'
        }
      }

      const result = await (service as any).checkSocialMediaOwnership('test-user-id', brandProfileComUrlsInvalidas)

      expect(result.score).toBeLessThan(0.7)
      expect(result.details.validated).toBe(1)
      expect(result.details.total).toBe(2)
    })
  })

  describe('generateVerificationToken', () => {
    it('deve gerar tokens únicos', () => {
      const token1 = (service as any).generateVerificationToken('brand-1', ValidationMethod.DNS_TXT)
      const token2 = (service as any).generateVerificationToken('brand-1', ValidationMethod.DNS_TXT)
      const token3 = (service as any).generateVerificationToken('brand-2', ValidationMethod.DNS_TXT)

      expect(token1).not.toBe(token2)
      expect(token1).not.toBe(token3)
      expect(token2).not.toBe(token3)
    })

    it('deve gerar tokens com tamanho correto', () => {
      const token = (service as any).generateVerificationToken('brand-id', ValidationMethod.META_TAG)
      
      expect(token).toHaveLength(32)
      expect(token).toMatch(/^[a-f0-9]{32}$/)
    })
  })

  describe('getVerificationInstructions', () => {
    it('deve retornar instruções completas para todas as validações', async () => {
      const validations = [
        {
          method: ValidationMethod.DNS_TXT,
          domain: 'example.com',
          verificationToken: 'dns-token',
          status: ValidationStatus.PENDING,
          expiresAt: new Date(Date.now() + 86400000)
        },
        {
          method: ValidationMethod.META_TAG,
          verificationToken: 'meta-token',
          status: ValidationStatus.VERIFIED,
          expiresAt: null
        }
      ]

      ;(prisma.ownershipValidation.findMany as jest.Mock).mockResolvedValue(validations)

      const instructions = await service.getVerificationInstructions('test-brand-id')

      expect(instructions.dns).toEqual({
        record: '_dmcaguard.example.com',
        type: 'TXT',
        value: 'dns-token',
        status: ValidationStatus.PENDING,
        expiresAt: expect.any(Date)
      })

      expect(instructions.metaTag).toEqual({
        tag: '<meta name="dmca-guard-verification" content="meta-token" />',
        status: ValidationStatus.VERIFIED,
        expiresAt: null
      })

      expect(instructions.status).toEqual({
        [ValidationMethod.DNS_TXT]: ValidationStatus.PENDING,
        [ValidationMethod.META_TAG]: ValidationStatus.VERIFIED
      })
    })
  })

  describe('calculateAbuseState', () => {
    it('deve calcular estado correto baseado no score', () => {
      expect((service as any).calculateAbuseState(0.1)).toBe('CLEAN')
      expect((service as any).calculateAbuseState(0.4)).toBe('WARNING')
      expect((service as any).calculateAbuseState(0.7)).toBe('HIGH_RISK')
      expect((service as any).calculateAbuseState(0.9)).toBe('BLOCKED')
    })
  })

  describe('getOrCreateValidation', () => {
    it('deve criar nova validação quando não existe', async () => {
      ;(prisma.ownershipValidation.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.brandProfile.findUnique as jest.Mock).mockResolvedValue({
        userId: 'test-user-id'
      })
      ;(prisma.ownershipValidation.upsert as jest.Mock).mockResolvedValue({
        id: 'new-validation-id',
        verificationToken: 'new-token'
      })

      const result = await (service as any).getOrCreateValidation(
        'test-brand-id',
        ValidationMethod.DNS_TXT,
        'example.com'
      )

      expect(prisma.ownershipValidation.upsert).toHaveBeenCalledWith({
        where: {
          brandProfileId_method: {
            brandProfileId: 'test-brand-id',
            method: ValidationMethod.DNS_TXT
          }
        },
        update: expect.any(Object),
        create: expect.objectContaining({
          brandProfileId: 'test-brand-id',
          userId: 'test-user-id',
          domain: 'example.com',
          method: ValidationMethod.DNS_TXT,
          status: ValidationStatus.PENDING
        })
      })
    })

    it('deve reutilizar validação pendente existente', async () => {
      const existingValidation = {
        id: 'existing-id',
        status: ValidationStatus.PENDING,
        verificationToken: 'existing-token'
      }

      ;(prisma.ownershipValidation.findUnique as jest.Mock).mockResolvedValue(existingValidation)

      const result = await (service as any).getOrCreateValidation(
        'test-brand-id',
        ValidationMethod.META_TAG
      )

      expect(result).toEqual(existingValidation)
      expect(prisma.ownershipValidation.upsert).not.toHaveBeenCalled()
    })
  })

  describe('flagForManualReview', () => {
    it('deve criar validação de revisão manual', async () => {
      const validations = [
        { valid: false, method: ValidationMethod.DNS_TXT, score: 0 },
        { valid: false, method: ValidationMethod.META_TAG, score: 0 }
      ]

      ;(prisma.ownershipValidation.create as jest.Mock).mockResolvedValue({})

      await (service as any).flagForManualReview(
        'test-user-id',
        mockBrandProfile,
        0.25,
        validations
      )

      expect(prisma.ownershipValidation.create).toHaveBeenCalledWith({
        data: {
          userId: 'test-user-id',
          brandProfileId: 'test-brand-id',
          method: ValidationMethod.MANUAL_REVIEW,
          status: ValidationStatus.MANUAL_REVIEW_REQUIRED,
          score: 0.25,
          metadata: {
            reason: 'Low automatic validation score',
            validations: expect.any(String),
            flaggedAt: expect.any(String)
          }
        }
      })
    })
  })
})