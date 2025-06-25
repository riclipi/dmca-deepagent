import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog, getClientIP } from '@/lib/audit'

export const dynamic = 'force-dynamic'

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
    const monitoringSession = await prisma.monitoringSession.findFirst({
      where: {
        id: resolvedParams.sessionId,
        userId: session.user.id
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
      }
    })

    if (!monitoringSession) {
      return NextResponse.json(
        { error: 'Sessão de monitoramento não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(monitoringSession)

  } catch (error) {
    console.error('Erro ao buscar sessão de monitoramento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

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
    // Verificar se a sessão existe e pertence ao usuário
    const monitoringSession = await prisma.monitoringSession.findFirst({
      where: {
        id: resolvedParams.sessionId,
        userId: session.user.id
      },
      include: {
        brandProfile: {
          select: {
            brandName: true
          }
        }
      }
    })

    if (!monitoringSession) {
      return NextResponse.json(
        { error: 'Sessão de monitoramento não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se a sessão está em execução
    if (monitoringSession.status === 'RUNNING') {
      return NextResponse.json(
        { error: 'Não é possível deletar uma sessão em execução. Pause-a primeiro.' },
        { status: 400 }
      )
    }

    // Deletar a sessão (cascade vai deletar detected content relacionado)
    await prisma.monitoringSession.delete({
      where: { id: resolvedParams.sessionId }
    })

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'monitoring_session_delete',
      'monitoring_session',
      { 
        monitoringSessionId: resolvedParams.sessionId,
        name: monitoringSession.name,
        brandProfile: monitoringSession.brandProfile.brandName
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json({ 
      message: 'Sessão de monitoramento deletada com sucesso',
      sessionName: monitoringSession.name
    })

  } catch (error) {
    console.error('Erro ao deletar sessão de monitoramento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const resolvedParams = await params
    const body = await request.json()
    const { name, description, targetPlatforms, customKeywords, excludeKeywords, scanFrequency, isActive } = body

    // Verificar se a sessão existe e pertence ao usuário
    const monitoringSession = await prisma.monitoringSession.findFirst({
      where: {
        id: resolvedParams.sessionId,
        userId: session.user.id
      }
    })

    if (!monitoringSession) {
      return NextResponse.json(
        { error: 'Sessão de monitoramento não encontrada' },
        { status: 404 }
      )
    }

    // Atualizar a sessão
    const updatedSession = await prisma.monitoringSession.update({
      where: { id: resolvedParams.sessionId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(targetPlatforms && { targetPlatforms }),
        ...(customKeywords && { customKeywords }),
        ...(excludeKeywords && { excludeKeywords }),
        ...(scanFrequency && { scanFrequency }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date()
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
      'monitoring_session_update',
      'monitoring_session',
      { 
        monitoringSessionId: resolvedParams.sessionId,
        changes: { name, description, targetPlatforms, customKeywords, excludeKeywords, scanFrequency, isActive }
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json(updatedSession)

  } catch (error) {
    console.error('Erro ao atualizar sessão de monitoramento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
