import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DiscoveryAgent } from '@/lib/agents/DiscoveryAgent'
import { SessionManager } from '@/lib/agents/session-manager'

const sessionManager = new SessionManager()

/**
 * GET /api/agents/discovery/[sessionId]
 * Obter status da sessão de descoberta
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

    // Buscar sessão no banco
    const scanSession = await sessionManager.getSession(sessionId)
    
    if (!scanSession || scanSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Calcular progresso
    const progress = scanSession.totalSites > 0 ? 
      (scanSession.sitesScanned / scanSession.totalSites) * 100 : 0

    // Calcular tempo decorrido
    const elapsed = Date.now() - scanSession.startedAt.getTime()
    
    // Estatísticas da sessão
    const response = {
      sessionId,
      status: scanSession.status,
      progress: {
        percentage: Math.round(progress * 100) / 100,
        queriesProcessed: scanSession.sitesScanned,
        totalQueries: scanSession.totalSites,
        newSitesFound: scanSession.violationsFound,
        duplicatesFiltered: 0, // TODO: adicionar ao schema
        currentQuery: scanSession.currentSite
      },
      timing: {
        startedAt: scanSession.startedAt,
        elapsedMs: elapsed,
        elapsedFormatted: formatDuration(elapsed),
        estimatedCompletion: scanSession.estimatedCompletion
      },
      performance: {
        queriesPerMinute: elapsed > 0 ? Math.round((scanSession.sitesScanned / (elapsed / 60000)) * 100) / 100 : 0,
        averageTimePerQuery: scanSession.sitesScanned > 0 ? Math.round(elapsed / scanSession.sitesScanned) : 0,
        successRate: scanSession.sitesScanned > 0 ? 
          Math.round(((scanSession.sitesScanned - scanSession.errorCount) / scanSession.sitesScanned) * 100) : 100
      },
      errors: {
        count: scanSession.errorCount,
        lastError: scanSession.lastError
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error(`Erro ao obter status da sessão ${params}:`, error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/agents/discovery/[sessionId]
 * Controlar sessão de descoberta (pausar/retomar/cancelar)
 */
export async function POST(
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
    const { action } = await request.json()

    // Verificar se a sessão existe e pertence ao usuário
    const scanSession = await sessionManager.getSession(sessionId)
    
    if (!scanSession || scanSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Executar ação
    switch (action) {
      case 'pause':
        await sessionManager.pauseSession(sessionId)
        return NextResponse.json({ 
          success: true, 
          message: 'Sessão pausada com sucesso' 
        })

      case 'resume':
        await sessionManager.resumeSession(sessionId)
        return NextResponse.json({ 
          success: true, 
          message: 'Sessão retomada com sucesso' 
        })

      case 'cancel':
        await sessionManager.cancelSession(sessionId)
        return NextResponse.json({ 
          success: true, 
          message: 'Sessão cancelada com sucesso' 
        })

      default:
        return NextResponse.json(
          { error: 'Ação inválida. Use: pause, resume ou cancel' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error(`Erro ao controlar sessão ${params}:`, error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/agents/discovery/[sessionId]
 * Cancelar e remover sessão de descoberta
 */
export async function DELETE(
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

    // Verificar se a sessão existe e pertence ao usuário
    const scanSession = await sessionManager.getSession(sessionId)
    
    if (!scanSession || scanSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Cancelar sessão
    await sessionManager.cancelSession(sessionId)

    return NextResponse.json({ 
      success: true, 
      message: 'Sessão removida com sucesso' 
    })

  } catch (error) {
    console.error(`Erro ao remover sessão ${params}:`, error)
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
