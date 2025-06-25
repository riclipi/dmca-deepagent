import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog, getClientIP } from '@/lib/audit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/**
 * Schema de validação para atualizar usuário
 */
const updateUserSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'DELETED']).optional(),
  planType: z.enum(['FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE', 'SUPER_USER']).optional(),
  planExpiresAt: z.string().transform(str => new Date(str)).optional().nullable()
})

/**
 * Verificar se o usuário é admin
 */
async function checkAdminAccess(session: any) {
  if (!session?.user?.id) {
    return false
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planType: true }
  })

  return user?.planType === 'SUPER_USER'
}

/**
 * GET /api/admin/users/[id]
 * Busca usuário específico com detalhes completos (apenas para admins)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!await checkAdminAccess(session)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                displayName: true,
                price: true,
                currency: true,
                interval: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        brandProfiles: {
          select: {
            id: true,
            brandName: true,
            isActive: true,
            createdAt: true,
            _count: {
              select: {
                detectedContent: true,
                monitoringSessions: true
              }
            }
          }
        },
        _count: {
          select: {
            detectedContent: true,
            takedownRequests: true,
            monitoringSessions: true,
            notifications: true,
            auditLogs: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Calcular estatísticas adicionais
    const [recentActivity, takedownStats] = await Promise.all([
      // Atividade recente (últimos 30 dias)
      prisma.auditLog.findMany({
        where: {
          userId: id,
          timestamp: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        select: {
          action: true,
          timestamp: true,
          resource: true
        },
        orderBy: { timestamp: 'desc' },
        take: 10
      }),
      
      // Estatísticas de takedown
      prisma.takedownRequest.groupBy({
        by: ['status'],
        where: { userId: id },
        _count: true
      })
    ])

    const userWithStats = {
      ...user,
      password: undefined, // Nunca retornar senha
      stats: {
        recentActivity,
        takedownsByStatus: takedownStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count
          return acc
        }, {} as Record<string, number>)
      }
    }

    return NextResponse.json(userWithStats)

  } catch (error) {
    console.error('Erro ao buscar usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Atualiza usuário (apenas para admins)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!await checkAdminAccess(session)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Validar dados de entrada
    const validationResult = updateUserSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    // Verificar se o usuário existe
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Impedir que o admin altere seu próprio status ou planType
    if (id === session.user.id) {
      if (updateData.status && updateData.status !== existingUser.status) {
        return NextResponse.json(
          { error: 'Você não pode alterar seu próprio status' },
          { status: 400 }
        )
      }
      if (updateData.planType && updateData.planType !== existingUser.planType) {
        return NextResponse.json(
          { error: 'Você não pode alterar seu próprio tipo de plano' },
          { status: 400 }
        )
      }
    }

    // Atualizar usuário
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        planType: true,
        planExpiresAt: true,
        updatedAt: true
      }
    })

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'user_update_admin',
      'user',
      { 
        targetUserId: id,
        updatedFields: Object.keys(updateData),
        oldStatus: existingUser.status,
        newStatus: updateData.status,
        oldPlanType: existingUser.planType,
        newPlanType: updateData.planType
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json(updatedUser)

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}