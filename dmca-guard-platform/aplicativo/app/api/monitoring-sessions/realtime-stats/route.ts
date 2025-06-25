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

    // Buscar todas as sessões do usuário
    const sessions = await prisma.monitoringSession.findMany({
      where: {
        userId: session.user.id,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        status: true,
        currentKeyword: true,
        progress: true,
        totalKeywords: true,
        processedKeywords: true,
        resultsFound: true,
        lastScanAt: true,
        nextScanAt: true,
        brandProfile: {
          select: {
            id: true,
            brandName: true,
            safeKeywords: true
          }
        }
      },
      orderBy: { lastScanAt: 'desc' }
    })

    // Calcular estatísticas gerais
    const stats = {
      totalSessions: sessions.length,
      runningSessions: sessions.filter(s => s.status === 'RUNNING').length,
      pausedSessions: sessions.filter(s => s.status === 'PAUSED').length,
      idleSessions: sessions.filter(s => s.status === 'IDLE').length,
      completedSessions: sessions.filter(s => s.status === 'COMPLETED').length,
      errorSessions: sessions.filter(s => s.status === 'ERROR').length,
      totalResultsFound: sessions.reduce((sum, s) => sum + (s.resultsFound || 0), 0),
      totalKeywordsBeingProcessed: sessions
        .filter(s => s.status === 'RUNNING')
        .reduce((sum, s) => sum + (s.totalKeywords || 0), 0),
      totalKeywordsProcessed: sessions.reduce((sum, s) => sum + (s.processedKeywords || 0), 0)
    }

    // Informações detalhadas das sessões ativas/em execução
    const activeSessions = sessions
      .filter(s => s.status === 'RUNNING' || s.status === 'PAUSED')
      .map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        currentKeyword: s.currentKeyword,
        progress: s.progress || 0,
        progressPercentage: s.totalKeywords > 0 
          ? Math.round(((s.processedKeywords || 0) / s.totalKeywords) * 100)
          : 0,
        processedKeywords: s.processedKeywords || 0,
        totalKeywords: s.totalKeywords || 0,
        resultsFound: s.resultsFound || 0,
        brandProfile: {
          id: s.brandProfile.id,
          brandName: s.brandProfile.brandName
        },
        lastScanAt: s.lastScanAt,
        nextScanAt: s.nextScanAt,
        estimatedTimeRemaining: s.status === 'RUNNING' && s.totalKeywords > 0 && s.processedKeywords > 0
          ? calculateEstimatedTime(s.processedKeywords, s.totalKeywords, s.lastScanAt)
          : null
      }))

    // Sessões que precisam de atenção
    const sessionsNeedingAttention = sessions.filter(s => 
      s.status === 'ERROR' || 
      (s.status === 'IDLE' && s.nextScanAt && new Date(s.nextScanAt) < new Date())
    ).map(s => ({
      id: s.id,
      name: s.name,
      status: s.status,
      brandProfile: s.brandProfile.brandName,
      issue: s.status === 'ERROR' 
        ? 'Erro durante execução' 
        : 'Scan atrasado',
      nextScanAt: s.nextScanAt
    }))

    return NextResponse.json({
      stats,
      activeSessions,
      sessionsNeedingAttention,
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Erro ao buscar estatísticas em tempo real:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

function calculateEstimatedTime(
  processedKeywords: number, 
  totalKeywords: number, 
  startTime: Date | null
): string | null {
  if (!startTime || processedKeywords === 0) return null
  
  const elapsed = Date.now() - new Date(startTime).getTime()
  const rate = processedKeywords / elapsed // keywords per millisecond
  const remaining = totalKeywords - processedKeywords
  const estimatedMs = remaining / rate
  
  // Converter para formato legível
  const minutes = Math.round(estimatedMs / (1000 * 60))
  
  if (minutes < 1) return 'Menos de 1 minuto'
  if (minutes < 60) return `${minutes} minutos`
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  if (hours < 24) {
    return remainingMinutes > 0 
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`
  }
  
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  
  return remainingHours > 0
    ? `${days}d ${remainingHours}h`
    : `${days}d`
}