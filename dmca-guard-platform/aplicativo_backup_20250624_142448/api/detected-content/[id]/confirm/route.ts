import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog, getClientIP } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const detectedContent = await prisma.detectedContent.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!detectedContent) {
      return NextResponse.json(
        { error: 'Conteúdo não encontrado' },
        { status: 404 }
      )
    }

    const updatedContent = await prisma.detectedContent.update({
      where: { id: params.id },
      data: {
        isConfirmed: true,
        confirmedAt: new Date()
      }
    })

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'detected_content_confirm',
      'detected_content',
      { detectedContentId: params.id, title: detectedContent.title },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json(updatedContent)

  } catch (error) {
    console.error('Erro ao confirmar conteúdo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
