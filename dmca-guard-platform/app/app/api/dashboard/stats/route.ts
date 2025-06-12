
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

    const userId = session.user.id

    // Buscar estatísticas gerais
    const [
      brandProfilesCount,
      monitoringSessionsCount,
      detectedContentCount,
      takedownRequestsCount,
      recentDetectedContent,
      recentTakedowns,
      unreadNotifications
    ] = await Promise.all([
      prisma.brandProfile.count({
        where: { userId, isActive: true }
      }),
      prisma.monitoringSession.count({
        where: { userId, isActive: true }
      }),
      prisma.detectedContent.count({
        where: { userId }
      }),
      prisma.takedownRequest.count({
        where: { userId }
      }),
      prisma.detectedContent.findMany({
        where: { userId },
        orderBy: { detectedAt: 'desc' },
        take: 5,
        include: {
          brandProfile: {
            select: { brandName: true }
          }
        }
      }),
      prisma.takedownRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          detectedContent: {
            select: {
              title: true,
              platform: true
            }
          }
        }
      }),
      prisma.notification.count({
        where: { userId, isRead: false }
      })
    ])

    // Estatísticas por status de takedown
    const takedownsByStatus = await prisma.takedownRequest.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true }
    })

    // Conteúdo detectado por plataforma
    const contentByPlatform = await prisma.detectedContent.groupBy({
      by: ['platform'],
      where: { userId },
      _count: { platform: true }
    })

    // Estatísticas dos últimos 30 dias
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [
      recentDetectedCount,
      recentTakedownsCount
    ] = await Promise.all([
      prisma.detectedContent.count({
        where: {
          userId,
          detectedAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.takedownRequest.count({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo }
        }
      })
    ])

    return NextResponse.json({
      overview: {
        brandProfiles: brandProfilesCount,
        monitoringSessions: monitoringSessionsCount,
        detectedContent: detectedContentCount,
        takedownRequests: takedownRequestsCount,
        unreadNotifications
      },
      recent: {
        detectedContent: recentDetectedContent,
        takedowns: recentTakedowns
      },
      analytics: {
        takedownsByStatus: takedownsByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.status
          return acc
        }, {} as Record<string, number>),
        contentByPlatform: contentByPlatform.reduce((acc, item) => {
          acc[item.platform] = item._count.platform
          return acc
        }, {} as Record<string, number>),
        last30Days: {
          detectedContent: recentDetectedCount,
          takedowns: recentTakedownsCount
        }
      }
    })

  } catch (error) {
    console.error('Erro ao buscar estatísticas do dashboard:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
