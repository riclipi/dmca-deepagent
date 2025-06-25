import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog, getClientIP } from '@/lib/audit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/**
 * Schema de validação para operações em lote
 */
const batchOperationSchema = z.object({
  action: z.enum(['DELETE', 'APPROVE_FOR_TAKEDOWN', 'MARK_AS_IGNORED', 'SET_PRIORITY']),
  ids: z.array(z.string().cuid()).min(1).max(100), // Limite de 100 itens por operação
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional()
})

/**
 * POST /api/detected-content/batch
 * Executa operações em lote sobre múltiplos conteúdos detectados
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()

    // Validar dados de entrada
    const validationResult = batchOperationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const { action, ids, priority } = validationResult.data

    // Verificar se todos os conteúdos pertencem ao usuário
    const existingContents = await prisma.detectedContent.findMany({
      where: {
        id: { in: ids },
        userId: session.user.id
      },
      select: {
        id: true,
        title: true,
        platform: true,
        isConfirmed: true
      }
    })

    if (existingContents.length !== ids.length) {
      const foundIds = existingContents.map(c => c.id)
      const missingIds = ids.filter(id => !foundIds.includes(id))
      
      return NextResponse.json(
        { 
          error: 'Alguns conteúdos não foram encontrados ou não pertencem ao usuário',
          missingIds
        },
        { status: 404 }
      )
    }

    let result: any = {
      action,
      processed: 0,
      failed: 0,
      errors: []
    }

    // Executar a ação em transação
    await prisma.$transaction(async (tx) => {
      switch (action) {
        case 'DELETE':
          // Verificar se algum conteúdo tem takedown requests
          const contentsWithTakedowns = await tx.takedownRequest.groupBy({
            by: ['detectedContentId'],
            where: {
              detectedContentId: { in: ids }
            },
            _count: true
          })

          if (contentsWithTakedowns.length > 0) {
            const protectedIds = contentsWithTakedowns.map(c => c.detectedContentId)
            throw new Error(`Não é possível deletar conteúdos com takedown requests: ${protectedIds.join(', ')}`)
          }

          // Deletar todos os conteúdos
          const deleteResult = await tx.detectedContent.deleteMany({
            where: {
              id: { in: ids },
              userId: session.user.id
            }
          })
          result.processed = deleteResult.count
          break

        case 'APPROVE_FOR_TAKEDOWN':
          const approveResult = await tx.detectedContent.updateMany({
            where: {
              id: { in: ids },
              userId: session.user.id
            },
            data: {
              isConfirmed: true,
              confirmedAt: new Date(),
              priority: 'HIGH' // Itens aprovados para takedown têm prioridade alta
            }
          })
          result.processed = approveResult.count
          break

        case 'MARK_AS_IGNORED':
          const ignoreResult = await tx.detectedContent.updateMany({
            where: {
              id: { in: ids },
              userId: session.user.id
            },
            data: {
              isConfirmed: false,
              priority: 'LOW',
              isProcessed: true // Marcar como processado para filtrar
            }
          })
          result.processed = ignoreResult.count
          break

        case 'SET_PRIORITY':
          if (!priority) {
            throw new Error('Prioridade é obrigatória para a ação SET_PRIORITY')
          }
          
          const priorityResult = await tx.detectedContent.updateMany({
            where: {
              id: { in: ids },
              userId: session.user.id
            },
            data: {
              priority
            }
          })
          result.processed = priorityResult.count
          result.priority = priority
          break

        default:
          throw new Error(`Ação não suportada: ${action}`)
      }
    })

    // Log de auditoria para operação em lote
    await createAuditLog(
      session.user.id,
      'detected_content_batch_operation',
      'detected_content',
      { 
        action,
        itemCount: ids.length,
        processedCount: result.processed,
        priority: priority || null,
        contentIds: ids
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json({
      success: true,
      ...result,
      message: `Operação ${action} executada com sucesso em ${result.processed} item(s)`
    })

  } catch (error) {
    console.error('Erro em operação batch:', error)
    
    // Se for erro de negócio (como conteúdo com takedowns), retornar 409
    if (error instanceof Error && error.message.includes('takedown requests')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/detected-content/batch
 * Retorna estatísticas sobre operações em lote disponíveis
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Estatísticas úteis para operações em lote
    const stats = await prisma.detectedContent.groupBy({
      by: ['isConfirmed', 'priority'],
      where: {
        userId: session.user.id
      },
      _count: true
    })

    const summary = {
      total: await prisma.detectedContent.count({
        where: { userId: session.user.id }
      }),
      confirmed: stats
        .filter(s => s.isConfirmed === true)
        .reduce((sum, s) => sum + s._count, 0),
      pending: stats
        .filter(s => s.isConfirmed === false)
        .reduce((sum, s) => sum + s._count, 0),
      byPriority: {
        low: stats
          .filter(s => s.priority === 'LOW')
          .reduce((sum, s) => sum + s._count, 0),
        medium: stats
          .filter(s => s.priority === 'MEDIUM')
          .reduce((sum, s) => sum + s._count, 0),
        high: stats
          .filter(s => s.priority === 'HIGH')
          .reduce((sum, s) => sum + s._count, 0),
        urgent: stats
          .filter(s => s.priority === 'URGENT')
          .reduce((sum, s) => sum + s._count, 0)
      },
      availableActions: [
        {
          action: 'DELETE',
          description: 'Remove conteúdos selecionados (apenas sem takedown requests)',
          maxItems: 100
        },
        {
          action: 'APPROVE_FOR_TAKEDOWN',
          description: 'Aprova conteúdos para remoção DMCA (marca como confirmado e prioridade alta)',
          maxItems: 100
        },
        {
          action: 'MARK_AS_IGNORED',
          description: 'Marca conteúdos como ignorados (baixa prioridade e processado)',
          maxItems: 100
        },
        {
          action: 'SET_PRIORITY',
          description: 'Define prioridade para conteúdos selecionados',
          maxItems: 100,
          requiresParams: ['priority']
        }
      ]
    }

    return NextResponse.json(summary)

  } catch (error) {
    console.error('Erro ao buscar estatísticas batch:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}