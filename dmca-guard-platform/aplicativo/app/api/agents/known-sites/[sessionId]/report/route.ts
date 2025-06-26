import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SessionManager } from '@/lib/agents/session-manager'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const sessionManager = new SessionManager()

/**
 * GET /api/agents/known-sites/[sessionId]/report
 * Obter relatório detalhado da sessão de scan
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const resolvedParams = await params
    const { sessionId } = resolvedParams

    // Verificar se a sessão pertence ao usuário
    const scanSession = await prisma.scanSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id
      },
      include: {
        brandProfile: {
          select: {
            id: true,
            name: true,
            keywords: true
          }
        }
      }
    })

    if (!scanSession) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Buscar relatório completo se a sessão estiver finalizada
    let savedReport = null
    if (scanSession.status === 'COMPLETED') {
      savedReport = await sessionManager.getSessionReport(sessionId)
    }

    // Buscar violações encontradas na sessão
    const violations = await prisma.violationHistory.findMany({
      where: {
        knownSite: {
          userId: session.user.id
        },
        detectedAt: {
          gte: scanSession.startedAt,
          ...(scanSession.completedAt && { lte: scanSession.completedAt })
        }
      },
      include: {
        knownSite: {
          select: {
            id: true,
            domain: true,
            baseUrl: true,
            category: true,
            platform: true
          }
        }
      },
      orderBy: { detectedAt: 'desc' }
    })

    // Buscar eventos da sessão
    const events = await prisma.agentEvent.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' }
    })

    // Calcular métricas
    const duration = scanSession.completedAt ? 
      scanSession.completedAt.getTime() - scanSession.startedAt.getTime() :
      Date.now() - scanSession.startedAt.getTime()

    const violationsByRisk = violations.reduce((acc, violation) => {
      acc[violation.riskLevel] = (acc[violation.riskLevel] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const violationsBySite = violations.reduce((acc, violation) => {
      const domain = violation.knownSite?.domain || 'Desconhecido'
      if (!acc[domain]) {
        acc[domain] = {
          domain,
          category: violation.knownSite?.category,
          platform: violation.knownSite?.platform,
          violations: 0,
          highestRisk: 'LOW'
        }
      }
      acc[domain].violations++
      
      // Atualizar maior risco
      const riskPriority = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }
      const currentRisk = riskPriority[acc[domain].highestRisk as keyof typeof riskPriority] || 1
      const newRisk = riskPriority[violation.riskLevel as keyof typeof riskPriority] || 1
      
      if (newRisk > currentRisk) {
        acc[domain].highestRisk = violation.riskLevel
      }
      
      return acc
    }, {} as Record<string, any>)

    const topViolationSites = Object.values(violationsBySite)
      .sort((a: any, b: any) => b.violations - a.violations)
      .slice(0, 10)

    // Calcular eficiência
    const avgTimePerSite = scanSession.sitesScanned > 0 ? duration / scanSession.sitesScanned : 0
    const successRate = scanSession.sitesScanned > 0 ? 
      ((scanSession.sitesScanned - scanSession.errorCount) / scanSession.sitesScanned) * 100 : 100

    // Analisar padrões de violações
    const violationPatterns = analyzeViolationPatterns(violations)

    // Gerar recomendações
    const recommendations = generateRecommendations(scanSession, violations, violationsByRisk)

    const report = {
      sessionInfo: {
        sessionId,
        brandProfile: scanSession.brandProfile,
        status: scanSession.status,
        startedAt: scanSession.startedAt,
        completedAt: scanSession.completedAt,
        duration: {
          ms: duration,
          formatted: formatDuration(duration)
        }
      },
      summary: {
        totalSites: scanSession.totalSites,
        sitesScanned: scanSession.sitesScanned,
        violationsFound: violations.length,
        errorCount: scanSession.errorCount,
        successRate: Math.round(successRate * 100) / 100,
        averageTimePerSite: Math.round(avgTimePerSite),
        violationRate: scanSession.sitesScanned > 0 ? 
          Math.round((violations.length / scanSession.sitesScanned) * 100) : 0
      },
      violations: {
        total: violations.length,
        byRisk: violationsByRisk,
        byRiskPercentage: Object.entries(violationsByRisk).reduce((acc, [risk, count]) => {
          acc[risk] = violations.length > 0 ? Math.round((count / violations.length) * 100) : 0
          return acc
        }, {} as Record<string, number>),
        topSites: topViolationSites,
        recent: violations.slice(0, 20).map(v => ({
          id: v.id,
          url: v.url,
          title: v.title,
          riskLevel: v.riskLevel,
          confidence: v.confidence,
          detectionMethod: v.detectionMethod,
          detectedAt: v.detectedAt,
          site: {
            domain: v.knownSite?.domain,
            category: v.knownSite?.category,
            platform: v.knownSite?.platform
          },
          metadata: v.metadata
        }))
      },
      analysis: {
        patterns: violationPatterns,
        timeline: generateViolationTimeline(violations),
        coverage: {
          categoriesScanned: await getCategoryCoverage(session.user.id, scanSession.startedAt),
          platformsScanned: await getPlatformCoverage(session.user.id, scanSession.startedAt)
        }
      },
      performance: {
        efficiency: {
          sitesPerMinute: avgTimePerSite > 0 ? Math.round((60 * 1000) / avgTimePerSite) : 0,
          violationsPerSite: scanSession.sitesScanned > 0 ? 
            Math.round((violations.length / scanSession.sitesScanned) * 100) / 100 : 0,
          errorRate: scanSession.sitesScanned > 0 ? 
            Math.round((scanSession.errorCount / scanSession.sitesScanned) * 100) : 0
        },
        timeline: events.map(e => ({
          type: e.type,
          timestamp: e.timestamp,
          data: e.data
        }))
      },
      recommendations,
      savedReport // Incluir relatório salvo se disponível
    }

    return NextResponse.json(report)

  } catch (error) {
    console.error(`Erro ao gerar relatório:`, error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * Analisar padrões nas violações encontradas
 */
