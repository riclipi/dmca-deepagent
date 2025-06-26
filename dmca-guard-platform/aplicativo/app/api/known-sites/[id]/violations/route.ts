import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient, DetectionMethod, RiskLevel } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

// Schema para filtros de violações
const ViolationFiltersSchema = z.object({
  riskLevel: z.nativeEnum(RiskLevel).optional(),
  detectionMethod: z.nativeEnum(DetectionMethod).optional(),
  resolved: z.boolean().optional(),
  takedownSent: z.boolean().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['detectedAt', 'aiConfidence', 'riskLevel']).default('detectedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

// Schema para criação de violação
const CreateViolationSchema = z.object({
  url: z.string().url('URL inválida'),
  title: z.string().optional(),
  description: z.string().optional(),
  detectionMethod: z.nativeEnum(DetectionMethod),
  riskLevel: z.nativeEnum(RiskLevel),
  aiConfidence: z.number().min(0).max(1).optional(),
  takedownSent: z.boolean().default(false),
  resolved: z.boolean().default(false)
})

/**
 * GET /api/known-sites/[id]/violations
 * Listar violações de um site específico
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

    // Verificar se o site pertence ao usuário
    const site = await prisma.knownSite.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      },
      select: { id: true, baseUrl: true, domain: true }
    })

    if (!site) {
      return NextResponse.json(
        { error: 'Site não encontrado' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const filters = ViolationFiltersSchema.parse({
      riskLevel: searchParams.get('riskLevel') || undefined,
      detectionMethod: searchParams.get('detectionMethod') || undefined,
      resolved: searchParams.get('resolved') ? searchParams.get('resolved') === 'true' : undefined,
      takedownSent: searchParams.get('takedownSent') ? searchParams.get('takedownSent') === 'true' : undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
      sortBy: searchParams.get('sortBy') as any || 'detectedAt',
      sortOrder: searchParams.get('sortOrder') as any || 'desc'
    })

    // Construir where clause
    const where: any = {
      knownSiteId: resolvedParams.id
    }

    if (filters.riskLevel) where.riskLevel = filters.riskLevel
    if (filters.detectionMethod) where.detectionMethod = filters.detectionMethod
    if (filters.resolved !== undefined) where.resolved = filters.resolved
    if (filters.takedownSent !== undefined) where.takedownSent = filters.takedownSent

    if (filters.dateFrom || filters.dateTo) {
      where.detectedAt = {}
      if (filters.dateFrom) where.detectedAt.gte = new Date(filters.dateFrom)
      if (filters.dateTo) where.detectedAt.lte = new Date(filters.dateTo)
    }

    // Buscar violações e contagem total
    const [violations, total] = await Promise.all([
      prisma.violationHistory.findMany({
        where,
        orderBy: { [filters.sortBy]: filters.sortOrder },
        skip: filters.offset,
        take: filters.limit,
        include: {
          knownSite: {
            select: {
              baseUrl: true,
              domain: true,
              category: true,
              platform: true
            }
          }
        }
      }),
      prisma.violationHistory.count({ where })
    ])

    // Calcular estatísticas das violações
    const stats = await prisma.violationHistory.aggregate({
      where: { knownSiteId: resolvedParams.id },
      _count: { id: true },
      _avg: { aiConfidence: true }
    })

    const riskBreakdown = await prisma.violationHistory.groupBy({
      by: ['riskLevel'],
      where: { knownSiteId: resolvedParams.id },
      _count: { id: true }
    })

    const methodBreakdown = await prisma.violationHistory.groupBy({
      by: ['detectionMethod'],
      where: { knownSiteId: resolvedParams.id },
      _count: { id: true }
    })

    const resolutionStats = await prisma.violationHistory.aggregate({
      where: { knownSiteId: resolvedParams.id },
      _count: {
        id: true,
        resolvedDate: true,
        takedownDate: true
      }
    })

    return NextResponse.json({
      site,
      violations,
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + filters.limit < total
      },
      statistics: {
        total: stats._count.id,
        averageConfidence: Math.round((stats._avg.aiConfidence || 0) * 100) / 100,
        resolved: resolutionStats._count.resolvedDate || 0,
        takedownsSent: resolutionStats._count.takedownDate || 0,
        pending: stats._count.id - (resolutionStats._count.resolvedDate || 0),
        byRiskLevel: riskBreakdown.reduce((acc, item) => {
          acc[item.riskLevel] = item._count.id
          return acc
        }, {} as Record<string, number>),
        byMethod: methodBreakdown.reduce((acc, item) => {
          acc[item.detectionMethod] = item._count.id
          return acc
        }, {} as Record<string, number>)
      }
    })

  } catch (error) {
    console.error('Erro ao listar violações:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos', details: error.errors },
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
 * POST /api/known-sites/[id]/violations
 * Adicionar nova violação a um site
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se o site pertence ao usuário
    const site = await prisma.knownSite.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!site) {
      return NextResponse.json(
        { error: 'Site não encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validatedData = CreateViolationSchema.parse(body)

    // Criar violação
    const newViolation = await prisma.violationHistory.create({
      data: {
        ...validatedData,
        knownSiteId: resolvedParams.id,
        takedownDate: validatedData.takedownSent ? new Date() : null,
        resolvedDate: validatedData.resolved ? new Date() : null
      },
      include: {
        knownSite: {
          select: {
            baseUrl: true,
            domain: true,
            category: true,
            platform: true
          }
        }
      }
    })

    // Atualizar contadores do site
    const violationCount = await prisma.violationHistory.count({
      where: { knownSiteId: resolvedParams.id }
    })

    await prisma.knownSite.update({
      where: { id: resolvedParams.id },
      data: {
        totalViolations: violationCount,
        lastViolation: newViolation.detectedAt,
        // Ajustar risco baseado na nova violação
        riskScore: Math.min(100, site.riskScore + (validatedData.riskLevel === 'CRITICAL' ? 10 : 5))
      }
    })

    return NextResponse.json(newViolation, { status: 201 })

  } catch (error) {
    console.error('Erro ao criar violação:', error)
    
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
 * PATCH /api/known-sites/[id]/violations
 * Atualizar múltiplas violações (bulk update)
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

    // Verificar se o site pertence ao usuário
    const site = await prisma.knownSite.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!site) {
      return NextResponse.json(
        { error: 'Site não encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { violationIds, updates } = body

    if (!Array.isArray(violationIds) || violationIds.length === 0) {
      return NextResponse.json(
        { error: 'IDs das violações são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se todas as violações pertencem ao site
    const violationsCount = await prisma.violationHistory.count({
      where: {
        id: { in: violationIds },
        knownSiteId: resolvedParams.id
      }
    })

    if (violationsCount !== violationIds.length) {
      return NextResponse.json(
        { error: 'Algumas violações não foram encontradas' },
        { status: 404 }
      )
    }

    // Preparar dados de atualização
    const updateData: any = {}
    
    if (updates.resolved !== undefined) {
      updateData.resolved = updates.resolved
      updateData.resolvedDate = updates.resolved ? new Date() : null
    }
    
    if (updates.takedownSent !== undefined) {
      updateData.takedownSent = updates.takedownSent
      updateData.takedownDate = updates.takedownSent ? new Date() : null
    }

    // Atualizar violações
    const result = await prisma.violationHistory.updateMany({
      where: {
        id: { in: violationIds },
        knownSiteId: resolvedParams.id
      },
      data: updateData
    })

    return NextResponse.json({
      message: `${result.count} violações atualizadas com sucesso`,
      updatedCount: result.count
    })

  } catch (error) {
    console.error('Erro ao atualizar violações:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}