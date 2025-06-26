import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient, SiteCategory } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

// Schema de validação para criação de site
const CreateKnownSiteSchema = z.object({
  baseUrl: z.string().url('URL inválida'),
  category: z.nativeEnum(SiteCategory),
  platform: z.string().optional(),
  riskScore: z.number().min(0).max(100).default(50),
  crawlDelay: z.number().min(100).max(10000).default(1000),
  isActive: z.boolean().default(true)
})

// Schema para filtros de busca
const SearchFiltersSchema = z.object({
  category: z.nativeEnum(SiteCategory).optional(),
  platform: z.string().optional(),
  isActive: z.boolean().optional(),
  riskScoreMin: z.number().min(0).max(100).optional(),
  riskScoreMax: z.number().min(0).max(100).optional(),
  domain: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['createdAt', 'lastChecked', 'riskScore', 'totalViolations', 'domain']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

/**
 * GET /api/known-sites
 * Listar sites conhecidos com filtros
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filters = SearchFiltersSchema.parse({
      category: searchParams.get('category') || undefined,
      platform: searchParams.get('platform') || undefined,
      isActive: searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined,
      riskScoreMin: searchParams.get('riskScoreMin') ? Number(searchParams.get('riskScoreMin')) : undefined,
      riskScoreMax: searchParams.get('riskScoreMax') ? Number(searchParams.get('riskScoreMax')) : undefined,
      domain: searchParams.get('domain') || undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
      sortBy: searchParams.get('sortBy') as any || 'createdAt',
      sortOrder: searchParams.get('sortOrder') as any || 'desc'
    })

    // Construir where clause
    const where: any = {
      userId: session.user.id
    }

    if (filters.category) where.category = filters.category
    if (filters.platform) where.platform = filters.platform
    if (filters.isActive !== undefined) where.isActive = filters.isActive
    if (filters.domain) {
      where.domain = {
        contains: filters.domain,
        mode: 'insensitive'
      }
    }
    if (filters.riskScoreMin !== undefined || filters.riskScoreMax !== undefined) {
      where.riskScore = {}
      if (filters.riskScoreMin !== undefined) where.riskScore.gte = filters.riskScoreMin
      if (filters.riskScoreMax !== undefined) where.riskScore.lte = filters.riskScoreMax
    }

    // Executar queries
    const [sites, total] = await Promise.all([
      prisma.knownSite.findMany({
        where,
        orderBy: { [filters.sortBy]: filters.sortOrder },
        skip: filters.offset,
        take: filters.limit,
        include: {
          violationHistory: {
            select: {
              id: true,
              detectedAt: true,
              riskLevel: true,
              resolved: true
            },
            orderBy: { detectedAt: 'desc' },
            take: 5
          },
          _count: {
            select: {
              violationHistory: true
            }
          }
        }
      }),
      prisma.knownSite.count({ where })
    ])

    // Calcular estatísticas agregadas
    const stats = await prisma.knownSite.aggregate({
      where,
      _avg: { riskScore: true, totalViolations: true },
      _sum: { totalViolations: true },
      _count: { id: true }
    })

    return NextResponse.json({
      sites,
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + filters.limit < total
      },
      stats: {
        averageRiskScore: Math.round(stats._avg.riskScore || 0),
        averageViolations: Math.round(stats._avg.totalViolations || 0),
        totalViolations: stats._sum.totalViolations || 0,
        totalSites: stats._count.id
      }
    })

  } catch (error) {
    console.error('Erro ao listar sites conhecidos:', error)
    
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
 * POST /api/known-sites
 * Criar novo site conhecido
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = CreateKnownSiteSchema.parse(body)

    // Extrair domínio da URL
    const url = new URL(validatedData.baseUrl)
    const domain = url.hostname

    // Verificar se já existe
    const existing = await prisma.knownSite.findFirst({
      where: {
        baseUrl: validatedData.baseUrl,
        userId: session.user.id
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Site já existe na base de dados' },
        { status: 409 }
      )
    }

    // Criar site
    const newSite = await prisma.knownSite.create({
      data: {
        ...validatedData,
        domain,
        robotsTxtUrl: `${validatedData.baseUrl}/robots.txt`,
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

    return NextResponse.json(newSite, { status: 201 })

  } catch (error) {
    console.error('Erro ao criar site conhecido:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Site já existe' },
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
 * DELETE /api/known-sites
 * Deletar múltiplos sites (bulk delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    
    if (!idsParam) {
      return NextResponse.json(
        { error: 'IDs dos sites são obrigatórios' },
        { status: 400 }
      )
    }

    const ids = idsParam.split(',').filter(Boolean)
    
    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Pelo menos um ID deve ser fornecido' },
        { status: 400 }
      )
    }

    // Verificar se todos os sites pertencem ao usuário
    const sites = await prisma.knownSite.findMany({
      where: {
        id: { in: ids },
        userId: session.user.id
      },
      select: { id: true }
    })

    if (sites.length !== ids.length) {
      return NextResponse.json(
        { error: 'Alguns sites não foram encontrados ou não pertencem ao usuário' },
        { status: 404 }
      )
    }

    // Deletar sites e histórico relacionado
    const deletedCount = await prisma.knownSite.deleteMany({
      where: {
        id: { in: ids },
        userId: session.user.id
      }
    })

    return NextResponse.json({
      message: `${deletedCount.count} sites deletados com sucesso`,
      deletedCount: deletedCount.count
    })

  } catch (error) {
    console.error('Erro ao deletar sites:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}