function analyzeViolationPatterns(violations: any[]): any {
  const patterns = {
    mostCommonKeywords: {} as Record<string, number>,
    detectionMethods: {} as Record<string, number>,
    timeDistribution: {} as Record<string, number>,
    riskProgression: [] as any[]
  }

  violations.forEach(violation => {
    // Analisar métodos de detecção
    violation.detectionMethod.split(', ').forEach((method: string) => {
      patterns.detectionMethods[method] = (patterns.detectionMethods[method] || 0) + 1
    })

    // Analisar keywords dos metadados
    if (violation.metadata?.keywords) {
      violation.metadata.keywords.forEach((keyword: string) => {
        patterns.mostCommonKeywords[keyword] = (patterns.mostCommonKeywords[keyword] || 0) + 1
      })
    }

    // Distribuição temporal (por hora)
    const hour = new Date(violation.detectedAt).getHours()
    patterns.timeDistribution[hour] = (patterns.timeDistribution[hour] || 0) + 1
  })

  // Ordenar por frequência
  patterns.mostCommonKeywords = Object.fromEntries(
    Object.entries(patterns.mostCommonKeywords)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
  )

  return patterns
}

/**
 * Gerar linha do tempo de violações
 */
function generateViolationTimeline(violations: any[]): any[] {
  const timeline = violations.reduce((acc, violation) => {
    const date = new Date(violation.detectedAt).toISOString().split('T')[0]
    
    if (!acc[date]) {
      acc[date] = {
        date,
        total: 0,
        byRisk: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
      }
    }
    
    acc[date].total++
    acc[date].byRisk[violation.riskLevel]++
    
    return acc
  }, {} as Record<string, any>)

  return Object.values(timeline).sort((a: any, b: any) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )
}

/**
 * Obter cobertura por categoria
 */
async function getCategoryCoverage(userId: string, startedAt: Date): Promise<any[]> {
  const coverage = await prisma.knownSite.groupBy({
    by: ['category'],
    where: {
      userId,
      lastChecked: { gte: startedAt }
    },
    _count: { id: true }
  })

  return coverage.map(c => ({
    category: c.category,
    sitesScanned: c._count.id
  }))
}

/**
 * Obter cobertura por plataforma
 */
async function getPlatformCoverage(userId: string, startedAt: Date): Promise<any[]> {
  const coverage = await prisma.knownSite.groupBy({
    by: ['platform'],
    where: {
      userId,
      platform: { not: null },
      lastChecked: { gte: startedAt }
    },
    _count: { id: true }
  })

  return coverage.map(c => ({
    platform: c.platform,
    sitesScanned: c._count.id
  }))
}

/**
 * Gerar recomendações baseadas nos resultados
 */
function generateRecommendations(
  session: any, 
  violations: any[], 
  violationsByRisk: Record<string, number>
): string[] {
  const recommendations: string[] = []

  // Recomendações baseadas no número de violações
  if (violations.length === 0) {
    recommendations.push('Nenhuma violação encontrada. Continue monitorando regularmente.')
  } else if (violations.length > 50) {
    recommendations.push('Alto número de violações detectadas. Considere ação imediata.')
  }

  // Recomendações baseadas no risco
  if (violationsByRisk.CRITICAL > 0) {
    recommendations.push(`${violationsByRisk.CRITICAL} violações críticas requerem ação imediata.`)
  }
  
  if (violationsByRisk.HIGH > 5) {
    recommendations.push('Múltiplas violações de alto risco detectadas. Priorize a remoção.')
  }

  // Recomendações baseadas na taxa de erro
  if (session.errorCount > session.sitesScanned * 0.2) {
    recommendations.push('Alta taxa de erro durante o scan. Verifique conectividade e rate limits.')
  }

  // Recomendação de frequência
  recommendations.push('Execute varreduras regulares para monitoramento contínuo.')

  return recommendations
}

/**
 * Formatar duração
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}