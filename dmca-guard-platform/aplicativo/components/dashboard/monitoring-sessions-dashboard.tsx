'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Play, 
  Pause,
  Square, 
  RotateCcw, 
  Activity, 
  Search, 
  Shield, 
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Globe,
  Target,
  RefreshCw,
  Settings,
  Eye
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface MonitoringSessionStatus {
  id: string
  name: string
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR'
  currentKeyword: string | null
  progress: number
  totalKeywords: number
  processedKeywords: number
  resultsFound: number
  lastScanAt: Date | null
  nextScanAt: Date | null
  brandProfile: {
    id: string
    brandName: string
    keywordCount: number
  }
  progressPercentage: number
  isRunning: boolean
  isPaused: boolean
  isCompleted: boolean
  hasError: boolean
}

interface SessionStats {
  totalSessions: number
  runningSessions: number
  pausedSessions: number
  idleSessions: number
  completedSessions: number
  errorSessions: number
  totalResultsFound: number
  totalKeywordsBeingProcessed: number
  totalKeywordsProcessed: number
}

interface ActiveSession {
  id: string
  name: string
  status: string
  currentKeyword: string | null
  progress: number
  progressPercentage: number
  processedKeywords: number
  totalKeywords: number
  resultsFound: number
  brandProfile: {
    id: string
    brandName: string
  }
  lastScanAt: Date | null
  nextScanAt: Date | null
  estimatedTimeRemaining: string | null
}

interface SessionNeedingAttention {
  id: string
  name: string
  status: string
  brandProfile: string
  issue: string
  nextScanAt: Date | null
}

interface RealtimeStats {
  stats: SessionStats
  activeSessions: ActiveSession[]
  sessionsNeedingAttention: SessionNeedingAttention[]
  lastUpdated: string
}

interface SessionCardProps {
  session: MonitoringSessionStatus
  onAction: (sessionId: string, action: string) => void
  isLoading?: boolean
}

