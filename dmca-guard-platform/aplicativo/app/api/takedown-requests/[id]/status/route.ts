import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, TakedownStatus } from '@prisma/client'

const prisma = new PrismaClient()

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { status, responseMessage, verificationUrl } = body

    // Validar se o status é válido
    const validStatuses = Object.values(TakedownStatus)
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Status inválido' },
        { status: 400 }
      )
    }

    // Buscar o takedown request existente
    const existingRequest = await prisma.takedownRequest.findUnique({
      where: { id },
      include: {
        detectedContent: {
          include: {
            brandProfile: true
          }
        }
      }
    })

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Solicitação de takedown não encontrada' },
        { status: 404 }
      )
    }

    // Preparar dados de atualização baseado no novo status
    const updateData: any = {
      status,
      updatedAt: new Date()
    }

    // Definir campos específicos baseado no status
    switch (status) {
      case 'ACKNOWLEDGED':
        updateData.acknowledgedAt = new Date()
        break
      case 'REMOVED':
      case 'DELISTED':
      case 'CONTENT_REMOVED':
        updateData.resolvedAt = new Date()
        updateData.acknowledgedAt = updateData.acknowledgedAt || new Date()
        break
      case 'REJECTED':
      case 'FAILED':
        updateData.resolvedAt = new Date()
        break
      case 'IN_REVIEW':
        updateData.acknowledgedAt = updateData.acknowledgedAt || new Date()
        break
    }

    // Adicionar mensagem de resposta se fornecida
    if (responseMessage) {
      updateData.responseMessage = responseMessage
    }

    // Atualizar o takedown request
    const updatedRequest = await prisma.takedownRequest.update({
      where: { id },
      data: updateData,
      include: {
        detectedContent: {
          include: {
            brandProfile: true,
            monitoringSession: true
          }
        }
      }
    })

    // Se foi removido com sucesso, verificar se o conteúdo ainda existe na URL
    if (['REMOVED', 'DELISTED', 'CONTENT_REMOVED'].includes(status) && verificationUrl) {
      // Aqui poderia implementar verificação automática da URL
      // Por enquanto, apenas logamos
      console.log(`Conteúdo marcado como removido: ${verificationUrl}`)
    }

    // Criar notificação para o usuário
    await prisma.notification.create({
      data: {
        userId: existingRequest.userId,
        title: `Status do Takedown Atualizado`,
        message: `O status da solicitação para "${existingRequest.detectedContent.title}" foi atualizado para "${getStatusLabel(status)}"`,
        type: 'takedown_status_update'
      }
    })

    return NextResponse.json({
      success: true,
      takedownRequest: updatedRequest
    })

  } catch (error) {
    console.error('Erro ao atualizar status do takedown:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const takedownRequest = await prisma.takedownRequest.findUnique({
      where: { id },
      include: {
        detectedContent: {
          include: {
            brandProfile: true,
            monitoringSession: true
          }
        }
      }
    })

    if (!takedownRequest) {
      return NextResponse.json(
        { error: 'Solicitação de takedown não encontrada' },
        { status: 404 }
      )
    }

    // Calcular métricas do processo DMCA
    const timeSinceSent = takedownRequest.sentAt 
      ? Date.now() - takedownRequest.sentAt.getTime()
      : null

    const timeToResolution = takedownRequest.resolvedAt && takedownRequest.sentAt
      ? takedownRequest.resolvedAt.getTime() - takedownRequest.sentAt.getTime()
      : null

    const response = {
      takedownRequest,
      metrics: {
        timeSinceSent: timeSinceSent ? Math.floor(timeSinceSent / (1000 * 60 * 60 * 24)) : null, // dias
        timeToResolution: timeToResolution ? Math.floor(timeToResolution / (1000 * 60 * 60 * 24)) : null, // dias
        isOverdue: timeSinceSent ? timeSinceSent > (7 * 24 * 60 * 60 * 1000) : false, // > 7 dias
        statusHistory: await getStatusHistory(id)
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Erro ao buscar status do takedown:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

function getStatusLabel(status: string): string {
  const statusLabels: Record<string, string> = {
    'PENDING': 'Pendente',
    'SENT': 'Enviado',
    'ACKNOWLEDGED': 'Reconhecido',
    'REMOVED': 'Removido',
    'REJECTED': 'Rejeitado',
    'FAILED': 'Falhou',
    'DELISTED': 'Delisted',
    'CONTENT_REMOVED': 'Conteúdo Removido',
    'IN_REVIEW': 'Em Revisão'
  }
  return statusLabels[status] || status
}

async function getStatusHistory(takedownId: string) {
  // Buscar logs de auditoria relacionados a este takedown
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: 'UPDATE_TAKEDOWN_STATUS',
      resource: takedownId
    },
    orderBy: {
      timestamp: 'asc'
    },
    take: 10
  })

  return auditLogs.map(log => ({
    status: log.details?.status,
    timestamp: log.timestamp,
    notes: log.details?.notes
  }))
}
