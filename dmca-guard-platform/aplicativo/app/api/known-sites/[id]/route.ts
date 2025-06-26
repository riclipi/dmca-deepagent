import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient, SiteCategory } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

// Schema para atualização de site
const UpdateKnownSiteSchema = z.object({
  category: z.nativeEnum(SiteCategory).optional(),
  platform: z.string().optional(),
  riskScore: z.number().min(0).max(100).optional(),
  crawlDelay: z.number().min(100).max(10000).optional(),
  isActive: z.boolean().optional(),
  totalViolations: z.number().min(0).optional(),
  blockedByRobots: z.boolean().optional(),
  lastCrawlSuccess: z.boolean().optional()
})

/**
 * GET /api/known-sites/[id]
 * Obter detalhes de um site específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const site = await prisma.knownSite.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      },
      include: {
        violationHistory: {
          orderBy: { detectedAt: 'desc' },
          take: 50, // Últimas 50 violações
          include: {
            knownSite: {
              select: {
                baseUrl: true,
                domain: true
              }
            }
          }
        },
        _count: {
          select: {
            violationHistory: true
          }
        }
      }
    })

    if (!site) {
      return NextResponse.json(
        { error: 'Site não encontrado' },
        { status: 404 }
      )
    }

    // Calcular estatísticas das violações
    const violationStats = await prisma.violationHistory.aggregate({
      where: {
        knownSiteId: resolvedParams.id
      },
      _count: {
        id: true
      },
      _avg: {
        aiConfidence: true
      }
    })

    const violationsByRisk = await prisma.violationHistory.groupBy({
      by: ['riskLevel'],
      where: {
        knownSiteId: resolvedParams.id
      },
      _count: {
        id: true
      }
    })

    const violationsByMethod = await prisma.violationHistory.groupBy({
      by: ['detectionMethod'],
      where: {
        knownSiteId: resolvedParams.id
      },
      _count: {
        id: true
      }
    })

    const recentActivity = await prisma.violationHistory.count({
      where: {
        knownSiteId: resolvedParams.id,
        detectedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 dias
        }
      }
    })

    return NextResponse.json({
      site,
      statistics: {
        totalViolations: violationStats._count.id,
        averageConfidence: violationStats._avg.aiConfidence || 0,
        recentActivity,
        violationsByRisk: violationsByRisk.reduce((acc, item) => {
          acc[item.riskLevel] = item._count.id
          return acc
        }, {} as Record<string, number>),
        violationsByMethod: violationsByMethod.reduce((acc, item) => {
          acc[item.detectionMethod] = item._count.id
          return acc
        }, {} as Record<string, number>)
      }
    })

  } catch (error) {
    console.error('Erro ao buscar site:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/known-sites/[id]
 * Atualizar site conhecido
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = UpdateKnownSiteSchema.parse(body)

    // Verificar se o site existe e pertence ao usuário
    const existingSite = await prisma.knownSite.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!existingSite) {
      return NextResponse.json(
        { error: 'Site não encontrado' },
        { status: 404 }
      )
    }

    // Atualizar site
    const updatedSite = await prisma.knownSite.update({
      where: { id: resolvedParams.id },
      data: {
        ...validatedData,
        updatedAt: new Date()
      },
      include: {
        _count: {
          select: {
            violationHistory: true
          }
        }
      }
    })

    return NextResponse.json(updatedSite)

  } catch (error) {
    console.error('Erro ao atualizar site:', error)
    
    if (error instanceof z.ZodError) {
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

/**
 * DELETE /api/known-sites/[id]
 * Deletar site conhecido
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se o site existe e pertence ao usuário
    const existingSite = await prisma.knownSite.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      },
      include: {
        _count: {
          select: {
            violationHistory: true
          }
        }
      }
    })

    if (!existingSite) {
      return NextResponse.json(
        { error: 'Site não encontrado' },
        { status: 404 }
      )
    }

    // Deletar site (cascade irá deletar violationHistory automaticamente)
    await prisma.knownSite.delete({
      where: { id: resolvedParams.id }
    })

    return NextResponse.json({
      message: 'Site deletado com sucesso',
      deletedViolations: existingSite._count.violationHistory
    })

  } catch (error) {
    console.error('Erro ao deletar site:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}