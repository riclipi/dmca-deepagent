import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users (Admin only)
 *     description: Retrieve a paginated list of users with search and filter capabilities
 *     tags:
 *       - Admin - Users
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name or email
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, SUSPENDED, PENDING_VERIFICATION, DELETED]
 *         description: Filter by user status
 *       - in: query
 *         name: planType
 *         schema:
 *           type: string
 *           enum: [FREE, BASIC, PREMIUM, ENTERPRISE, SUPER_USER]
 *         description: Filter by plan type
 *     responses:
 *       200:
 *         description: List of users with pagination info
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

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
 * GET /api/admin/users
 * Lista usuários com filtros de busca (apenas para admins)
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
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const planType = searchParams.get('planType')

    const where: any = {}
    
    // Busca por nome ou email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    if (status) {
      where.status = status
    }
    
    if (planType) {
      where.planType = planType
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          planType: true,
          planExpiresAt: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          subscriptions: {
            where: {
              status: 'ACTIVE'
            },
            select: {
              id: true,
              status: true,
              startDate: true,
              endDate: true,
              amount: true,
              plan: {
                select: {
                  displayName: true,
                  name: true
                }
              }
            },
            take: 1,
            orderBy: { createdAt: 'desc' }
          },
          _count: {
            select: {
              brandProfiles: true,
              detectedContent: true,
              takedownRequests: true,
              monitoringSessions: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.user.count({ where })
    ])

    // Mapear dados para incluir informações da assinatura ativa
    const usersWithSubscription = users.map(user => ({
      ...user,
      activeSubscription: user.subscriptions[0] || null,
      subscriptions: undefined // Remover array completo para evitar confusão
    }))

    return NextResponse.json({
      data: usersWithSubscription,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Erro ao buscar usuários:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}