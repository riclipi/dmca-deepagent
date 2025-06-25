import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog, getClientIP } from '@/lib/audit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/**
 * @swagger
 * /api/admin/subscriptions:
 *   get:
 *     summary: List all subscriptions (Admin only)
 *     description: Retrieve a paginated list of subscriptions with filtering options
 *     tags:
 *       - Admin - Subscriptions
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, CANCELLED, EXPIRED, TRIAL, PAST_DUE, SUSPENDED]
 *         description: Filter by subscription status
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: planId
 *         schema:
 *           type: string
 *         description: Filter by plan ID
 *     responses:
 *       200:
 *         description: List of subscriptions with pagination info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       403:
 *         description: Access denied - Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Create new subscription (Admin only)
 *     description: Create a new subscription for a user
 *     tags:
 *       - Admin - Subscriptions
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - planId
 *               - startDate
 *               - amount
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID to create subscription for
 *               planId:
 *                 type: string
 *                 description: Plan ID for the subscription
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, CANCELLED, EXPIRED, TRIAL, PAST_DUE, SUSPENDED]
 *                 default: ACTIVE
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               amount:
 *                 type: number
 *                 format: decimal
 *               currency:
 *                 type: string
 *                 default: BRL
 *               paymentMethod:
 *                 type: string
 *     responses:
 *       201:
 *         description: Subscription created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 *       400:
 *         description: Invalid data or user already has active subscription
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Access denied - Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User or plan not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: User already has active subscription
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * Schema de validação para criar/atualizar assinatura
 */
const subscriptionSchema = z.object({
  userId: z.string().cuid(),
  planId: z.string().cuid(),
  status: z.enum(['ACTIVE', 'CANCELLED', 'EXPIRED', 'TRIAL', 'PAST_DUE', 'SUSPENDED']).optional(),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)).optional(),
  amount: z.number().positive(),
  currency: z.string().default('BRL'),
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
 * GET /api/admin/subscriptions
 * Lista todas as assinaturas (apenas para admins)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id || !await checkAdminAccess(session)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')
    const planId = searchParams.get('planId')

    const where: any = {}
    
    if (status) {
      where.status = status
    }
    if (userId) {
      where.userId = userId
    }
    if (planId) {
      where.planId = planId
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              planType: true,
              status: true
            }
          },
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
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.subscription.count({ where })
    ])

    return NextResponse.json({
      data: subscriptions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Erro ao buscar assinaturas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/subscriptions
 * Cria nova assinatura (apenas para admins)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id || !await checkAdminAccess(session)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json()
    
    // Validar dados de entrada
    const validationResult = subscriptionSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: data.userId }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o plano existe
    const plan = await prisma.plan.findUnique({
      where: { id: data.planId }
    })
    
    if (!plan) {
      return NextResponse.json(
        { error: 'Plano não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se já existe assinatura ativa para o usuário
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId: data.userId,
        status: 'ACTIVE'
      }
    })

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'Usuário já possui assinatura ativa' },
        { status: 409 }
      )
    }

    // Criar assinatura
    const subscription = await prisma.subscription.create({
      data: {
        userId: data.userId,
        planId: data.planId,
        planType: plan.name as any, // Map to PlanType enum
        status: data.status || 'ACTIVE',
        startDate: data.startDate,
        endDate: data.endDate,
        amount: data.amount,
        currency: data.currency,
        paymentMethod: data.paymentMethod
      },
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

    // Atualizar planType do usuário se a assinatura estiver ativa
    if (subscription.status === 'ACTIVE') {
      await prisma.user.update({
        where: { id: data.userId },
        data: { 
          planType: plan.name as any,
          planExpiresAt: data.endDate
        }
      })
    }

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'subscription_create',
      'subscription',
      { 
        subscriptionId: subscription.id,
        userId: data.userId,
        planId: data.planId,
        amount: data.amount
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json(subscription, { status: 201 })

  } catch (error) {
    console.error('Erro ao criar assinatura:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}