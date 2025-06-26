import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient, SiteCategory } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

// Schema para filtros de estatísticas
const StatsFiltersSchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
  category: z.nativeEnum(SiteCategory).optional(),
  platform: z.string().optional()
})

/**
 * GET /api/known-sites/stats
 * Obter estatísticas agregadas dos sites conhecidos
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filters = StatsFiltersSchema.parse({
      period: searchParams.get('period') || '30d',
      category: searchParams.get('category') || undefined,
      platform: searchParams.get('platform') || undefined
    })

    // Calcular data de corte baseada no período
    const now = new Date()
    let cutoffDate: Date | undefined

    switch (filters.period) {
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      case 'all':
        cutoffDate = undefined
        break
    }

    // Construir filtros base
    const baseWhere = {
      userId: session.user.id,
      ...(filters.category && { category: filters.category }),
      ...(filters.platform && { platform: filters.platform })
    }

    // Executar queries em paralelo para melhor performance
    const [
      totalSites,
      activeSites,
      sitesWithViolations,
      avgRiskScore,
      categoryStats,
      platformStats,
      riskDistribution,
      recentViolations,
      violationTrends,
      topViolatorSites
    ] = await Promise.all([
      // Total de sites
      prisma.knownSite.count({ where: baseWhere }),

      // Sites ativos
      prisma.knownSite.count({ 
        where: { ...baseWhere, isActive: true } 
      }),

      // Sites com violações
      prisma.knownSite.count({
        where: { 
          ...baseWhere, 
          totalViolations: { gt: 0 } 
        }
      }),

      // Score de risco médio
      prisma.knownSite.aggregate({
        where: baseWhere,
        _avg: { riskScore: true }
      }),

      // Estatísticas por categoria
      prisma.knownSite.groupBy({
        by: ['category'],
        where: baseWhere,
        _count: { id: true },
        _avg: { riskScore: true, totalViolations: true },
        _sum: { totalViolations: true }
      }),

      // Estatísticas por plataforma
      prisma.knownSite.groupBy({
        by: ['platform'],
        where: { ...baseWhere, platform: { not: null } },
        _count: { id: true },
        _avg: { riskScore: true, totalViolations: true },
        _sum: { totalViolations: true }
      }),

      // Distribuição de risco
      prisma.$queryRaw`
        SELECT 
          CASE 
            WHEN "riskScore" < 25 THEN 'LOW'
            WHEN "riskScore" < 50 THEN 'MEDIUM'
            WHEN "riskScore" < 75 THEN 'HIGH'
            ELSE 'CRITICAL'
          END as risk_level,
          COUNT(*) as count
        FROM "known_sites" 
        WHERE "userId" = ${session.user.id}
        ${filters.category ? `AND "category" = '${filters.category}'` : ''}
        ${filters.platform ? `AND "platform" = '${filters.platform}'` : ''}
        GROUP BY risk_level
      `,

      // Violações recentes (se período especificado)
      cutoffDate ? prisma.violationHistory.count({
        where: {
          knownSite: baseWhere,
          detectedAt: { gte: cutoffDate }
        }
      }) : 0,

      // Tendência de violações (últimos 7 dias)
      cutoffDate ? prisma.$queryRaw`
        SELECT 
          DATE("detectedAt") as date,
          COUNT(*) as violations
        FROM "violation_history" vh
        INNER JOIN "known_sites" ks ON vh."knownSiteId" = ks.id
        WHERE ks."userId" = ${session.user.id}
          AND vh."detectedAt" >= ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)}
          ${filters.category ? `AND ks."category" = '${filters.category}'` : ''}
          ${filters.platform ? `AND ks."platform" = '${filters.platform}'` : ''}
        GROUP BY DATE("detectedAt")
        ORDER BY date DESC
        LIMIT 7
      ` : [],

      // Top 10 sites com mais violações
      prisma.knownSite.findMany({
        where: baseWhere,
        orderBy: { totalViolations: 'desc' },
        take: 10,
        select: {
          id: true,
          domain: true,
          baseUrl: true,
          category: true,
          platform: true,
          totalViolations: true,
          riskScore: true,
          lastViolation: true
        }
      })
    ])

    // Calcular métricas derivadas
    const violationRate = totalSites > 0 ? (sitesWithViolations / totalSites) * 100 : 0
    const averageRisk = Math.round(avgRiskScore._avg.riskScore || 0)

    // Formatar dados para resposta
    const response = {
      overview: {
        totalSites,
        activeSites,
        inactiveSites: totalSites - activeSites,
        sitesWithViolations,
        violationRate: Math.round(violationRate * 100) / 100,
        averageRiskScore: averageRisk,
        recentViolations: cutoffDate ? recentViolations : null
      },
      breakdown: {
        byCategory: categoryStats.map(stat => ({
          category: stat.category,
          count: stat._count.id,
          averageRisk: Math.round(stat._avg.riskScore || 0),
          averageViolations: Math.round(stat._avg.totalViolations || 0),
          totalViolations: stat._sum.totalViolations || 0
        })),
        byPlatform: platformStats.map(stat => ({
          platform: stat.platform,
          count: stat._count.id,
          averageRisk: Math.round(stat._avg.riskScore || 0),
          averageViolations: Math.round(stat._avg.totalViolations || 0),
          totalViolations: stat._sum.totalViolations || 0
        })),
        byRiskLevel: Array.isArray(riskDistribution) ? riskDistribution.map((item: any) => ({
          riskLevel: item.risk_level,
          count: Number(item.count)
        })) : []
      },
      trends: {
        period: filters.period,
        dailyViolations: Array.isArray(violationTrends) ? violationTrends.map((item: any) => ({
          date: item.date,
          violations: Number(item.violations)
        })) : []
      },
      topViolators: topViolatorSites.map(site => ({
        id: site.id,
        domain: site.domain,
        baseUrl: site.baseUrl,
        category: site.category,
        platform: site.platform,
        totalViolations: site.totalViolations,
        riskScore: site.riskScore,
        lastViolation: site.lastViolation
      }))
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Erro ao calcular estatísticas:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/known-sites/stats/recalculate
 * Recalcular estatísticas de sites (útil após importações ou correções)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Recalcular totalViolations para todos os sites do usuário
    const sites = await prisma.knownSite.findMany({
      where: { userId: session.user.id },
      select: { id: true }
    })

    let updatedCount = 0

    for (const site of sites) {
      const violationCount = await prisma.violationHistory.count({
        where: { knownSiteId: site.id }
      })

      const lastViolation = await prisma.violationHistory.findFirst({
        where: { knownSiteId: site.id },
        orderBy: { detectedAt: 'desc' },
        select: { detectedAt: true }
      })

      await prisma.knownSite.update({
        where: { id: site.id },
        data: {
          totalViolations: violationCount,
          lastViolation: lastViolation?.detectedAt || null,
          lastChecked: new Date()
        }
      })

      updatedCount++
    }

    return NextResponse.json({
      message: 'Estatísticas recalculadas com sucesso',
      updatedSites: updatedCount
    })

  } catch (error) {
    console.error('Erro ao recalcular estatísticas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}