import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const platform = searchParams.get('platform')
    const brandProfileId = searchParams.get('brandProfileId')

    const where: any = {
      userId: session.user.id
      // Removido: condição de filtro pelo campo status
    }

    // Substituir o bloco antigo de status:
    // if (status === 'confirmed') {
    //   where.isConfirmed = true
    // } else if (status === 'pending') {
    //   where.isConfirmed = false
    // }

    // Lógica para filtrar por status
    if (status) {
      // Se o status é um dos novos ContentStatus, usar o campo status
      const contentStatuses = ['DETECTED', 'REVIEWED', 'DMCA_SENT', 'PENDING_REVIEW', 'DELISTED', 'REJECTED', 'FALSE_POSITIVE', 'IGNORED']
      if (contentStatuses.includes(status.toUpperCase())) {
        where.status = status.toUpperCase()
      } else if (status === 'confirmed') {
        where.isConfirmed = true
      } else if (status === 'pending') {
        where.isConfirmed = false
      }
    }

    if (platform) {
      where.platform = platform
    }

    if (brandProfileId) {
      where.brandProfileId = brandProfileId
    }

    const [detectedContent, total] = await Promise.all([
      prisma.detectedContent.findMany({
        where,
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
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          _count: {
            select: {
              takedownRequests: true
            }
          }
        },
        orderBy: { detectedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.detectedContent.count({ where })
    ])

    // Mapear infringingUrl para url para compatibilidade com interface
    const mappedContent = detectedContent.map(content => ({
      ...content,
      url: content.infringingUrl, // Mapear para interface
      createdAt: content.detectedAt || content.createdAt, // Compatibilidade de data
      takedownRequest: content.takedownRequests?.[0] || null // Pegar primeiro takedown se existir
    }));

    return NextResponse.json({
      data: mappedContent,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Erro ao buscar conteúdo detectado:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Simular detecção de conteúdo (para demonstração)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { monitoringSessionId, title, infringingUrl, platform, contentType } = body

    // Verificar se a sessão de monitoramento pertence ao usuário
    const monitoringSession = await prisma.monitoringSession.findFirst({
      where: {
        id: monitoringSessionId,
        userId: session.user.id
      }
    })

    if (!monitoringSession) {
      return NextResponse.json(
        { error: 'Sessão de monitoramento não encontrada' },
        { status: 404 }
      )
    }

    const detectedContent = await prisma.detectedContent.create({
      data: {
        userId: session.user.id,
        brandProfileId: monitoringSession.brandProfileId,
        monitoringSessionId,
        title: 'Conteúdo Infrator de Teste',
        infringingUrl,
        platform,
        contentType,
        similarity: Math.random() * 0.3 + 0.7, // Simular similaridade alta
        priority: 'HIGH'
      }
    })

    // Criar notificação
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        title: 'Novo conteúdo infrator detectado',
        message: `Conteúdo "${title}" foi detectado na plataforma ${platform}`,
        type: 'content_detected'
      }
    })

    return NextResponse.json(detectedContent)

  } catch (error) {
    console.error('Erro ao criar conteúdo detectado:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
