// lib/services/security/ownership-validation.service.ts
import { BrandProfile, ValidationMethod, ValidationStatus, ViolationType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createHash } from 'crypto'
import dns from 'dns/promises'

interface ValidationResult {
  valid: boolean
  method: ValidationMethod
  score: number
  details?: any
}

export class OwnershipValidationService {
  private static readonly VERIFICATION_PREFIX = '_dmcaguard'
  private static readonly TOKEN_EXPIRY_HOURS = 48
  
  /**
   * Valida a propriedade de uma marca através de múltiplos métodos
   */
  async validateBrandOwnership(userId: string, brandProfile: BrandProfile): Promise<void> {
    console.log(`[Ownership] Starting validation for brand ${brandProfile.brandName}`)
    
    // Verificar se já existe validação válida
    const existingValidation = await prisma.ownershipValidation.findMany({
      where: {
        brandProfileId: brandProfile.id,
        status: ValidationStatus.VERIFIED,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    })

    if (existingValidation.length > 0) {
      console.log(`[Ownership] Brand ${brandProfile.brandName} already validated`)
      return
    }

    // Executar múltiplas validações em paralelo
    const validations = await Promise.all([
      this.checkDomainOwnership(userId, brandProfile),
      this.checkSocialMediaOwnership(userId, brandProfile),
      this.checkMetaTagOwnership(userId, brandProfile)
    ])

    // Calcular score total
    const totalScore = validations.reduce((sum, v) => sum + v.score, 0) / validations.length

    console.log(`[Ownership] Total ownership score: ${totalScore}`)

    if (totalScore < 0.5) {
      // Criar registro de falha e marcar para revisão manual
      await this.flagForManualReview(userId, brandProfile, totalScore, validations)
      
      // Registrar violação de abuso
      await this.recordAbuseViolation(userId, ViolationType.FAKE_OWNERSHIP, 0.7, {
        brandProfileId: brandProfile.id,
        score: totalScore,
        validations
      })
      
      throw new Error('Falha na validação de propriedade. Revisão manual necessária.')
    }

    console.log(`[Ownership] Brand ${brandProfile.brandName} validated successfully`)
  }

  /**
   * Verifica propriedade via DNS TXT record
   */
  private async checkDomainOwnership(userId: string, brandProfile: BrandProfile): Promise<ValidationResult> {
    if (!brandProfile.officialUrls || brandProfile.officialUrls.length === 0) {
      return { valid: false, method: ValidationMethod.DNS_TXT, score: 0 }
    }

    try {
      // Extrair domínio principal da primeira URL
      const url = new URL(brandProfile.officialUrls[0])
      const domain = url.hostname.replace('www.', '')
      
      // Gerar ou recuperar token de verificação
      const validation = await this.getOrCreateValidation(
        brandProfile.id,
        ValidationMethod.DNS_TXT,
        domain
      )
      
      const verificationDomain = `${OwnershipValidationService.VERIFICATION_PREFIX}.${domain}`
      
      try {
        // Resolver registros TXT
        const records = await dns.resolveTxt(verificationDomain)
        const flatRecords = records.flat()
        
        // Verificar se o token está presente
        const isValid = flatRecords.some(record => 
          record.includes(validation.verificationToken!)
        )
        
        if (isValid) {
          // Atualizar validação como verificada
          await prisma.ownershipValidation.update({
            where: { id: validation.id },
            data: {
              status: ValidationStatus.VERIFIED,
              validatedAt: new Date(),
              score: 1.0
            }
          })
          
          return {
            valid: true,
            method: ValidationMethod.DNS_TXT,
            score: 1.0,
            details: { domain, records: flatRecords }
          }
        }
      } catch (dnsError) {
        console.log(`[Ownership] DNS lookup failed for ${verificationDomain}:`, dnsError)
      }
      
      return {
        valid: false,
        method: ValidationMethod.DNS_TXT,
        score: 0,
        details: { domain, token: validation.verificationToken }
      }
      
    } catch (error) {
      console.error('[Ownership] Domain validation error:', error)
      return { valid: false, method: ValidationMethod.DNS_TXT, score: 0 }
    }
  }

  /**
   * Verifica propriedade via meta tags no HTML
   */
  private async checkMetaTagOwnership(userId: string, brandProfile: BrandProfile): Promise<ValidationResult> {
    if (!brandProfile.officialUrls || brandProfile.officialUrls.length === 0) {
      return { valid: false, method: ValidationMethod.META_TAG, score: 0 }
    }

    try {
      const url = brandProfile.officialUrls[0]
      
      // Gerar ou recuperar token
      const validation = await this.getOrCreateValidation(
        brandProfile.id,
        ValidationMethod.META_TAG,
        url
      )
      
      // Fazer requisição HTTP para buscar meta tags
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DMCA Guard Ownership Validator/1.0'
        }
      })
      
