import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog, getClientIP } from '@/lib/audit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/**
 * Schema de validação para atualizar assinatura
 */
const updateSubscriptionSchema = z.object({
  status: z.enum(['ACTIVE', 'CANCELLED', 'EXPIRED', 'TRIAL', 'PAST_DUE', 'SUSPENDED']).optional(),
  endDate: z.string().transform(str => new Date(str)).optional(),
  amount: z.number().positive().optional(),
  paymentMethod: z.string().optional(),
  cancelReason: z.string().optional()
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
 * GET /api/admin/subscriptions/[id]
 * Busca assinatura específica (apenas para admins)
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

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            planType: true,
            status: true,
            createdAt: true
          }
        },
        plan: {
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
            price: true,
            currency: true,
            interval: true,
            features: true,
            limits: true
          }
        }
      }
    })

    if (!subscription) {
      return NextResponse.json(
        { error: 'Assinatura não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(subscription)

  } catch (error) {
    console.error('Erro ao buscar assinatura:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/subscriptions/[id]
 * Atualiza assinatura (apenas para admins)
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
    const validationResult = updateSubscriptionSchema.safeParse(body)
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

    // Verificar se a assinatura existe
    const existingSubscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        user: true,
        plan: true
      }
    })

    if (!existingSubscription) {
      return NextResponse.json(
        { error: 'Assinatura não encontrada' },
        { status: 404 }
      )
    }

    // Preparar dados para atualização
    const dataToUpdate: any = { ...updateData }

    // Se está cancelando, adicionar timestamp
    if (updateData.status === 'CANCELLED' && existingSubscription.status !== 'CANCELLED') {
      dataToUpdate.cancelledAt = new Date()
    }

    // Atualizar assinatura
    const updatedSubscription = await prisma.subscription.update({
      where: { id },
      data: dataToUpdate,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        plan: {
          select: {
            id: true,
            name: true,
            displayName: true,
            price: true,
            currency: true
          }
        }
      }
    })

    // Atualizar planType do usuário se necessário
    if (updateData.status === 'ACTIVE' && existingSubscription.status !== 'ACTIVE') {
      await prisma.user.update({
        where: { id: existingSubscription.userId },
        data: { 
          planType: existingSubscription.plan.name as any,
          planExpiresAt: updateData.endDate || existingSubscription.endDate
        }
      })
    } else if (updateData.status === 'CANCELLED' || updateData.status === 'EXPIRED') {
      await prisma.user.update({
        where: { id: existingSubscription.userId },
        data: { 
          planType: 'FREE',
          planExpiresAt: null
        }
      })
    }

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'subscription_update',
      'subscription',
      { 
        subscriptionId: id,
        userId: existingSubscription.userId,
        updatedFields: Object.keys(updateData),
        oldStatus: existingSubscription.status,
        newStatus: updateData.status
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json(updatedSubscription)

  } catch (error) {
    console.error('Erro ao atualizar assinatura:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/subscriptions/[id]
 * Cancela assinatura (apenas para admins)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!await checkAdminAccess(session)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params

    // Verificar se a assinatura existe
    const existingSubscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        user: true,
        plan: true
      }
    })

    if (!existingSubscription) {
      return NextResponse.json(
        { error: 'Assinatura não encontrada' },
        { status: 404 }
      )
    }

    // Cancelar assinatura (soft delete)
    const cancelledSubscription = await prisma.subscription.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Cancelado pelo administrador'
      }
    })

    // Atualizar usuário para plano FREE
    await prisma.user.update({
      where: { id: existingSubscription.userId },
      data: { 
        planType: 'FREE',
        planExpiresAt: null
      }
    })

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'subscription_cancel',
      'subscription',
      { 
        subscriptionId: id,
        userId: existingSubscription.userId,
        planName: existingSubscription.plan.name,
        reason: 'Admin cancellation'
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Assinatura cancelada com sucesso',
      subscription: cancelledSubscription
    })

  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}