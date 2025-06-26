import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SessionManager } from '@/lib/agents/session-manager'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const sessionManager = new SessionManager()

/**
 * GET /api/agents/known-sites/[sessionId]/status
 * Obter status em tempo real da sessão de scan
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
            brandName: true
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

    // Obter progresso mais recente
    const progressSnapshot = await prisma.sessionProgress.findUnique({
      where: { sessionId }
    })

    // Calcular métricas de performance
    const elapsed = Date.now() - scanSession.startedAt.getTime()
    const progress = scanSession.totalSites > 0 ? (scanSession.sitesScanned / scanSession.totalSites) * 100 : 0
    const avgTimePerSite = scanSession.sitesScanned > 0 ? elapsed / scanSession.sitesScanned : 0
    const remaining = scanSession.totalSites - scanSession.sitesScanned
    const estimatedRemaining = remaining * avgTimePerSite

    // Obter atividade recente (últimos 5 eventos)
    const recentEvents = await prisma.agentEvent.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      take: 5
    })

    // Obter violações encontradas na sessão atual
    const recentViolations = await prisma.violationHistory.findMany({
      where: {
        knownSite: {
          userId: session.user.id
        },
        detectedAt: {
          gte: scanSession.startedAt
        }
      },
      include: {
        knownSite: {
          select: {
            domain: true,
            category: true
          }
        }
      },
      orderBy: { detectedAt: 'desc' },
      take: 10
    })

    // Calcular estatísticas de violações por nível de risco
    const violationsByRisk = recentViolations.reduce((acc, violation) => {
      acc[violation.riskLevel] = (acc[violation.riskLevel] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const response = {
      sessionId,
      brandProfile: scanSession.brandProfile,
      status: scanSession.status,
      progress: {
        totalSites: scanSession.totalSites,
        sitesScanned: scanSession.sitesScanned,
        violationsFound: scanSession.violationsFound,
        errorCount: scanSession.errorCount,
        percentage: Math.round(progress * 100) / 100,
        currentSite: progressSnapshot?.currentSite || scanSession.currentSite,
        estimatedCompletion: scanSession.estimatedCompletion
      },
      timing: {
        startedAt: scanSession.startedAt,
        elapsedMs: elapsed,
        elapsedFormatted: formatDuration(elapsed),
        averageTimePerSite: Math.round(avgTimePerSite),
        estimatedRemainingMs: estimatedRemaining,
        estimatedRemainingFormatted: formatDuration(estimatedRemaining)
      },
      violations: {
        total: recentViolations.length,
        byRisk: violationsByRisk,
        recent: recentViolations.slice(0, 5).map(v => ({
          id: v.id,
          url: v.url,
          title: v.title,
          riskLevel: v.riskLevel,
          confidence: v.aiConfidence,
          detectedAt: v.detectedAt,
          site: v.knownSite?.domain
        }))
      },
      activity: {
        recent: recentEvents.map(e => ({
          type: e.type,
          timestamp: e.timestamp,
          data: e.data
        })),
        lastError: scanSession.lastError
      },
      performance: {
        sitesPerMinute: avgTimePerSite > 0 ? Math.round((60 * 1000) / avgTimePerSite) : 0,
        successRate: scanSession.sitesScanned > 0 ? 
          Math.round(((scanSession.sitesScanned - scanSession.errorCount) / scanSession.sitesScanned) * 100) : 100,
        violationRate: scanSession.sitesScanned > 0 ?
          Math.round((scanSession.violationsFound / scanSession.sitesScanned) * 100) : 0
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error(`Erro ao obter status da sessão:`, error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * Formatar duração em ms para string legível
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  
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