// app/api/example-with-api-response/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// Schema de validação
const createItemSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  tags: z.array(z.string()).optional()
})

/**
 * GET - Exemplo de listagem com paginação
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    // Parâmetros de paginação
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''

    // Validar parâmetros
    if (page < 1 || limit < 1 || limit > 100) {
      return ApiResponse.validationError([
        { field: 'page', message: 'Página deve ser maior que 0' },
        { field: 'limit', message: 'Limite deve estar entre 1 e 100' }
      ])
    }

    // Buscar dados (exemplo simulado)
    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {}

    const [items, total] = await Promise.all([
      prisma.brandProfile.findMany({
        where: { userId: session.user.id, ...where },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.brandProfile.count({
        where: { userId: session.user.id, ...where }
      })
    ])

    // Retornar resposta paginada
    return ApiResponse.paginated(
      items,
      total,
      page,
      limit,
      { search: search || undefined }
    )

  } catch (error) {
    return ApiResponse.serverError(error)
  }
}

/**
 * POST - Exemplo de criação com validação
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    // Verificar permissões (exemplo)
    if (session.user.planType === 'FREE') {
      const count = await prisma.brandProfile.count({
        where: { userId: session.user.id }
      })
      
      if (count >= 5) {
        return ApiResponse.forbidden(
          'Limite de perfis atingido. Faça upgrade do seu plano.'
        )
      }
    }

    // Validar body
    const body = await request.json()
    let validatedData

    try {
      validatedData = createItemSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ApiResponse.validationError(error)
      }
      throw error
    }

    // Verificar duplicação
    const existing = await prisma.brandProfile.findFirst({
      where: {
        userId: session.user.id,
        brandName: validatedData.name
      }
    })

    if (existing) {
      return ApiResponse.conflict('Já existe um perfil com este nome')
    }

    // Criar recurso
    const created = await prisma.brandProfile.create({
      data: {
        userId: session.user.id,
        brandName: validatedData.name,
        description: validatedData.description,
        keywords: validatedData.tags || [],
        officialUrls: []
      }
    })

    // Retornar resposta de criação
    return ApiResponse.created(created, {
      location: `/api/brand-profiles/${created.id}`
    })

  } catch (error) {
    return ApiResponse.serverError(error)
  }
}

/**
 * PUT - Exemplo de atualização
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return ApiResponse.validationError([
        { field: 'id', message: 'ID é obrigatório' }
      ])
    }

    // Verificar se recurso existe e pertence ao usuário
    const existing = await prisma.brandProfile.findFirst({
      where: { id, userId: session.user.id }
    })

    if (!existing) {
      return ApiResponse.notFound('Perfil de marca')
    }

    // Validar e atualizar
    const body = await request.json()
    const validatedData = createItemSchema.partial().parse(body)

    const updated = await prisma.brandProfile.update({
      where: { id },
      data: {
        brandName: validatedData.name,
        description: validatedData.description,
        keywords: validatedData.tags
      }
    })

    return ApiResponse.success(updated)

  } catch (error) {
    if (error instanceof z.ZodError) {
      return ApiResponse.validationError(error)
    }
    return ApiResponse.serverError(error)
  }
}

/**
 * DELETE - Exemplo de exclusão
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiResponse.unauthorized()
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return ApiResponse.validationError([
        { field: 'id', message: 'ID é obrigatório' }
      ])
    }

    // Verificar se existe
    const existing = await prisma.brandProfile.findFirst({
      where: { id, userId: session.user.id }
    })

    if (!existing) {
      return ApiResponse.notFound('Perfil de marca')
    }

    // Verificar se pode deletar (exemplo: não tem conteúdo detectado)
    const hasContent = await prisma.detectedContent.count({
      where: { brandProfileId: id }
    })

    if (hasContent > 0) {
      return ApiResponse.conflict(
        'Não é possível excluir perfil com conteúdo detectado'
      )
    }

    // Deletar
    await prisma.brandProfile.delete({ where: { id } })

    return ApiResponse.noContent()

  } catch (error) {
    return ApiResponse.serverError(error)
  }
}