      if (!response.ok) {
        return { valid: false, method: ValidationMethod.META_TAG, score: 0 }
      }
      
      const html = await response.text()
      
      // Procurar por meta tag de verificação
      const metaRegex = /<meta\s+name="dmca-guard-verification"\s+content="([^"]+)"/i
      const match = html.match(metaRegex)
      
      if (match && match[1] === validation.verificationToken) {
        await prisma.ownershipValidation.update({
          where: { id: validation.id },
          data: {
            status: ValidationStatus.VERIFIED,
            validatedAt: new Date(),
            score: 0.9
          }
        })
        
        return {
          valid: true,
          method: ValidationMethod.META_TAG,
          score: 0.9,
          details: { url, token: validation.verificationToken }
        }
      }
      
      return {
        valid: false,
        method: ValidationMethod.META_TAG,
        score: 0,
        details: { url, expectedToken: validation.verificationToken }
      }
      
    } catch (error) {
      console.error('[Ownership] Meta tag validation error:', error)
      return { valid: false, method: ValidationMethod.META_TAG, score: 0 }
    }
  }

  /**
   * Verifica propriedade via perfis de redes sociais
   */
  private async checkSocialMediaOwnership(userId: string, brandProfile: BrandProfile): Promise<ValidationResult> {
    if (!brandProfile.socialMedia) {
      return { valid: false, method: ValidationMethod.SOCIAL_MEDIA, score: 0 }
    }

    try {
      const socialProfiles = brandProfile.socialMedia as Record<string, string>
      let validatedCount = 0
      let totalProfiles = 0
      
      // Verificar cada perfil social
      for (const [platform, profileUrl] of Object.entries(socialProfiles)) {
        if (typeof profileUrl === 'string' && profileUrl) {
          totalProfiles++
          
          // Aqui seria feita a verificação real via APIs das plataformas
          // Por enquanto, vamos simular baseado na presença de URLs válidas
          try {
            const url = new URL(profileUrl)
            if (url.hostname.includes(platform.toLowerCase())) {
              validatedCount++
            }
          } catch {}
        }
      }
      
      const score = totalProfiles > 0 ? validatedCount / totalProfiles * 0.7 : 0
      
      return {
        valid: score > 0.5,
        method: ValidationMethod.SOCIAL_MEDIA,
        score,
        details: { 
          validated: validatedCount, 
          total: totalProfiles,
          platforms: Object.keys(socialProfiles)
        }
      }
      
    } catch (error) {
      console.error('[Ownership] Social media validation error:', error)
      return { valid: false, method: ValidationMethod.SOCIAL_MEDIA, score: 0 }
    }
  }

  /**
   * Gera ou recupera validação existente
   */
  private async getOrCreateValidation(
    brandProfileId: string,
    method: ValidationMethod,
    domain?: string
  ) {
    const existing = await prisma.ownershipValidation.findUnique({
      where: {
        brandProfileId_method: { brandProfileId, method }
      }
    })

    if (existing && existing.status === ValidationStatus.PENDING) {
      return existing
    }

    const verificationToken = this.generateVerificationToken(brandProfileId, method)
    
    return prisma.ownershipValidation.upsert({
      where: {
        brandProfileId_method: { brandProfileId, method }
      },
      update: {
        verificationToken,
        status: ValidationStatus.PENDING,
        expiresAt: new Date(Date.now() + OwnershipValidationService.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
        attempts: { increment: 1 }
      },
      create: {
        brandProfileId,
        userId: (await prisma.brandProfile.findUnique({ 
          where: { id: brandProfileId }, 
          select: { userId: true } 
        }))!.userId,
        domain,
        method,
        status: ValidationStatus.PENDING,
        verificationToken,
        expiresAt: new Date(Date.now() + OwnershipValidationService.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
        score: 0
      }
    })
  }

  /**
   * Gera token de verificação único
   */
  private generateVerificationToken(brandProfileId: string, method: ValidationMethod): string {
    const data = `${brandProfileId}-${method}-${Date.now()}-${Math.random()}`
    return createHash('sha256').update(data).digest('hex').substring(0, 32)
  }

  /**
   * Marca perfil para revisão manual
   */
  private async flagForManualReview(
    userId: string,
    brandProfile: BrandProfile,
    score: number,
    validations: ValidationResult[]
  ) {
    console.log(`[Ownership] Flagging brand ${brandProfile.brandName} for manual review`)
    
    // Criar validação manual pendente
    await prisma.ownershipValidation.create({
      data: {
        userId,
        brandProfileId: brandProfile.id,
        method: ValidationMethod.MANUAL_REVIEW,
        status: ValidationStatus.MANUAL_REVIEW_REQUIRED,
        score,
        metadata: {
          reason: 'Low automatic validation score',
          validations: JSON.parse(JSON.stringify(validations)),
          flaggedAt: new Date().toISOString()
        }
      }
    })
  }

  /**
   * Registra violação de abuso
   */
  private async recordAbuseViolation(
    userId: string,
    type: ViolationType,
    severity: number,
    metadata: any
  ) {
    // Obter ou criar score de abuso
    const abuseScore = await prisma.abuseScore.upsert({
      where: { userId },
      update: {},
      create: { userId }
    })

    // Criar violação
    await prisma.abuseViolation.create({
      data: {
        userId,
        scoreId: abuseScore.id,
        type,
        severity,
        description: 'Tentativa de validação de propriedade falhou',
        metadata
      }
    })

    // Atualizar score e estado
    const newScore = abuseScore.currentScore + severity * 0.2
    const newState = this.calculateAbuseState(newScore)

    await prisma.abuseScore.update({
      where: { id: abuseScore.id },
      data: {
        currentScore: newScore,
        state: newState,
        lastViolation: new Date()
      }
    })
  }

  /**
   * Calcula estado de abuso baseado no score
   */
  private calculateAbuseState(score: number) {
    if (score >= 0.8) return 'BLOCKED'
    if (score >= 0.6) return 'HIGH_RISK'
    if (score >= 0.3) return 'WARNING'
    return 'CLEAN'
  }

  /**
   * Obtém instruções de verificação para o usuário
   */
  async getVerificationInstructions(brandProfileId: string): Promise<any> {
    const validations = await prisma.ownershipValidation.findMany({
      where: { brandProfileId }
    })

    const instructions = {
      dns: null as any,
      metaTag: null as any,
      status: {} as any
    }

    for (const validation of validations) {
      if (validation.method === ValidationMethod.DNS_TXT && validation.domain) {
        instructions.dns = {
          record: `${OwnershipValidationService.VERIFICATION_PREFIX}.${validation.domain}`,
          type: 'TXT',
          value: validation.verificationToken,
          status: validation.status,
          expiresAt: validation.expiresAt
        }
      } else if (validation.method === ValidationMethod.META_TAG) {
        instructions.metaTag = {
          tag: `<meta name="dmca-guard-verification" content="${validation.verificationToken}" />`,
          status: validation.status,
          expiresAt: validation.expiresAt
        }
      }
      
      instructions.status[validation.method] = validation.status
    }

    return instructions
  }
}

// Export singleton instance
export const ownershipValidationService = new OwnershipValidationService()