function SessionCard({ session, onAction, isLoading }: SessionCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-green-500 text-white'
      case 'PAUSED': return 'bg-yellow-500 text-white'
      case 'COMPLETED': return 'bg-blue-500 text-white'
      case 'ERROR': return 'bg-red-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING': return <Play className="h-3 w-3" />
      case 'PAUSED': return <Pause className="h-3 w-3" />
      case 'COMPLETED': return <CheckCircle className="h-3 w-3" />
      case 'ERROR': return <XCircle className="h-3 w-3" />
      default: return <Clock className="h-3 w-3" />
    }
  }

  const formatTime = (date: Date | null) => {
    if (!date) return 'Nunca'
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Card className={`${session.hasError ? 'border-red-200 bg-red-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{session.name}</CardTitle>
            <CardDescription className="text-sm">
              {session.brandProfile.brandName} • {session.brandProfile.keywordCount} keywords
            </CardDescription>
          </div>
          <Badge className={getStatusColor(session.status)}>
            {getStatusIcon(session.status)}
            <span className="ml-1">{session.status}</span>
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Section */}
        {(session.isRunning || session.isPaused) && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {session.currentKeyword ? `Processando: "${session.currentKeyword}"` : 'Preparando...'}
              </span>
              <span className="text-muted-foreground">
                {session.processedKeywords}/{session.totalKeywords}
              </span>
            </div>
            <Progress value={session.progressPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{session.progressPercentage}% concluído</span>
              <span>{session.resultsFound} resultados encontrados</span>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-gray-500" />
              <span className="text-muted-foreground">Resultados</span>
            </div>
            <div className="font-medium">{session.resultsFound}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-muted-foreground">Último scan</span>
            </div>
            <div className="font-medium text-xs">{formatTime(session.lastScanAt)}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-2 pt-2">
          {session.status === 'IDLE' && (
            <Button 
              size="sm" 
              onClick={() => onAction(session.id, 'start')}
              disabled={isLoading}
            >
              <Play className="mr-1 h-3 w-3" />
              Iniciar
            </Button>
          )}
          
          {session.isRunning && (
            <>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onAction(session.id, 'pause')}
                disabled={isLoading}
              >
                <Pause className="mr-1 h-3 w-3" />
                Pausar
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => onAction(session.id, 'stop')}
                disabled={isLoading}
              >
                <Square className="mr-1 h-3 w-3" />
                Parar
              </Button>
            </>
          )}
          
          {session.isPaused && (
            <>
              <Button 
                size="sm"
                onClick={() => onAction(session.id, 'start')}
                disabled={isLoading}
              >
                <Play className="mr-1 h-3 w-3" />
                Continuar
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => onAction(session.id, 'stop')}
                disabled={isLoading}
              >
                <Square className="mr-1 h-3 w-3" />
                Parar
              </Button>
            </>
          )}
          
          {(session.isCompleted || session.hasError) && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onAction(session.id, 'reset')}
              disabled={isLoading}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Resetar
            </Button>
          )}

          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => onAction(session.id, 'view')}
          >
            <Eye className="mr-1 h-3 w-3" />
            Ver
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface StatsCardProps {
  icon: React.ReactNode
  label: string
  value: number | string
  subValue?: string
  isLive?: boolean
  alert?: boolean
}

function StatsCard({ icon, label, value, subValue, isLive, alert }: StatsCardProps) {
  return (
    <Card className={`${alert ? 'border-red-200 bg-red-50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <div className="flex items-center space-x-2">
            {icon}
            {isLive && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600 font-medium">LIVE</span>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{label}</p>
          {subValue && (
            <p className="text-xs text-gray-500">{subValue}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function MonitoringSessionsDashboard() {
  const [sessions, setSessions] = useState<MonitoringSessionStatus[]>([])
  const [realtimeStats, setRealtimeStats] = useState<RealtimeStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  const { toast } = useToast()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadSessions()
    loadRealtimeStats()
    
    // Start polling for real-time updates
    intervalRef.current = setInterval(() => {
      loadRealtimeStats()
    }, 3000) // Poll every 3 seconds
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/monitoring-sessions')
      const data = await response.json()
      
      if (response.ok) {
        setSessions(data)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Erro ao carregar sessões:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao carregar sessões de monitoramento',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadRealtimeStats = async () => {
    try {
      const response = await fetch('/api/monitoring-sessions/realtime-stats')
      const data = await response.json()
      
      if (response.ok) {
        setRealtimeStats(data)
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    }
  }

  const handleSessionAction = async (sessionId: string, action: string) => {
    if (action === 'view') {
      // Navigate to session details (implement based on your routing)
      window.location.href = `/dashboard/monitoring/${sessionId}`
      return
    }

    setActionLoading(sessionId)
    
    try {
      const response = await fetch(`/api/monitoring-sessions/${sessionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: 'Sucesso',
          description: data.message
        })
        
        // Refresh sessions
        await loadSessions()
        await loadRealtimeStats()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Erro na ação:', error)
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao executar ação',
        variant: 'destructive'
      })
    } finally {
      setActionLoading(null)
    }
  }

  if (isLoading && !realtimeStats) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Sessões de Monitoramento</h2>
          <p className="text-muted-foreground">
            Gerencie e monitore suas sessões de busca de keywords em tempo real
          </p>
        </div>
        <Button onClick={loadRealtimeStats} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Real-time Stats */}
      {realtimeStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatsCard
            icon={<Activity className="h-4 w-4" />}
            label="Sessões Ativas"
            value={realtimeStats.stats.runningSessions}
            subValue={`de ${realtimeStats.stats.totalSessions} total`}
            isLive={realtimeStats.stats.runningSessions > 0}
          />
          <StatsCard
            icon={<Pause className="h-4 w-4" />}
            label="Sessões Pausadas"
            value={realtimeStats.stats.pausedSessions}
          />
          <StatsCard
            icon={<Target className="h-4 w-4" />}
            label="Resultados Encontrados"
            value={realtimeStats.stats.totalResultsFound}
            alert={realtimeStats.stats.totalResultsFound > 0}
          />
          <StatsCard
            icon={<Search className="h-4 w-4" />}
            label="Keywords Processadas"
            value={realtimeStats.stats.totalKeywordsProcessed}
          />
          <StatsCard
            icon={<Globe className="h-4 w-4" />}
            label="Keywords em Processamento"
            value={realtimeStats.stats.totalKeywordsBeingProcessed}
            isLive={realtimeStats.stats.runningSessions > 0}
          />
          <StatsCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Precisam Atenção"
            value={realtimeStats.sessionsNeedingAttention.length}
            alert={realtimeStats.sessionsNeedingAttention.length > 0}
          />
        </div>
      )}

      {/* Active Sessions */}
      {realtimeStats && realtimeStats.activeSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Sessões Ativas</span>
              <Badge variant="outline">{realtimeStats.activeSessions.length}</Badge>
            </CardTitle>
            <CardDescription>Sessões em execução ou pausadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {realtimeStats.activeSessions.map((session) => (
                <div key={session.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium">{session.name}</h4>
                      <p className="text-sm text-muted-foreground">{session.brandProfile.brandName}</p>
                    </div>
                    <Badge className={session.status === 'RUNNING' ? 'bg-green-500' : 'bg-yellow-500'}>
                      {session.status}
                    </Badge>
                  </div>
                  
                  {session.currentKeyword && (
                    <p className="text-sm mb-2">
                      <span className="font-medium">Processando:</span> "{session.currentKeyword}"
                    </p>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{session.processedKeywords}/{session.totalKeywords} keywords</span>
                      <span>{session.progressPercentage}%</span>
                    </div>
                    <Progress value={session.progressPercentage} className="h-1.5" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{session.resultsFound} resultados</span>
                      {session.estimatedTimeRemaining && (
                        <span>~{session.estimatedTimeRemaining} restantes</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions Needing Attention */}
      {realtimeStats && realtimeStats.sessionsNeedingAttention.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              <span>Sessões que Precisam de Atenção</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {realtimeStats.sessionsNeedingAttention.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 bg-white rounded border">
                  <div>
                    <h4 className="font-medium">{session.name}</h4>
                    <p className="text-sm text-muted-foreground">{session.brandProfile}</p>
                    <p className="text-sm text-yellow-700">{session.issue}</p>
                  </div>
                  <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                    {session.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onAction={handleSessionAction}
            isLoading={actionLoading === session.id}
          />
        ))}
      </div>

      {sessions.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">Nenhuma sessão encontrada</h3>
            <p className="text-muted-foreground mb-4">
              Crie sua primeira sessão de monitoramento para começar a proteger sua marca
            </p>
            <Button>
              <Settings className="mr-2 h-4 w-4" />
              Criar Sessão
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Last Updated */}
      {realtimeStats && (
        <div className="text-center text-xs text-muted-foreground">
          Última atualização: {new Date(realtimeStats.lastUpdated).toLocaleTimeString('pt-BR')}
        </div>
      )}
    </div>
  )
}