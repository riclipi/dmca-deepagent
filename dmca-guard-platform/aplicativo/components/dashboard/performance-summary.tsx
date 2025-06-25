'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { LoadingSpinner } from '@/components/loading-spinner'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Target,
  Shield,
  Send,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react'

interface AnalyticsSummary {
  successRate: number
  coverage: number
  takedownsSent: number
  totalDetectedContent: number
  detectedContentLast30Days: number
  successfulTakedowns: number
  activeBrandProfiles: number
  activeMonitoringSessions: number
  takedownsByStatus: Record<string, number>
  effectiveness: number
  trends: {
    detections: 'up' | 'down' | 'neutral'
    takedowns: 'up' | 'down' | 'neutral'
    effectiveness: 'up' | 'down' | 'neutral'
  }
  periodStart: string
  periodEnd: string
}

export default function PerformanceSummary() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics/summary')
      
      if (!response.ok) {
        throw new Error('Erro ao carregar analytics')
      }

      const data = await response.json()
      setAnalytics(data)
    } catch (error) {
      console.error('Erro ao buscar analytics:', error)
      setError(error instanceof Error ? error.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const getEffectivenessColor = (effectiveness: number) => {
    if (effectiveness >= 80) return 'text-green-600'
    if (effectiveness >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600'
    if (rate >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Resumo de Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <LoadingSpinner size="lg" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !analytics) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Resumo de Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {error || 'Erro ao carregar dados de performance'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Resumo de Performance</h3>
          <p className="text-sm text-muted-foreground">
            Últimos 30 dias - Atualizado em tempo real
          </p>
        </div>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <div className="flex items-center gap-2">
              {getTrendIcon(analytics.trends.takedowns)}
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getSuccessRateColor(analytics.successRate)}`}>
              {analytics.successRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.successfulTakedowns} de {analytics.takedownsSent} takedowns
            </p>
            <Progress value={analytics.successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cobertura</CardTitle>
            <div className="flex items-center gap-2">
              {getTrendIcon(analytics.trends.detections)}
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.coverage}</div>
            <p className="text-xs text-muted-foreground">
              Conteúdos detectados
            </p>
            <div className="text-xs text-muted-foreground mt-1">
              Total: {analytics.totalDetectedContent}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Takedowns Enviados</CardTitle>
            <div className="flex items-center gap-2">
              {getTrendIcon(analytics.trends.effectiveness)}
              <Send className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.takedownsSent}</div>
            <p className="text-xs text-muted-foreground">
              Solicitações de remoção
            </p>
            <div className="text-xs text-muted-foreground mt-1">
              {analytics.activeBrandProfiles} marcas protegidas
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status dos Takedowns</CardTitle>
            <CardDescription>
              Distribuição das solicitações por status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analytics.takedownsByStatus).map(([status, count]) => {
                const percentage = analytics.takedownsSent > 0 
                  ? Math.round((count / analytics.takedownsSent) * 100)
                  : 0
                
                const getStatusIcon = (status: string) => {
                  switch (status.toLowerCase()) {
                    case 'removido':
                      return <CheckCircle className="h-4 w-4 text-green-600" />
                    case 'pendente':
                      return <Clock className="h-4 w-4 text-yellow-600" />
                    case 'enviado':
                      return <Send className="h-4 w-4 text-blue-600" />
                    default:
                      return <AlertCircle className="h-4 w-4 text-gray-600" />
                  }
                }

                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      <span className="text-sm font-medium">{status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {count}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({percentage}%)
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eficácia Geral</CardTitle>
            <CardDescription>
              Índice de proteção da marca
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getEffectivenessColor(analytics.effectiveness)}`}>
                  {analytics.effectiveness}%
                </div>
                <p className="text-sm text-muted-foreground">
                  Eficácia de Proteção
                </p>
              </div>
              
              <Progress value={analytics.effectiveness} className="h-3" />
              
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold">{analytics.activeMonitoringSessions}</div>
                  <p className="text-xs text-muted-foreground">Monitoramentos Ativos</p>
                </div>
                <div>
                  <div className="text-lg font-semibold">{analytics.activeBrandProfiles}</div>
                  <p className="text-xs text-muted-foreground">Marcas Protegidas</p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                {analytics.effectiveness >= 80 && '🎯 Excelente proteção!'}
                {analytics.effectiveness >= 60 && analytics.effectiveness < 80 && '⚡ Boa proteção'}
                {analytics.effectiveness < 60 && '🔧 Melhore sua estratégia'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}