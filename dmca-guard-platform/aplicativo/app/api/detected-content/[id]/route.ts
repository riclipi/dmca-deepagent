import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog, getClientIP } from '@/lib/audit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/**
 * Schema de validação para atualização de DetectedContent
 */
const updateDetectedContentSchema = z.object({
  isConfirmed: z.boolean().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  description: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional()
})

/**
 * GET /api/detected-content/[id]
 * Busca um conteúdo detectado específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    
    const detectedContent = await prisma.detectedContent.findFirst({
      where: {
        id: id,
        userId: session.user.id
      },
      include: {
        brandProfile: {
          select: {
            id: true,
            brandName: true
          }
        },
        monitoringSession: {
          select: {
            id: true,
            name: true
          }
        },
        takedownRequests: {
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            takedownRequests: true
          }
        }
      }
    })

    if (!detectedContent) {
      return NextResponse.json(
        { error: 'Conteúdo não encontrado' },
        { status: 404 }
      )
    }

    // Mapear para compatibilidade com interface
    const mappedContent = {
      ...detectedContent,
      url: detectedContent.infringingUrl,
      createdAt: detectedContent.detectedAt || detectedContent.createdAt
    }

    return NextResponse.json(mappedContent)

  } catch (error) {
    console.error('Erro ao buscar conteúdo detectado:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/detected-content/[id]
 * Atualiza campos específicos de um conteúdo detectado
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Validar dados de entrada
    const validationResult = updateDetectedContentSchema.safeParse(body)
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

    // Verificar se o conteúdo existe e pertence ao usuário
    const existingContent = await prisma.detectedContent.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!existingContent) {
      return NextResponse.json(
        { error: 'Conteúdo não encontrado' },
        { status: 404 }
      )
    }

    // Preparar dados para atualização
    const dataToUpdate: any = { ...updateData }
    
    // Se está confirmando o conteúdo, adicionar timestamp
    if (updateData.isConfirmed === true && !existingContent.isConfirmed) {
      dataToUpdate.confirmedAt = new Date()
    }

    // Atualizar o conteúdo
    const updatedContent = await prisma.detectedContent.update({
      where: { id: id },
      data: dataToUpdate,
      include: {
        brandProfile: {
          select: {
            id: true,
            brandName: true
          }
        },
        monitoringSession: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'detected_content_update',
      'detected_content',
      { 
        detectedContentId: id, 
        title: existingContent.title,
        updatedFields: Object.keys(updateData)
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    // Mapear para compatibilidade com interface
    const mappedContent = {
      ...updatedContent,
      url: updatedContent.infringingUrl,
      createdAt: updatedContent.detectedAt || updatedContent.createdAt
    }

    return NextResponse.json(mappedContent)

  } catch (error) {
    console.error('Erro ao atualizar conteúdo detectado:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/detected-content/[id]
 * Remove um conteúdo detectado
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    // Verificar se o conteúdo existe e pertence ao usuário
    const existingContent = await prisma.detectedContent.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!existingContent) {
      return NextResponse.json(
        { error: 'Conteúdo não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se existem takedown requests associados
    const takedownCount = await prisma.takedownRequest.count({
      where: {
        detectedContentId: id
      }
    })

    if (takedownCount > 0) {
      return NextResponse.json(
        { 
          error: 'Não é possível deletar conteúdo com takedown requests associados',
          details: `Existem ${takedownCount} takedown request(s) associados a este conteúdo`
        },
        { status: 409 }
      )
    }

    // Deletar o conteúdo
    await prisma.detectedContent.delete({
      where: { id: id }
    })

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'detected_content_delete',
      'detected_content',
      { 
        detectedContentId: id, 
        title: existingContent.title,
        platform: existingContent.platform
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json({ 
      success: true,
      message: 'Conteúdo deletado com sucesso'
    })

  } catch (error) {
    console.error('Erro ao deletar conteúdo detectado:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}