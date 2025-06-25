import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog, getClientIP } from '@/lib/audit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/**
 * Schema de validação para criar/atualizar plano
 */
const planSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  currency: z.string().default('BRL'),
  interval: z.string().default('monthly'),
  features: z.array(z.string()),
  limits: z.object({
    profiles: z.number().min(0),
    takedowns: z.number().min(0),
    scansPerDay: z.number().min(0),
    keywords: z.number().min(0)
  }),
  isActive: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  sortOrder: z.number().default(0)
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
 * GET /api/admin/plans
 * Lista todos os planos (apenas para admins)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id || !await checkAdminAccess(session)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: any = {}
    
    if (!includeInactive) {
      where.isActive = true
    }

    const plans = await prisma.plan.findMany({
      where,
      include: {
        _count: {
          select: {
            subscriptions: {
              where: {
                status: 'ACTIVE'
              }
            }
          }
        }
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    return NextResponse.json({
      data: plans
    })

  } catch (error) {
    console.error('Erro ao buscar planos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/plans
 * Cria novo plano (apenas para admins)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id || !await checkAdminAccess(session)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json()
    
    // Validar dados de entrada
    const validationResult = planSchema.safeParse(body)
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

    // Verificar se já existe plano com o mesmo nome
    const existingPlan = await prisma.plan.findUnique({
      where: { name: data.name }
    })

    if (existingPlan) {
      return NextResponse.json(
        { error: 'Já existe um plano com este nome' },
        { status: 409 }
      )
    }

    // Criar plano
    const plan = await prisma.plan.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        price: data.price,
        currency: data.currency,
        interval: data.interval,
        features: data.features,
        limits: data.limits,
        isActive: data.isActive,
        isPopular: data.isPopular,
        sortOrder: data.sortOrder
      }
    })

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'plan_create',
      'plan',
      { 
        planId: plan.id,
        planName: plan.name,
        price: plan.price
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json(plan, { status: 201 })

  } catch (error) {
    console.error('Erro ao criar plano:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}