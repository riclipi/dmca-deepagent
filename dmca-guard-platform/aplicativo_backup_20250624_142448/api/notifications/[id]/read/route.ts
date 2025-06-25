import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

    const notification = await prisma.notification.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!notification) {
      return NextResponse.json(
        { error: 'Notificação não encontrada' },
        { status: 404 }
      )
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: params.id },
      data: {
        isRead: true,
        readAt: new Date()
      }
    })

    return NextResponse.json(updatedNotification)

  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
