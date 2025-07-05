// lib/services/keyword-intelligence.service.ts
import { prisma } from '@/lib/prisma'
import { GeminiAIService } from '@/lib/services/gemini-ai'
import { emitToRoom } from '@/lib/socket-server'

export interface KeywordClassification {
  keyword: string
  classification: 'SAFE' | 'MODERATE' | 'DANGEROUS'
  riskScore: number // 0-100
  reasons: string[]
  suggestions?: string[]
}

export interface KeywordAnalysis {
  brandContext: {
    name: string
    description?: string
    industry?: string
  }
  keywords: KeywordClassification[]
  statistics: {
    total: number
    safe: number
    moderate: number
    dangerous: number
    averageRiskScore: number
  }
  recommendations: string[]
}

export class KeywordIntelligenceService {
  private geminiService: GeminiAIService

  constructor() {
    this.geminiService = new GeminiAIService()
  }

  /**
   * Sincroniza keywords do perfil com sessões de monitoramento
   */
  static async syncProfileKeywordsWithSessions(brandProfileId: string): Promise<void> {
    console.log(`[Keyword Intelligence] Syncing keywords for profile ${brandProfileId}`)

    const profile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: {
        safeKeywords: true,
        moderateKeywords: true,
        dangerousKeywords: true,
        monitoringSessions: {
          where: { 
            useProfileKeywords: true,
            isActive: true 
          },
          select: { id: true }
        }
      }
    })

    if (!profile) {
      throw new Error('Brand profile not found')
    }

    // Atualizar metadata de todas as sessões que usam keywords do perfil
    const updatePromises = profile.monitoringSessions.map(session =>
      prisma.monitoringSession.update({
        where: { id: session.id },
        data: {
          metadata: {
            lastKeywordSync: new Date(),
            syncedKeywords: {
              safe: profile.safeKeywords.length,
              moderate: profile.moderateKeywords.length,
              dangerous: profile.dangerousKeywords.length
            }
          }
        }
      })
    )

    await Promise.all(updatePromises)

    console.log(`[Keyword Intelligence] Synced ${updatePromises.length} sessions`)
  }

  /**
   * Garante que o perfil tenha keywords seguras
   */
  static async ensureSafeKeywords(
    brandProfileId: string,
    forceRegenerate: boolean = false
  ): Promise<string[]> {
    const profile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: {
        brandName: true,
        description: true,
        keywords: true,
        safeKeywords: true,
        lastKeywordUpdate: true
      }
    })

    if (!profile) {
      throw new Error('Brand profile not found')
    }

    // Se já tem keywords seguras e não é forçado, retornar existentes
    if (profile.safeKeywords.length > 0 && !forceRegenerate) {
      return profile.safeKeywords
    }

    // Gerar novas keywords seguras
    const service = new KeywordIntelligenceService()
    const analysis = await service.analyzeAndClassifyKeywords(
      profile.keywords,
      {
        name: profile.brandName,
        description: profile.description || undefined
      }
    )

    // Separar keywords por classificação
    const safeKeywords = analysis.keywords
      .filter(k => k.classification === 'SAFE')
      .map(k => k.keyword)

    const moderateKeywords = analysis.keywords
      .filter(k => k.classification === 'MODERATE')
      .map(k => k.keyword)

    const dangerousKeywords = analysis.keywords
      .filter(k => k.classification === 'DANGEROUS')
      .map(k => k.keyword)

    // Atualizar perfil
    await prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: {
        safeKeywords,
        moderateKeywords,
        dangerousKeywords,
        lastKeywordUpdate: new Date(),
        keywordConfig: {
          analysis: analysis.statistics,
          recommendations: analysis.recommendations,
          lastAnalysis: new Date()
        }
      }
    })

    // Sincronizar com sessões
    await KeywordIntelligenceService.syncProfileKeywordsWithSessions(brandProfileId)

    return safeKeywords
  }

  /**
   * Obtém keywords efetivas para uma sessão
   */
  static async getEffectiveKeywords(sessionId: string): Promise<string[]> {
    const session = await prisma.monitoringSession.findUnique({
      where: { id: sessionId },
      include: {
        brandProfile: {
          select: {
            safeKeywords: true,
            moderateKeywords: true
          }
        }
      }
    })

    if (!session) {
      throw new Error('Monitoring session not found')
    }

    const keywords: string[] = []

    // Se usa keywords do perfil, adicionar safe e moderate
    if (session.useProfileKeywords) {
      keywords.push(...session.brandProfile.safeKeywords)
      
      // Moderate keywords apenas se configurado
      if (session.metadata?.includeModerateKeywords) {
        keywords.push(...session.brandProfile.moderateKeywords)
      }
    }

    // Adicionar keywords customizadas
    keywords.push(...session.customKeywords)

    // Remover keywords excluídas
    const excludeSet = new Set(session.excludeKeywords)
    const effectiveKeywords = keywords.filter(k => !excludeSet.has(k))

    // Remover duplicatas
    return [...new Set(effectiveKeywords)]
  }

  /**
   * Atualiza progresso da sessão
   */
  static async updateSessionProgress(sessionId: string, updates: any): Promise<void> {
    await prisma.monitoringSession.update({
      where: { id: sessionId },
      data: updates
    })

    // Emitir via WebSocket
    emitToRoom('/monitoring', `session:${sessionId}`, 'progress', {
      sessionId,
      ...updates,
      timestamp: new Date()
    })
  }

  /**
   * Analisa e classifica keywords usando IA
   */
  async analyzeAndClassifyKeywords(
    keywords: string[],
    brandContext: {
      name: string
      description?: string
      industry?: string
    }
  ): Promise<KeywordAnalysis> {
    console.log(`[Keyword Intelligence] Analyzing ${keywords.length} keywords`)

    const prompt = `
      Analise e classifique as seguintes palavras-chave para monitoramento de violação de direitos autorais.
      
      Contexto da Marca:
      Nome: ${brandContext.name}
      Descrição: ${brandContext.description || 'Não fornecida'}
      Indústria: ${brandContext.industry || 'Não especificada'}
      
      Palavras-chave para análise:
      ${keywords.map((k, i) => `${i + 1}. ${k}`).join('\n')}
      
      Para cada palavra-chave, classifique como:
      
      1. SAFE (0-30 risco): 
         - Específica da marca
         - Baixa probabilidade de falsos positivos
         - Alta relevância
      
      2. MODERATE (31-70 risco):
         - Parcialmente genérica
         - Possibilidade média de falsos positivos
         - Requer contexto adicional
      
      3. DANGEROUS (71-100 risco):
         - Muito genérica
         - Alta probabilidade de falsos positivos
         - Pode gerar spam de resultados
      
      Forneça também:
      - Score de risco (0-100)
      - Razões para a classificação
      - Sugestões de melhoria quando aplicável
      
      Responda em JSON com a estrutura:
      {
        "keywords": [
          {
            "keyword": "palavra",
            "classification": "SAFE|MODERATE|DANGEROUS",
            "riskScore": 0-100,
            "reasons": ["razão 1", "razão 2"],
            "suggestions": ["sugestão 1"] // opcional
          }
        ],
        "recommendations": ["recomendação geral 1", "recomendação geral 2"]
      }
    `

    try {
      const response = await this.geminiService.analyzeContent(prompt)
      const analysis = JSON.parse(response)

      // Calcular estatísticas
      const statistics = {
        total: keywords.length,
        safe: 0,
        moderate: 0,
        dangerous: 0,
        averageRiskScore: 0
      }

      let totalRisk = 0
      for (const kw of analysis.keywords) {
        totalRisk += kw.riskScore
        
        switch (kw.classification) {
          case 'SAFE':
            statistics.safe++
            break
          case 'MODERATE':
            statistics.moderate++
            break
          case 'DANGEROUS':
            statistics.dangerous++
            break
        }
      }

      statistics.averageRiskScore = Math.round(totalRisk / keywords.length)

      return {
        brandContext,
        keywords: analysis.keywords,
        statistics,
        recommendations: analysis.recommendations || []
      }

    } catch (error) {
      console.error('[Keyword Intelligence] Error analyzing keywords:', error)
      
      // Fallback para análise básica
      return this.basicKeywordAnalysis(keywords, brandContext)
    }
  }

  /**
   * Análise básica de keywords (fallback)
   */
  private basicKeywordAnalysis(
    keywords: string[],
    brandContext: any
  ): KeywordAnalysis {
    const genericTerms = new Set([
      'free', 'download', 'watch', 'online', 'stream', 'video',
      'movie', 'film', 'series', 'episode', 'season', 'full',
      'hd', '4k', '1080p', '720p', 'torrent', 'mega', 'drive'
    ])

    const analyzed: KeywordClassification[] = keywords.map(keyword => {
      const lower = keyword.toLowerCase()
      const words = lower.split(/\s+/)
      
      // Calcular score baseado em heurísticas
      let riskScore = 0
      const reasons: string[] = []

      // Muito curta
      if (keyword.length < 4) {
        riskScore += 30
        reasons.push('Palavra-chave muito curta')
      }

      // Contém termos genéricos
      const genericCount = words.filter(w => genericTerms.has(w)).length
      if (genericCount > 0) {
        riskScore += genericCount * 20
        reasons.push(`Contém ${genericCount} termo(s) genérico(s)`)
      }

      // Não contém nome da marca
      if (!lower.includes(brandContext.name.toLowerCase())) {
        riskScore += 20
        reasons.push('Não contém o nome da marca')
      }

      // É apenas números
      if (/^\d+$/.test(keyword)) {
        riskScore += 40
        reasons.push('Contém apenas números')
      }

      // Classificar
      riskScore = Math.min(100, riskScore)
      let classification: 'SAFE' | 'MODERATE' | 'DANGEROUS' = 'SAFE'
      
      if (riskScore > 70) {
        classification = 'DANGEROUS'
      } else if (riskScore > 30) {
        classification = 'MODERATE'
      }

      return {
        keyword,
        classification,
        riskScore,
        reasons,
        suggestions: riskScore > 30 ? [
          'Adicione o nome da marca',
          'Use termos mais específicos',
          'Evite palavras genéricas'
        ] : undefined
      }
    })

    // Calcular estatísticas
    const statistics = {
      total: keywords.length,
      safe: analyzed.filter(k => k.classification === 'SAFE').length,
      moderate: analyzed.filter(k => k.classification === 'MODERATE').length,
      dangerous: analyzed.filter(k => k.classification === 'DANGEROUS').length,
      averageRiskScore: Math.round(
        analyzed.reduce((sum, k) => sum + k.riskScore, 0) / keywords.length
      )
    }

    return {
      brandContext,
      keywords: analyzed,
      statistics,
      recommendations: [
        'Inclua sempre o nome da marca nas palavras-chave',
        'Use combinações específicas do seu produto/serviço',
        'Evite termos muito genéricos que geram falsos positivos',
        'Considere variações e erros de digitação comuns da marca'
      ]
    }
  }

  /**
   * Gera sugestões de keywords inteligentes
   */
  async generateKeywordSuggestions(
    brandProfile: {
      id: string
      brandName: string
      description?: string
      officialUrls?: string[]
      socialMedia?: any
    },
    currentKeywords: string[] = []
  ): Promise<string[]> {
    const prompt = `
      Gere sugestões de palavras-chave para monitoramento de violação de direitos autorais.
      
      Marca: ${brandProfile.brandName}
      Descrição: ${brandProfile.description || 'Não fornecida'}
      URLs oficiais: ${brandProfile.officialUrls?.join(', ') || 'Não fornecidas'}
      
      Palavras-chave atuais:
      ${currentKeywords.join(', ') || 'Nenhuma'}
      
      Gere 10-15 sugestões de palavras-chave que sejam:
      1. Específicas da marca
      2. Variações comuns (erros de digitação, abreviações)
      3. Combinações com termos de pirataria (mas não muito genéricas)
      4. Nomes de produtos/serviços específicos
      
      Retorne apenas a lista de palavras-chave sugeridas em JSON:
      {
        "suggestions": ["keyword1", "keyword2", ...]
      }
    `

    try {
      const response = await this.geminiService.analyzeContent(prompt)
      const { suggestions } = JSON.parse(response)
      
      // Filtrar sugestões que já existem
      const existingSet = new Set(currentKeywords.map(k => k.toLowerCase()))
      const newSuggestions = suggestions.filter(
        (s: string) => !existingSet.has(s.toLowerCase())
      )

      return newSuggestions.slice(0, 15)
    } catch (error) {
      console.error('[Keyword Intelligence] Error generating suggestions:', error)
      
      // Fallback para sugestões básicas
      return this.generateBasicSuggestions(brandProfile.brandName, currentKeywords)
    }
  }

  /**
   * Gera sugestões básicas (fallback)
   */
  private generateBasicSuggestions(brandName: string, currentKeywords: string[]): string[] {
    const suggestions: string[] = []
    const existing = new Set(currentKeywords.map(k => k.toLowerCase()))
    
    // Variações do nome
    const nameLower = brandName.toLowerCase()
    const variations = [
      brandName,
      nameLower,
      brandName.replace(/\s+/g, ''),
      brandName.replace(/\s+/g, '-'),
      brandName.replace(/\s+/g, '_')
    ]

    // Adicionar com termos comuns
    const suffixes = ['download', 'free', 'crack', 'torrent', 'pirata']
    
    for (const variation of variations) {
      if (!existing.has(variation.toLowerCase())) {
        suggestions.push(variation)
      }
      
      for (const suffix of suffixes) {
        const combined = `${variation} ${suffix}`
        if (!existing.has(combined.toLowerCase()) && suggestions.length < 15) {
          suggestions.push(combined)
        }
      }
    }

    return suggestions.slice(0, 15)
  }

  /**
   * Analisa efetividade histórica de keywords
   */
  async analyzeKeywordEffectiveness(
    brandProfileId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<any> {
    // Buscar dados históricos
    const detectedContent = await prisma.detectedContent.findMany({
      where: {
        brandProfileId,
        detectedAt: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      },
      select: {
        keywordSource: true,
        confidence: true,
        isConfirmed: true,
        violationType: true
      }
    })

    // Agrupar por keyword
    const keywordStats = new Map<string, {
      detections: number
      avgConfidence: number
      confirmed: number
      falsePositives: number
    }>()

    for (const content of detectedContent) {
      if (!content.keywordSource) continue
      
      const stats = keywordStats.get(content.keywordSource) || {
        detections: 0,
        avgConfidence: 0,
        confirmed: 0,
        falsePositives: 0
      }

      stats.detections++
      stats.avgConfidence = (stats.avgConfidence * (stats.detections - 1) + (content.confidence || 0)) / stats.detections
      
      if (content.isConfirmed) {
        stats.confirmed++
      } else if (content.confidence && content.confidence < 50) {
        stats.falsePositives++
      }

      keywordStats.set(content.keywordSource, stats)
    }

    // Calcular efetividade
    const effectiveness = Array.from(keywordStats.entries()).map(([keyword, stats]) => ({
      keyword,
      detections: stats.detections,
      avgConfidence: Math.round(stats.avgConfidence),
      confirmationRate: stats.detections > 0 ? (stats.confirmed / stats.detections) * 100 : 0,
      falsePositiveRate: stats.detections > 0 ? (stats.falsePositives / stats.detections) * 100 : 0,
      effectivenessScore: this.calculateEffectivenessScore(stats)
    }))

    // Ordenar por efetividade
    effectiveness.sort((a, b) => b.effectivenessScore - a.effectivenessScore)

    return {
      timeRange,
      totalKeywords: effectiveness.length,
      topPerformers: effectiveness.slice(0, 10),
      lowPerformers: effectiveness.filter(e => e.effectivenessScore < 30),
      recommendations: this.generateEffectivenessRecommendations(effectiveness)
    }
  }

  /**
   * Calcula score de efetividade
   */
  private calculateEffectivenessScore(stats: any): number {
    const detectionWeight = Math.min(stats.detections / 10, 1) * 30
    const confidenceWeight = (stats.avgConfidence / 100) * 40
    const confirmationWeight = (stats.confirmed / Math.max(stats.detections, 1)) * 20
    const falsePositivePenalty = (stats.falsePositives / Math.max(stats.detections, 1)) * 10

    return Math.round(detectionWeight + confidenceWeight + confirmationWeight - falsePositivePenalty)
  }

  /**
   * Gera recomendações baseadas em efetividade
   */
  private generateEffectivenessRecommendations(effectiveness: any[]): string[] {
    const recommendations: string[] = []

    const lowPerformers = effectiveness.filter(e => e.effectivenessScore < 30)
    const highFalsePositives = effectiveness.filter(e => e.falsePositiveRate > 50)

    if (lowPerformers.length > 0) {
      recommendations.push(
        `Considere remover ou modificar ${lowPerformers.length} palavras-chave com baixa efetividade`
      )
    }

    if (highFalsePositives.length > 0) {
      recommendations.push(
        `${highFalsePositives.length} palavras-chave estão gerando muitos falsos positivos`
      )
    }

    const avgScore = effectiveness.reduce((sum, e) => sum + e.effectivenessScore, 0) / effectiveness.length
    if (avgScore < 50) {
      recommendations.push(
        'A efetividade geral das palavras-chave está baixa. Considere uma revisão completa.'
      )
    }

    return recommendations
  }
}

// Export singleton instance
export const keywordIntelligenceService = new KeywordIntelligenceService()