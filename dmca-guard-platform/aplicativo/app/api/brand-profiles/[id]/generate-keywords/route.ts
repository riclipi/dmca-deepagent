import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { safeKeywordGenerator } from '@/lib/safe-keyword-generator'
import { createAuditLog, getClientIP } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      config = {},
      forceRegenerate = false 
    } = body

    // Verificar se o brand profile pertence ao usuário
    const brandProfile = await prisma.brandProfile.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        isActive: true
      }
    })

    if (!brandProfile) {
      return NextResponse.json(
        { error: 'Perfil de marca não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se já tem keywords geradas e se deve regenerar
    if (!forceRegenerate && brandProfile.safeKeywords && brandProfile.safeKeywords.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Keywords já existem para este perfil',
        existing: {
          safeKeywords: brandProfile.safeKeywords,
          moderateKeywords: brandProfile.moderateKeywords,
          dangerousKeywords: brandProfile.dangerousKeywords,
          lastUpdate: brandProfile.lastKeywordUpdate
        },
        needsRegeneration: false
      })
    }

    // Configuração para geração segura
    const keywordConfig = safeKeywordGenerator.getDefaultConfig(brandProfile.brandName)
    
    // Aplicar configurações personalizadas se fornecidas
    if (config.minLength) keywordConfig.minLength = Math.max(3, config.minLength)
    if (config.maxVariations) keywordConfig.maxVariations = Math.min(100, config.maxVariations)
    if (config.dangerousPatterns) keywordConfig.dangerousPatterns.push(...config.dangerousPatterns)
    if (config.includeLeetspeakLight !== undefined) keywordConfig.includeLeetspeakLight = config.includeLeetspeakLight
    if (config.includeSeparators !== undefined) keywordConfig.includeSeparators = config.includeSeparators
    if (config.includeSpacing !== undefined) keywordConfig.includeSpacing = config.includeSpacing

    // Gerar keywords seguras
    const generationResult = safeKeywordGenerator.generateSafeKeywords(keywordConfig)

    // Criar entradas de review para keywords moderadas
    const keywordReviews = []
    for (const moderateKeyword of generationResult.moderate) {
      const riskAnalysis = safeKeywordGenerator.validateExistingKeywords([moderateKeyword], brandProfile.brandName)[0]
      
      keywordReviews.push({
        userId: session.user.id,
        brandProfileId: brandProfile.id,
        keyword: moderateKeyword,
        riskScore: riskAnalysis.riskScore,
        riskReasons: riskAnalysis.riskReasons,
        status: 'PENDING' as const
      })
    }

    // Salvar tudo em uma transação
    const result = await prisma.$transaction(async (tx) => {
      // Atualizar brand profile com keywords geradas
      const updatedProfile = await tx.brandProfile.update({
        where: { id: brandProfile.id },
        data: {
          safeKeywords: generationResult.safe,
          moderateKeywords: generationResult.moderate,
          dangerousKeywords: generationResult.dangerous,
          keywordConfig: keywordConfig,
          lastKeywordUpdate: new Date()
        }
      })

      // Remover reviews antigas se estiver regenerando
      if (forceRegenerate) {
        await tx.keywordReview.deleteMany({
          where: {
            userId: session.user.id,
            brandProfileId: brandProfile.id
          }
        })
      }

      // Criar novas reviews para keywords moderadas
      if (keywordReviews.length > 0) {
        await tx.keywordReview.createMany({
          data: keywordReviews
        })
      }

      return updatedProfile
    })

    // Atualizar totalKeywords em sessões que usam este perfil
    await prisma.monitoringSession.updateMany({
      where: {
        brandProfileId: brandProfile.id,
        useProfileKeywords: true,
        isActive: true
      },
      data: {
        totalKeywords: generationResult.safe.length,
        processedKeywords: 0,
        progress: 0
      }
    })

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'keywords_generated',
      'brand_profile',
      {
        brandProfileId: brandProfile.id,
        brandName: brandProfile.brandName,
        stats: generationResult,
        forceRegenerate
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    // Gerar relatório de segurança
    const riskStats = safeKeywordGenerator.getRiskStatistics([
      ...generationResult.safe.map(k => ({ keyword: k, riskScore: 0, riskReasons: [], isApproved: true })),
      ...safeKeywordGenerator.validateExistingKeywords(generationResult.moderate, brandProfile.brandName),
      ...safeKeywordGenerator.validateExistingKeywords(generationResult.dangerous, brandProfile.brandName)
    ])

    return NextResponse.json({
      success: true,
      message: `Keywords geradas com sucesso para ${brandProfile.brandName}`,
      result: {
        safeKeywords: generationResult.safe,
        moderateKeywords: generationResult.moderate,
        dangerousKeywords: generationResult.dangerous,
        stats: generationResult,
        riskStatistics: riskStats,
        reviewsCreated: keywordReviews.length,
        lastUpdate: result.lastKeywordUpdate
      },
      recommendations: generateRecommendations(generationResult, riskStats)
    })

  } catch (error: any) {
    console.error('Erro ao gerar keywords:', error)
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar informações atuais de keywords
    const brandProfile = await prisma.brandProfile.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        isActive: true
      },
      select: {
        id: true,
        brandName: true,
        safeKeywords: true,
        moderateKeywords: true,
        dangerousKeywords: true,
        keywordConfig: true,
        lastKeywordUpdate: true
      }
    })

    if (!brandProfile) {
      return NextResponse.json(
        { error: 'Perfil de marca não encontrado' },
        { status: 404 }
      )
    }

    // Buscar reviews pendentes
    const pendingReviews = await prisma.keywordReview.findMany({
      where: {
        userId: session.user.id,
        brandProfileId: brandProfile.id,
        status: 'PENDING'
      },
      select: {
        id: true,
        keyword: true,
        riskScore: true,
        riskReasons: true,
        createdAt: true
      }
    })

    // Gerar estatísticas
    const allKeywords = [
      ...(brandProfile.safeKeywords || []),
      ...(brandProfile.moderateKeywords || []),
      ...(brandProfile.dangerousKeywords || [])
    ]

    const stats = {
      totalGenerated: allKeywords.length,
      safeCount: brandProfile.safeKeywords?.length || 0,
      moderateCount: brandProfile.moderateKeywords?.length || 0,
      dangerousCount: brandProfile.dangerousKeywords?.length || 0,
      pendingReviews: pendingReviews.length
    }

    return NextResponse.json({
      brandProfile: {
        id: brandProfile.id,
        brandName: brandProfile.brandName,
        safeKeywords: brandProfile.safeKeywords || [],
        moderateKeywords: brandProfile.moderateKeywords || [],
        dangerousKeywords: brandProfile.dangerousKeywords || [],
        lastUpdate: brandProfile.lastKeywordUpdate
      },
      stats,
      pendingReviews,
      hasKeywords: allKeywords.length > 0,
      needsRegeneration: !brandProfile.lastKeywordUpdate || 
        (Date.now() - new Date(brandProfile.lastKeywordUpdate).getTime()) > (30 * 24 * 60 * 60 * 1000) // 30 dias
    })

  } catch (error) {
    console.error('Erro ao buscar keywords:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

function generateRecommendations(result: any, riskStats: any): string[] {
  const recommendations: string[] = []

  if (result.safe.length < 5) {
    recommendations.push('⚠️ Poucas keywords seguras geradas. Considere um nome de marca mais específico.')
  }

  if (result.moderate.length > result.safe.length) {
    recommendations.push('🔍 Muitas keywords precisam de review manual. Revise cuidadosamente antes de usar.')
  }

  if (result.dangerous.length > result.total * 0.5) {
    recommendations.push('🚨 Muitas keywords foram bloqueadas. O nome da marca pode ser muito genérico.')
  }

  if (riskStats.averageRisk > 40) {
    recommendations.push('⚠️ Risco médio alto detectado. Use apenas keywords aprovadas manualmente.')
  }

  if (result.safe.length === 0) {
    recommendations.push('❌ Nenhuma keyword segura gerada automaticamente. Review manual obrigatória.')
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Geração de keywords bem-sucedida. Sistema de segurança funcionando corretamente.')
  }

  return recommendations
}