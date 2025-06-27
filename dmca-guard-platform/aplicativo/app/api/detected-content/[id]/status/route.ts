import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateStatusSchema = z.object({
  status: z.enum(['DETECTED', 'REVIEWED', 'DMCA_SENT', 'PENDING_REVIEW', 'DELISTED', 'REJECTED', 'FALSE_POSITIVE', 'IGNORED']),
  notes: z.string().optional()
})

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
    const { status, notes } = updateStatusSchema.parse(body)

    // Verificar se o conteúdo pertence ao usuário
    const detectedContent = await prisma.detectedContent.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!detectedContent) {
      return NextResponse.json(
        { error: 'Conteúdo não encontrado' },
        { status: 404 }
      )
    }

    // Atualizar o status
    const updatedContent = await prisma.detectedContent.update({
      where: { id: resolvedParams.id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedBy: session.user.id
      },
      include: {
        brandProfile: {
          select: {
            id: true,
            brandName: true
          }
        },
        takedownRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    return NextResponse.json(updatedContent)

  } catch (error: any) {
    console.error('Erro ao atualizar status:', error)
    
    if (error.name === 'ZodError') {
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
