import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SessionManager } from '@/lib/agents/session-manager'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()
const sessionManager = new SessionManager()

// Schema para ações de controle
const ControlActionSchema = z.object({
  action: z.enum(['pause', 'resume', 'cancel']),
  reason: z.string().optional()
})

/**
 * POST /api/agents/known-sites/[sessionId]/control
 * Controlar sessão de scan (pausar, retomar, cancelar)
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

    // Validar dados do request
    const body = await request.json()
    const { action, reason } = ControlActionSchema.parse(body)

    // Verificar se a sessão pertence ao usuário
    const scanSession = await prisma.scanSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id
      }
    })

    if (!scanSession) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se a ação é válida para o status atual
    const validTransitions: Record<string, string[]> = {
      'RUNNING': ['pause', 'cancel'],
      'PAUSED': ['resume', 'cancel'],
      'COMPLETED': [],
      'ERROR': []
    }

    const allowedActions = validTransitions[scanSession.status] || []
    if (!allowedActions.includes(action)) {
      return NextResponse.json({
        error: `Ação '${action}' não permitida para sessão com status '${scanSession.status}'`,
        allowedActions
      }, { status: 400 })
    }

    let result: any = {}

    // Executar ação
    switch (action) {
      case 'pause':
        await sessionManager.pauseSession(sessionId)
        result = {
          message: 'Sessão pausada com sucesso',
          newStatus: 'PAUSED'
        }
        break

      case 'resume':
        await sessionManager.resumeSession(sessionId)
        result = {
          message: 'Sessão retomada com sucesso',
          newStatus: 'RUNNING'
        }
        break

      case 'cancel':
        await sessionManager.cancelSession(sessionId)
        result = {
          message: 'Sessão cancelada com sucesso',
          newStatus: 'ERROR'
        }
        break
    }

    // Log da ação
    await prisma.agentEvent.create({
      data: {
        type: `session_${action}`,
        sessionId,
        timestamp: new Date(),
        data: {
          userId: session.user.id,
          reason: reason || `Ação '${action}' executada pelo usuário`,
          previousStatus: scanSession.status
        }
      }
    })

    return NextResponse.json({
      success: true,
      sessionId,
      action,
      ...result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error(`Erro ao controlar sessão:`, error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: error.errors
        },
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
 * GET /api/agents/known-sites/[sessionId]/control
 * Obter ações disponíveis para a sessão
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
      select: {
        id: true,
        status: true,
        startedAt: true,
        sitesScanned: true,
        totalSites: true
      }
    })

    if (!scanSession) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Determinar ações disponíveis
    const availableActions: Record<string, any> = {}

    switch (scanSession.status) {
      case 'RUNNING':
        availableActions.pause = {
          label: 'Pausar Varredura',
          description: 'Pausar temporariamente a varredura',
          icon: 'pause',
          variant: 'secondary'
        }
        availableActions.cancel = {
          label: 'Cancelar Varredura',
          description: 'Cancelar e finalizar a varredura',
          icon: 'x',
          variant: 'destructive',
          requiresConfirmation: true
        }
        break

      case 'PAUSED':
        availableActions.resume = {
          label: 'Retomar Varredura',
          description: 'Continuar varredura de onde parou',
          icon: 'play',
          variant: 'default'
        }
        availableActions.cancel = {
          label: 'Cancelar Varredura',
          description: 'Cancelar e finalizar a varredura',
          icon: 'x',
          variant: 'destructive',
          requiresConfirmation: true
        }
        break

      case 'COMPLETED':
        // Nenhuma ação disponível para sessões completas
        break

      case 'ERROR':
        // Nenhuma ação disponível para sessões com erro
        break
    }

    // Calcular estatísticas da sessão
    const elapsed = Date.now() - scanSession.startedAt.getTime()
    const progress = scanSession.totalSites > 0 ? 
      (scanSession.sitesScanned / scanSession.totalSites) * 100 : 0

    return NextResponse.json({
      sessionId,
      currentStatus: scanSession.status,
      availableActions,
      sessionInfo: {
        progress: Math.round(progress * 100) / 100,
        elapsedTime: elapsed,
        sitesScanned: scanSession.sitesScanned,
        totalSites: scanSession.totalSites
      },
      controlOptions: {
        canPause: scanSession.status === 'RUNNING',
        canResume: scanSession.status === 'PAUSED',
        canCancel: ['RUNNING', 'PAUSED'].includes(scanSession.status),
        isActive: ['RUNNING', 'PAUSED'].includes(scanSession.status)
      }
    })

  } catch (error) {
    console.error(`Erro ao obter controles da sessão:`, error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}