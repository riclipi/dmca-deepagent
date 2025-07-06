// lib/services/security/anti-flooding.service.ts
import { PlanType, ViolationType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { GeminiAIService } from '@/lib/services/gemini-ai'
import { notificationService, NotificationType } from '../notification.service'

interface KeywordQualityAnalysis {
  spamProbability: number
  quality: 'HIGH' | 'MEDIUM' | 'LOW' | 'SPAM'
  issues: string[]
  suggestions?: string[]
}

interface RateLimitConfig {
  keywords: number
  monitoringSessions: number
  scans: number
  takedowns: number
  apiCalls: number
}

export class AntiFloodingService {
  private static readonly RATE_LIMITS: Record<PlanType, RateLimitConfig> = {
    FREE: {
      keywords: 50,
      monitoringSessions: 1,
      scans: 5,
      takedowns: 10,
      apiCalls: 100
    },
    BASIC: {
      keywords: 200,
      monitoringSessions: 3,
      scans: 20,
      takedowns: 50,
      apiCalls: 500
    },
    PREMIUM: {
      keywords: 1000,
      monitoringSessions: 10,
      scans: 100,
      takedowns: 200,
      apiCalls: 2000
    },
    ENTERPRISE: {
      keywords: 5000,
      monitoringSessions: 50,
      scans: 500,
      takedowns: 1000,
      apiCalls: 10000
    },
    SUPER_USER: {
      keywords: Infinity,
      monitoringSessions: Infinity,
      scans: Infinity,
      takedowns: Infinity,
      apiCalls: Infinity
    }
  }

  private geminiService: GeminiAIService

  constructor() {
    this.geminiService = new GeminiAIService()
  }

  /**
   * Valida criação de keywords com rate limiting e análise de qualidade
   */
  async validateKeywordCreation(
    userId: string, 
    keywords: string[],
    brandProfileId: string
  ): Promise<string[]> {
    console.log(`[Anti-Flooding] Validating ${keywords.length} keywords for user ${userId}`)

    // Obter plano do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { planType: true }
    })

    if (!user) {
      throw new Error('Usuário não encontrado')
    }

    // Verificar rate limit
    await this.checkRateLimit(userId, user.planType, 'KEYWORD_GENERATION', keywords.length)

    // Análise de qualidade das keywords
    const qualityAnalysis = await this.analyzeKeywordQuality(keywords, brandProfileId)

    if (qualityAnalysis.spamProbability > 0.8) {
      // Registrar violação de spam
      await this.recordSpamViolation(userId, keywords, qualityAnalysis)
      throw new Error('Keywords identificadas como spam. Por favor, use termos mais específicos e relevantes.')
    }

    // Normalizar e deduplicar keywords
    const normalizedKeywords = await this.normalizeAndValidateKeywords(
      keywords, 
      qualityAnalysis
    )

    // Verificar duplicação excessiva
    const deduplicationRate = normalizedKeywords.length / keywords.length
    if (deduplicationRate < 0.3) {
      await this.incrementAbuseScore(userId, 0.2, {
        reason: 'Excessive keyword duplication',
        originalCount: keywords.length,
        uniqueCount: normalizedKeywords.length
      })
    }

    // Log da atividade
    await this.logUserActivity(userId, 'KEYWORD_GENERATION', {
      count: normalizedKeywords.length,
      brandProfileId,
      quality: qualityAnalysis.quality
    })

    return normalizedKeywords
  }

  /**
   * Verifica rate limit para uma ação
   */
  async checkRateLimit(
    userId: string,
    planType: PlanType,
    action: string,
    count: number = 1
  ): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 3600000)
    
    // Contar atividades recentes
    const recentActivityCount = await prisma.userActivity.count({
      where: {
        userId,
        action,
        createdAt: { gte: oneHourAgo }
      }
    })

    // Obter limite baseado no tipo de ação
    const limit = this.getRateLimitForAction(planType, action)

    if (recentActivityCount + count > limit) {
      // Registrar tentativa de exceder limite
      await this.recordRateLimitViolation(userId, action, recentActivityCount, limit)
      
      throw new Error(
        `Limite de ${this.getActionName(action)} excedido. ` +
        `Limite: ${limit}/hora. Usado: ${recentActivityCount}. ` +
        `Faça upgrade do seu plano para aumentar os limites.`
      )
    }
  }

  /**
   * Analisa qualidade das keywords usando IA
   */
  private async analyzeKeywordQuality(
    keywords: string[],
    brandProfileId: string
  ): Promise<KeywordQualityAnalysis> {
    try {
      // Obter contexto da marca
      const brandProfile = await prisma.brandProfile.findUnique({
        where: { id: brandProfileId },
        select: { brandName: true, description: true }
      })

      const prompt = `
        Analise a qualidade das seguintes keywords para detecção de violação de direitos autorais.
        
        Marca: ${brandProfile?.brandName}
        Descrição: ${brandProfile?.description || 'N/A'}
        
        Keywords propostas:
        ${keywords.join('\n')}
        
        Avalie:
        1. Probabilidade de spam (0-1)
        2. Qualidade geral (HIGH, MEDIUM, LOW, SPAM)
        3. Problemas identificados
        4. Sugestões de melhoria
        
        Considere spam keywords que são:
        - Muito genéricas (ex: "video", "download", "free")
        - Repetitivas ou com pequenas variações
        - Não relacionadas à marca
        - Caracteres aleatórios ou sem sentido
        
        Responda em JSON com a estrutura:
        {
          "spamProbability": 0.0,
          "quality": "HIGH",
          "issues": [],
          "suggestions": []
        }
      `

      const geminiResponse = await this.geminiService.generateContent(prompt)
      const response = geminiResponse.text
      return JSON.parse(response)
    } catch (error) {
      console.error('[Anti-Flooding] Error analyzing keyword quality:', error)
      
      // Análise fallback baseada em heurísticas
      return this.fallbackKeywordAnalysis(keywords)
    }
  }

  /**
   * Análise de keywords usando heurísticas quando IA falha
   */
  private fallbackKeywordAnalysis(keywords: string[]): KeywordQualityAnalysis {
    const issues: string[] = []
    let spamScore = 0

    // Palavras genéricas comuns que indicam spam
    const genericTerms = [
      'free', 'download', 'video', 'watch', 'online', 'stream',
      'hd', 'full', 'best', 'top', '2024', '2025', 'new'
    ]

    // Análise de cada keyword
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase().trim()

      // Muito curta
      if (lowerKeyword.length < 3) {
        issues.push(`"${keyword}" é muito curta`)
        spamScore += 0.1
      }

      // Contém apenas números
      if (/^\d+$/.test(lowerKeyword)) {
        issues.push(`"${keyword}" contém apenas números`)
        spamScore += 0.2
      }

      // É termo genérico
      if (genericTerms.includes(lowerKeyword)) {
        issues.push(`"${keyword}" é muito genérica`)
        spamScore += 0.15
      }

      // Caracteres especiais excessivos
      if ((lowerKeyword.match(/[^a-z0-9\s]/g) || []).length > 2) {
        issues.push(`"${keyword}" tem muitos caracteres especiais`)
        spamScore += 0.1
      }
    }

    // Verificar duplicação
    const uniqueKeywords = new Set(keywords.map(k => k.toLowerCase().trim()))
    const duplicationRate = 1 - (uniqueKeywords.size / keywords.length)
    
    if (duplicationRate > 0.3) {
      issues.push('Muitas keywords duplicadas ou similares')
      spamScore += duplicationRate * 0.5
    }

    // Determinar qualidade
    const avgSpamScore = Math.min(spamScore / keywords.length, 1)
    let quality: 'HIGH' | 'MEDIUM' | 'LOW' | 'SPAM' = 'HIGH'
    
    if (avgSpamScore > 0.7) quality = 'SPAM'
    else if (avgSpamScore > 0.4) quality = 'LOW'
    else if (avgSpamScore > 0.2) quality = 'MEDIUM'

    return {
      spamProbability: avgSpamScore,
      quality,
      issues,
      suggestions: issues.length > 0 ? [
        'Use termos mais específicos relacionados à sua marca',
        'Evite palavras genéricas como "free", "download", etc.',
        'Inclua variações do nome da marca ou produtos'
      ] : []
    }
  }

  /**
   * Normaliza e valida keywords
   */
  private async normalizeAndValidateKeywords(
    keywords: string[],
    qualityAnalysis: KeywordQualityAnalysis
  ): Promise<string[]> {
    const normalized = new Set<string>()
    const invalid: string[] = []

    for (const keyword of keywords) {
      // Normalizar
      const clean = keyword
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s-]/g, '')

      // Validar comprimento
      if (clean.length < 3 || clean.length > 50) {
        invalid.push(keyword)
        continue
      }

      // Adicionar se não for muito genérica (baseado na análise)
      if (!qualityAnalysis.issues.some(issue => issue.includes(keyword))) {
        normalized.add(clean)
      }
    }

    console.log(`[Anti-Flooding] Normalized ${keywords.length} keywords to ${normalized.size} unique`)
    
    return Array.from(normalized)
  }

  /**
   * Registra violação de spam
   */
  private async recordSpamViolation(
    userId: string,
    keywords: string[],
    analysis: KeywordQualityAnalysis
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
        type: ViolationType.SPAM_KEYWORDS,
        severity: analysis.spamProbability,
        description: `Tentativa de criar ${keywords.length} keywords identificadas como spam`,
        metadata: {
          keywords: keywords.slice(0, 10), // Primeiras 10 para referência
          analysis: analysis as any
        } as any
      }
    })

    // Atualizar score
    await this.updateAbuseScore(abuseScore.id, analysis.spamProbability * 0.3)
  }

  /**
   * Registra violação de rate limit
   */
  private async recordRateLimitViolation(
    userId: string,
    action: string,
    current: number,
    limit: number
  ) {
    const abuseScore = await prisma.abuseScore.upsert({
      where: { userId },
      update: {},
      create: { userId }
    })

    await prisma.abuseViolation.create({
      data: {
        userId,
        scoreId: abuseScore.id,
        type: ViolationType.EXCESSIVE_REQUESTS,
        severity: 0.3,
        description: `Excedeu limite de ${action}`,
        metadata: { action, current, limit }
      }
    })

    await this.updateAbuseScore(abuseScore.id, 0.1)
  }

  /**
   * Incrementa score de abuso
   */
  private async incrementAbuseScore(userId: string, increment: number, metadata?: any) {
    const abuseScore = await prisma.abuseScore.upsert({
      where: { userId },
      update: {},
      create: { userId }
    })

    if (metadata) {
      await prisma.abuseViolation.create({
        data: {
          userId,
          scoreId: abuseScore.id,
          type: ViolationType.SUSPICIOUS_PATTERNS,
          severity: increment,
          description: metadata.reason,
          metadata
        }
      })
    }

    await this.updateAbuseScore(abuseScore.id, increment)
  }

  /**
   * Atualiza score de abuso e estado
   */
  private async updateAbuseScore(scoreId: string, increment: number) {
    const score = await prisma.abuseScore.findUnique({
      where: { id: scoreId }
    })

    if (!score) return

    const newScore = Math.min(score.currentScore + increment, 1.0)
    const newState = this.calculateAbuseState(newScore)

    await prisma.abuseScore.update({
      where: { id: scoreId },
      data: {
        currentScore: newScore,
        state: newState,
        lastViolation: new Date()
      }
    })

    // Se usuário foi bloqueado, tomar ações
    if (newState === 'BLOCKED') {
      await this.handleUserBlocked(score.userId)
    }
  }

  /**
   * Calcula estado baseado no score
   */
  private calculateAbuseState(score: number) {
    if (score >= 0.8) return 'BLOCKED'
    if (score >= 0.6) return 'HIGH_RISK'
    if (score >= 0.3) return 'WARNING'
    return 'CLEAN'
  }

  /**
   * Ações quando usuário é bloqueado
   */
  private async handleUserBlocked(userId: string) {
    console.log(`[Anti-Flooding] User ${userId} has been BLOCKED due to abuse`)
    
    // Notificar administradores
    await notificationService.create({
      userId,
      type: NotificationType.ABUSE_WARNING,
      title: 'Account Blocked Due to Abuse',
      message: 'Your account has been temporarily blocked due to suspicious activity. Please contact support.',
      metadata: {
        priority: 'HIGH',
        reason: 'Abuse score exceeded threshold',
        blockedAt: new Date()
      }
    })
    
    // Notificar administradores (usuários com plano SUPER_USER)
    const admins = await prisma.user.findMany({
      where: { planType: 'SUPER_USER' },
      select: { id: true }
    })
    
    for (const admin of admins) {
      await notificationService.create({
        userId: admin.id,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'User Blocked for Abuse',
        message: `User ${userId} has been blocked due to abuse violations`,
        metadata: {
          priority: 'HIGH',
          blockedUserId: userId,
          blockedAt: new Date()
        }
      })
    }
    
    // Pausar todas as sessões ativas
    await prisma.monitoringSession.updateMany({
      where: { userId, status: 'RUNNING' },
      data: { status: 'PAUSED' }
    })
  }

  /**
   * Registra atividade do usuário
   */
  private async logUserActivity(userId: string, action: string, metadata?: any) {
    await prisma.userActivity.create({
      data: {
        userId,
        action,
        metadata
      }
    })
  }

  /**
   * Obtém limite para ação específica
   */
  private getRateLimitForAction(planType: PlanType, action: string): number {
    const limits = AntiFloodingService.RATE_LIMITS[planType]
    
    switch (action) {
      case 'KEYWORD_GENERATION':
        return limits.keywords
      case 'MONITORING_SESSION_CREATE':
        return limits.monitoringSessions
      case 'SCAN_REQUEST':
        return limits.scans
      case 'TAKEDOWN_REQUEST':
        return limits.takedowns
      default:
        return limits.apiCalls
    }
  }

  /**
   * Obtém nome legível da ação
   */
  private getActionName(action: string): string {
    const names: Record<string, string> = {
      'KEYWORD_GENERATION': 'geração de palavras-chave',
      'MONITORING_SESSION_CREATE': 'criação de sessões de monitoramento',
      'SCAN_REQUEST': 'solicitações de varredura',
      'TAKEDOWN_REQUEST': 'solicitações de remoção',
    }
    return names[action] || action.toLowerCase()
  }

  /**
   * Verifica se usuário pode realizar ação
   */
  async canUserPerformAction(userId: string, action: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { planType: true, abuseScore: true }
      })

      if (!user) return false

      // Verificar se está bloqueado
      if (user.abuseScore?.state === 'BLOCKED') return false

      // Verificar rate limit (sem lançar erro)
      const oneHourAgo = new Date(Date.now() - 3600000)
      const recentCount = await prisma.userActivity.count({
        where: {
          userId,
          action,
          createdAt: { gte: oneHourAgo }
        }
      })

      const limit = this.getRateLimitForAction(user.planType, action)
      return recentCount < limit

    } catch (error) {
      console.error('[Anti-Flooding] Error checking user permission:', error)
      return false
    }
  }
}

// Export singleton instance
export const antiFloodingService = new AntiFloodingService()