import { prisma } from '@/lib/db'
import { safeKeywordGenerator } from '@/lib/safe-keyword-generator'
import { SessionStatus } from '@prisma/client'

export class KeywordIntegrationService {
  /**
   * Sincroniza keywords de um brand profile com suas sessões de monitoramento
   */
  static async syncProfileKeywordsWithSessions(brandProfileId: string): Promise<{
    sessionsUpdated: number;
    totalKeywords: number;
  }> {
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: {
        safeKeywords: true,
        monitoringSessions: {
          where: {
            useProfileKeywords: true,
            isActive: true
          },
          select: { id: true }
        }
      }
    })

    if (!brandProfile) {
      throw new Error('Brand profile não encontrado')
    }

    const safeKeywordCount = brandProfile.safeKeywords?.length || 0
    const sessionIds = brandProfile.monitoringSessions.map(s => s.id)

    if (sessionIds.length > 0) {
      await prisma.monitoringSession.updateMany({
        where: {
          id: { in: sessionIds }
        },
        data: {
          totalKeywords: safeKeywordCount,
          // Reset progress se as keywords mudaram
          processedKeywords: 0,
          progress: 0,
          currentKeyword: null
        }
      })
    }

    return {
      sessionsUpdated: sessionIds.length,
      totalKeywords: safeKeywordCount
    }
  }

  /**
   * Gera keywords seguras para um brand profile se ainda não existem
   */
  static async ensureSafeKeywords(brandProfileId: string, forceRegenerate = false): Promise<{
    generated: boolean;
    safeCount: number;
    moderateCount: number;
    dangerousCount: number;
  }> {
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId }
    })

    if (!brandProfile) {
      throw new Error('Brand profile não encontrado')
    }

    // Verificar se já tem keywords e se deve regenerar
    const hasKeywords = brandProfile.safeKeywords && brandProfile.safeKeywords.length > 0
    if (hasKeywords && !forceRegenerate) {
      return {
        generated: false,
        safeCount: brandProfile.safeKeywords?.length || 0,
        moderateCount: brandProfile.moderateKeywords?.length || 0,
        dangerousCount: brandProfile.dangerousKeywords?.length || 0
      }
    }

    // Gerar keywords seguras
    const config = safeKeywordGenerator.getDefaultConfig(brandProfile.brandName)
    const result = safeKeywordGenerator.generateSafeKeywords(config)

    // Criar reviews para keywords moderadas
    const keywordReviews = result.moderate.map(keyword => {
      const riskAnalysis = safeKeywordGenerator.validateExistingKeywords([keyword], brandProfile.brandName)[0]
      return {
        userId: brandProfile.userId,
        brandProfileId: brandProfile.id,
        keyword,
        riskScore: riskAnalysis.riskScore,
        riskReasons: riskAnalysis.riskReasons,
        status: 'PENDING' as const
      }
    })

    // Salvar em transação
    await prisma.$transaction(async (tx) => {
      // Atualizar brand profile
      await tx.brandProfile.update({
        where: { id: brandProfile.id },
        data: {
          safeKeywords: result.safe,
          moderateKeywords: result.moderate,
          dangerousKeywords: result.dangerous,
          keywordConfig: config,
          lastKeywordUpdate: new Date()
        }
      })

      // Limpar reviews antigas se regenerando
      if (forceRegenerate) {
        await tx.keywordReview.deleteMany({
          where: {
            userId: brandProfile.userId,
            brandProfileId: brandProfile.id
          }
        })
      }

      // Criar novas reviews
      if (keywordReviews.length > 0) {
        await tx.keywordReview.createMany({
          data: keywordReviews
        })
      }
    })

    // Sincronizar com sessões
    await this.syncProfileKeywordsWithSessions(brandProfileId)

    return {
      generated: true,
      safeCount: result.safe.length,
      moderateCount: result.moderate.length,
      dangerousCount: result.dangerous.length
    }
  }

  /**
   * Obtém keywords efetivas para uma sessão de monitoramento
   */
  static async getEffectiveKeywords(sessionId: string): Promise<string[]> {
    const session = await prisma.monitoringSession.findUnique({
      where: { id: sessionId },
      include: {
        brandProfile: {
          select: {
            safeKeywords: true
          }
        }
      }
    })

    if (!session) {
      throw new Error('Sessão não encontrada')
    }

    let keywords: string[] = []

    if (session.useProfileKeywords) {
      // Usar keywords do perfil
      keywords = session.brandProfile.safeKeywords || []
    }

    // Adicionar keywords customizadas
    if (session.customKeywords) {
      keywords = [...keywords, ...session.customKeywords]
    }

    // Remover keywords excluídas
    if (session.excludeKeywords && session.excludeKeywords.length > 0) {
      keywords = keywords.filter(k => !session.excludeKeywords.includes(k))
    }

    // Remover duplicatas e keywords vazias
    return [...new Set(keywords.filter(k => k && k.trim().length > 0))]
  }

  /**
   * Atualiza o progresso de uma sessão em tempo real
   */
  static async updateSessionProgress(
    sessionId: string,
    updates: {
      currentKeyword?: string | null;
      processedKeywords?: number;
      resultsFound?: number;
      status?: SessionStatus;
    }
  ): Promise<void> {
    const session = await prisma.monitoringSession.findUnique({
      where: { id: sessionId },
      select: { totalKeywords: true, processedKeywords: true }
    })

    if (!session) {
      throw new Error('Sessão não encontrada')
    }

    const updateData: any = { ...updates }

    // Calcular progresso automaticamente se processedKeywords foi atualizado
    if (updates.processedKeywords !== undefined && session.totalKeywords > 0) {
      updateData.progress = Math.round((updates.processedKeywords / session.totalKeywords) * 100)
    }

    // Atualizar timestamps conforme o status
    if (updates.status === SessionStatus.RUNNING) {
      updateData.lastScanAt = new Date()
    } else if (updates.status === SessionStatus.COMPLETED) {
      updateData.progress = 100
      updateData.currentKeyword = null
      updateData.lastScanAt = new Date()
    }

    await prisma.monitoringSession.update({
      where: { id: sessionId },
      data: updateData
    })
  }

  /**
   * Aprova uma keyword moderada e a move para keywords seguras
   */
  static async approveModerateKeyword(
    userId: string,
    reviewId: string,
    notes?: string
  ): Promise<void> {
    const review = await prisma.keywordReview.findFirst({
      where: {
        id: reviewId,
        userId,
        status: 'PENDING'
      }
    })

    if (!review) {
      throw new Error('Review não encontrado')
    }

    await prisma.$transaction(async (tx) => {
      // Atualizar o review
      await tx.keywordReview.update({
        where: { id: reviewId },
        data: {
          status: 'APPROVED',
          isApproved: true,
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNotes: notes
        }
      })

      // Atualizar brand profile
      const brandProfile = await tx.brandProfile.findUnique({
        where: { id: review.brandProfileId }
      })

      if (brandProfile) {
        const moderateKeywords = (brandProfile.moderateKeywords || []).filter(k => k !== review.keyword)
        const safeKeywords = [...(brandProfile.safeKeywords || []), review.keyword]

        await tx.brandProfile.update({
          where: { id: review.brandProfileId },
          data: {
            moderateKeywords,
            safeKeywords,
            lastKeywordUpdate: new Date()
          }
        })

        // Sincronizar com sessões
        await this.syncProfileKeywordsWithSessions(review.brandProfileId)
      }
    })
  }

  /**
   * Obtém estatísticas de keywords para um usuário
   */
  static async getUserKeywordStats(userId: string): Promise<{
    totalBrandProfiles: number;
    totalSafeKeywords: number;
    totalModerateKeywords: number;
    totalDangerousKeywords: number;
    pendingReviews: number;
    activeSessions: number;
  }> {
    const [
      brandProfiles,
      pendingReviews,
      activeSessions
    ] = await Promise.all([
      prisma.brandProfile.findMany({
        where: { userId, isActive: true },
        select: {
          safeKeywords: true,
          moderateKeywords: true,
          dangerousKeywords: true
        }
      }),
      prisma.keywordReview.count({
        where: { userId, status: 'PENDING' }
      }),
      prisma.monitoringSession.count({
        where: { userId, isActive: true }
      })
    ])

    const stats = brandProfiles.reduce((acc, profile) => {
      acc.totalSafeKeywords += profile.safeKeywords?.length || 0
      acc.totalModerateKeywords += profile.moderateKeywords?.length || 0
      acc.totalDangerousKeywords += profile.dangerousKeywords?.length || 0
      return acc
    }, {
      totalSafeKeywords: 0,
      totalModerateKeywords: 0,
      totalDangerousKeywords: 0
    })

    return {
      totalBrandProfiles: brandProfiles.length,
      ...stats,
      pendingReviews,
      activeSessions
    }
  }
}