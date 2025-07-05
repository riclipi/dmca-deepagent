import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { KnownSitesAgent } from '@/lib/agents/KnownSitesAgent'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { fairQueueManager } from '@/lib/services/security/fair-queue-manager'

const prisma = new PrismaClient()

// Schema para validação do request
const ScanRequestSchema = z.object({
  brandProfileId: z.string().uuid('ID do perfil da marca inválido'),
  options: z.object({
    respectRobots: z.boolean().default(true),
    maxConcurrency: z.number().min(1).max(10).default(3),
    timeout: z.number().min(5000).max(60000).default(30000),
    screenshotViolations: z.boolean().default(true),
    skipRecentlyScanned: z.boolean().default(true),
    recentThreshold: z.number().min(1).max(168).default(24) // horas
  }).optional().default({})
})

/**
 * POST /api/agents/known-sites/scan
 * Iniciar varredura dos sites conhecidos
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validar dados do request
    const body = await request.json()
    const validatedData = ScanRequestSchema.parse(body)

    // Verificar se o perfil da marca pertence ao usuário
    const brandProfile = await prisma.brandProfile.findFirst({
      where: {
        id: validatedData.brandProfileId,
        userId: session.user.id
      }
    })

    if (!brandProfile) {
      return NextResponse.json(
        { error: 'Perfil da marca não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se já existe uma sessão ativa
    const activeSessions = await prisma.scanSession.findMany({
      where: {
        userId: session.user.id,
        brandProfileId: validatedData.brandProfileId,
        status: { in: ['RUNNING', 'PAUSED'] }
      }
    })

    if (activeSessions.length > 0) {
      return NextResponse.json({
        error: 'Já existe uma sessão ativa para este perfil',
        activeSessionId: activeSessions[0].id
      }, { status: 409 })
    }

    // Obter o plano do usuário
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { planType: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Buscar todos os sites conhecidos para passar à fila
    const knownSites = await prisma.knownSite.findMany({
      where: { isActive: true },
      select: { id: true }
    })

    // Enfileirar ou processar através do Fair Queue Manager
    const queueResponse = await fairQueueManager.enqueueScan({
      userId: session.user.id,
      userPlan: user.planType,
      siteIds: knownSites.map(site => site.id),
      metadata: {
        brandProfileId: validatedData.brandProfileId,
        options: validatedData.options
      }
    })

    return NextResponse.json({
      success: true,
      ...queueResponse,
      message: queueResponse.status === 'QUEUED' 
        ? `Varredura enfileirada. Posição na fila: ${queueResponse.position}`
        : 'Varredura iniciada com sucesso',
      estimatedDuration: '15-30 minutos',
      brandProfile: {
        id: brandProfile.id,
        name: brandProfile.brandName
      }
    })

  } catch (error) {
    console.error('Erro ao iniciar scan:', error)

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
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/agents/known-sites/scan
 * Listar sessões de scan do usuário
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const brandProfileId = searchParams.get('brandProfileId')

    // Construir filtros
    const where: any = { userId: session.user.id }
    if (status) {
      where.status = status.toUpperCase()
    }
    if (brandProfileId) {
      where.brandProfileId = brandProfileId
    }

    // Buscar sessões
    const sessions = await prisma.scanSession.findMany({
      where,
      include: {
        brandProfile: {
          select: {
            id: true,
            brandName: true
          }
        }
      },
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 50)
    })

    // Buscar estatísticas rápidas
    const stats = await prisma.scanSession.aggregate({
      where: { userId: session.user.id },
      _count: {
        id: true
      },
      _sum: {
        violationsFound: true,
        sitesScanned: true
      }
    })

    return NextResponse.json({
      sessions: sessions.map(s => ({
        sessionId: s.id,
        brandProfile: s.brandProfile,
        status: s.status,
        totalSites: s.totalSites,
        sitesScanned: s.sitesScanned,
        violationsFound: s.violationsFound,
        errorCount: s.errorCount,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        estimatedCompletion: s.estimatedCompletion,
        currentSite: s.currentSite,
        progress: s.totalSites > 0 ? (s.sitesScanned / s.totalSites) * 100 : 0
      })),
      stats: {
        totalSessions: stats._count.id || 0,
        totalViolations: stats._sum.violationsFound || 0,
        totalSitesScanned: stats._sum.sitesScanned || 0
      }
    })

  } catch (error) {
    console.error('Erro ao buscar sessões:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}