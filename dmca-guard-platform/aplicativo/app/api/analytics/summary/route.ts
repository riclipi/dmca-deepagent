import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/summary
 * Retorna resumo de analytics para o usuário atual
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Calcular data de 30 dias atrás
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Executar queries em paralelo para melhor performance
    const [
      totalDetectedContent,
      detectedContentLast30Days,
      totalTakedownRequests,
      takedownsByStatus,
      successfulTakedowns,
      activeBrandProfiles,
      activeMonitoringSessions,
      recentNotifications
    ] = await Promise.all([
      // Total de conteúdo detectado
      prisma.detectedContent.count({
        where: { userId: session.user.id }
      }),

      // Conteúdo detectado nos últimos 30 dias
      prisma.detectedContent.count({
        where: {
          userId: session.user.id,
          detectedAt: { gte: thirtyDaysAgo }
        }
      }),

      // Total de takedown requests
      prisma.takedownRequest.count({
        where: { userId: session.user.id }
      }),

      // Takedowns agrupados por status
      prisma.takedownRequest.groupBy({
        by: ['status'],
        where: { userId: session.user.id },
        _count: true
      }),

      // Takedowns bem-sucedidos (REMOVED)
      prisma.takedownRequest.count({
        where: {
          userId: session.user.id,
          status: 'REMOVED'
        }
      }),

      // Perfis de marca ativos
      prisma.brandProfile.count({
        where: {
          userId: session.user.id,
          isActive: true
        }
      }),

      // Sessões de monitoramento ativas
      prisma.monitoringSession.count({
        where: {
          userId: session.user.id,
          isActive: true
        }
      }),

      // Notificações não lidas
      prisma.notification.count({
        where: {
          userId: session.user.id,
          isRead: false
        }
      })
    ])

    // Calcular taxa de sucesso
    const successRate = totalTakedownRequests > 0 
      ? Math.round((successfulTakedowns / totalTakedownRequests) * 100)
      : 0

    // Mapear status para português
    const statusMap: Record<string, string> = {
      'PENDING': 'Pendente',
      'SENT': 'Enviado',
      'ACKNOWLEDGED': 'Confirmado',
      'REMOVED': 'Removido',
      'REJECTED': 'Rejeitado',
      'FAILED': 'Falhou'
    }

    const takedownsByStatusFormatted = takedownsByStatus.reduce((acc, item) => {
      const translatedStatus = statusMap[item.status] || item.status
      acc[translatedStatus] = item._count
      return acc
    }, {} as Record<string, number>)

    // Calcular eficácia (baseada na cobertura e taxa de sucesso)
    const coverage = detectedContentLast30Days
    const effectiveness = Math.round((successRate + Math.min(coverage / 10, 100)) / 2)

    const analytics = {
      // Métricas principais
      successRate,
      coverage: detectedContentLast30Days,
      takedownsSent: totalTakedownRequests,
      
      // Métricas detalhadas
      totalDetectedContent,
      detectedContentLast30Days,
      successfulTakedowns,
      activeBrandProfiles,
      activeMonitoringSessions,
      recentNotifications,
      
      // Distribuição por status
      takedownsByStatus: takedownsByStatusFormatted,
      
      // Métricas calculadas
      effectiveness,
      averageResponseTime: null, // TODO: implementar quando tivermos dados de tempo de resposta
      
      // Tendências (simplificadas por enquanto)
      trends: {
        detections: coverage > 0 ? 'up' : 'neutral',
        takedowns: successRate > 80 ? 'up' : successRate > 50 ? 'neutral' : 'down',
        effectiveness: effectiveness > 80 ? 'up' : effectiveness > 50 ? 'neutral' : 'down'
      },
      
      // Período de referência
      periodStart: thirtyDaysAgo.toISOString(),
      periodEnd: new Date().toISOString(),
      
      // Metadata
      generatedAt: new Date().toISOString(),
      userId: session.user.id
    }

    return NextResponse.json(analytics)

  } catch (error) {
    console.error('Erro ao gerar analytics:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}