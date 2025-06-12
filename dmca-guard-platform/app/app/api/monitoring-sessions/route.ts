
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { monitoringSessionSchema } from '@/lib/validations'
import { createAuditLog, getClientIP } from '@/lib/audit'
import { canPerformAction, getPlanLimits } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const monitoringSessions = await prisma.monitoringSession.findMany({
      where: {
        userId: session.user.id,
        isActive: true
      },
      include: {
        brandProfile: {
          select: {
            id: true,
            brandName: true
          }
        },
        _count: {
          select: {
            detectedContent: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(monitoringSessions)

  } catch (error) {
    console.error('Erro ao buscar sessões de monitoramento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = monitoringSessionSchema.parse(body)

    // Verificar se o brand profile pertence ao usuário
    const brandProfile = await prisma.brandProfile.findFirst({
      where: {
        id: validatedData.brandProfileId,
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

    // Verificar limites do plano
    const currentCount = await prisma.monitoringSession.count({
      where: {
        userId: session.user.id,
        isActive: true
      }
    })

    if (!canPerformAction(session.user.planType, 'createMonitoringSession', currentCount)) {
      const limits = getPlanLimits(session.user.planType)
      return NextResponse.json(
        { 
          error: `Limite de sessões de monitoramento atingido (${limits.monitoringSessions}). Faça upgrade do seu plano.` 
        },
        { status: 403 }
      )
    }

    // Verificar frequência de scan baseada no plano
    const planLimits = getPlanLimits(session.user.planType)
    if (validatedData.scanFrequency < planLimits.scanFrequency) {
      return NextResponse.json(
        { 
          error: `Frequência de scan muito alta para seu plano. Mínimo: ${planLimits.scanFrequency} horas.` 
        },
        { status: 403 }
      )
    }

    const monitoringSession = await prisma.monitoringSession.create({
      data: {
        userId: session.user.id,
        brandProfileId: validatedData.brandProfileId,
        name: validatedData.name,
        description: validatedData.description,
        targetPlatforms: validatedData.targetPlatforms,
        searchTerms: validatedData.searchTerms,
        scanFrequency: validatedData.scanFrequency,
        nextScanAt: new Date(Date.now() + validatedData.scanFrequency * 60 * 60 * 1000)
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

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'monitoring_session_create',
      'monitoring_session',
      { 
        monitoringSessionId: monitoringSession.id, 
        name: monitoringSession.name,
        brandProfileId: validatedData.brandProfileId
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json(monitoringSession)

  } catch (error: any) {
    console.error('Erro ao criar sessão de monitoramento:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
