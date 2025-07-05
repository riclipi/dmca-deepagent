// app/api/brand-profiles/[brandProfileId]/keywords/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { keywordIntelligenceService, KeywordIntelligenceService } from '@/lib/services/keyword-intelligence.service'
import { antiFloodingService } from '@/lib/services/security/anti-flooding.service'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// Schema de validação
const analyzeKeywordsSchema = z.object({
  keywords: z.array(z.string()).min(1).max(100),
  forceRegenerate: z.boolean().optional()
})

/**
 * GET - Obter análise de keywords e estatísticas
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { brandProfileId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    const { brandProfileId } = params

    // Verificar se o perfil pertence ao usuário
    const brandProfile = await prisma.brandProfile.findFirst({
      where: {
        id: brandProfileId,
        userId: session.user.id
      },
      select: {
        id: true,
        brandName: true,
        description: true,
        keywords: true,
        safeKeywords: true,
        moderateKeywords: true,
        dangerousKeywords: true,
        keywordConfig: true,
        lastKeywordUpdate: true
      }
    })

    if (!brandProfile) {
      return ApiResponse.notFound('Perfil de marca')
    }

    // Parâmetros de query
    const { searchParams } = new URL(request.url)
    const includeEffectiveness = searchParams.get('effectiveness') === 'true'

    const response: any = {
      brandProfile: {
        id: brandProfile.id,
        name: brandProfile.brandName,
        lastUpdate: brandProfile.lastKeywordUpdate
      },
      keywords: {
        total: brandProfile.keywords.length,
        safe: brandProfile.safeKeywords,
        moderate: brandProfile.moderateKeywords,
        dangerous: brandProfile.dangerousKeywords,
        statistics: brandProfile.keywordConfig?.analysis || null
      }
    }

    // Incluir análise de efetividade se solicitado
    if (includeEffectiveness) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const effectiveness = await keywordIntelligenceService.analyzeKeywordEffectiveness(
        brandProfileId,
        { start: thirtyDaysAgo, end: new Date() }
      )

      response.effectiveness = effectiveness
    }

    return ApiResponse.success(response)

  } catch (error) {
    return ApiResponse.serverError(error)
  }
}

/**
 * POST - Analisar e classificar keywords
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { brandProfileId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    const { brandProfileId } = params

    // Verificar se o perfil pertence ao usuário
    const brandProfile = await prisma.brandProfile.findFirst({
      where: {
        id: brandProfileId,
        userId: session.user.id
      }
    })

    if (!brandProfile) {
      return ApiResponse.notFound('Perfil de marca')
    }

    // Validar dados
    const body = await request.json()
    let validatedData

    try {
      validatedData = analyzeKeywordsSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ApiResponse.validationError(error)
      }
      throw error
    }

    // Validar keywords com anti-flooding
    const validatedKeywords = await antiFloodingService.validateKeywordCreation(
      session.user.id,
      validatedData.keywords,
      brandProfileId
    )

    // Analisar e classificar keywords
    const analysis = await keywordIntelligenceService.analyzeAndClassifyKeywords(
      validatedKeywords,
      {
        name: brandProfile.brandName,
        description: brandProfile.description || undefined
      }
    )

    // Separar por classificação
    const safeKeywords = analysis.keywords
      .filter(k => k.classification === 'SAFE')
      .map(k => k.keyword)

    const moderateKeywords = analysis.keywords
      .filter(k => k.classification === 'MODERATE')
      .map(k => k.keyword)

    const dangerousKeywords = analysis.keywords
      .filter(k => k.classification === 'DANGEROUS')
      .map(k => k.keyword)

    // Atualizar perfil se solicitado
    if (validatedData.forceRegenerate) {
      await prisma.brandProfile.update({
        where: { id: brandProfileId },
        data: {
          keywords: validatedKeywords,
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
    }

    return ApiResponse.success({
      analysis,
      updated: validatedData.forceRegenerate || false
    })

  } catch (error) {
    return ApiResponse.serverError(error)
  }
}

/**
 * PUT - Gerar sugestões de keywords
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { brandProfileId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    const { brandProfileId } = params

    // Verificar se o perfil pertence ao usuário
    const brandProfile = await prisma.brandProfile.findFirst({
      where: {
        id: brandProfileId,
        userId: session.user.id
      },
      select: {
        id: true,
        brandName: true,
        description: true,
        officialUrls: true,
        socialMedia: true,
        keywords: true
      }
    })

    if (!brandProfile) {
      return ApiResponse.notFound('Perfil de marca')
    }

    // Gerar sugestões
    const suggestions = await keywordIntelligenceService.generateKeywordSuggestions(
      brandProfile,
      brandProfile.keywords
    )

    // Analisar sugestões para dar contexto
    const analysis = await keywordIntelligenceService.analyzeAndClassifyKeywords(
      suggestions,
      {
        name: brandProfile.brandName,
        description: brandProfile.description || undefined
      }
    )

    return ApiResponse.success({
      suggestions: analysis.keywords.map(k => ({
        keyword: k.keyword,
        classification: k.classification,
        riskScore: k.riskScore,
        reasons: k.reasons
      })),
      total: suggestions.length
    })

  } catch (error) {
    return ApiResponse.serverError(error)
  }
}