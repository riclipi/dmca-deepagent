'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Search, 
  Play, 
  Pause, 
  Square, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Database
} from 'lucide-react'
import { toast } from 'sonner'

interface DiscoverySession {
  sessionId: string
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR'
  progress: {
    percentage: number
    queriesProcessed: number
    totalQueries: number
    newSitesFound: number
    duplicatesFiltered: number
    currentQuery?: string
  }
  timing: {
    startedAt: Date
    elapsedMs: number
    elapsedFormatted: string
    estimatedCompletion?: Date
  }
  performance: {
    queriesPerMinute: number
    averageTimePerQuery: number
    successRate: number
  }
  errors: {
    count: number
    lastError?: string
  }
}

interface ActivityLogEntry {
  timestamp: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

interface StatCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  className?: string
}

function StatCard({ title, value, icon, className = "" }: StatCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DiscoveryAgentPage() {
  // Estados para configuração
  const [useSerper, setUseSerper] = useState(true)
  const [useGoogle, setUseGoogle] = useState(true)
  const [useBing, setUseBing] = useState(true)
  const [useHistoricalFilter, setUseHistoricalFilter] = useState(true)
  const [usePatternMatching, setUsePatternMatching] = useState(true)
  const [maxQueries, setMaxQueries] = useState(100)
  const [minConfidence, setMinConfidence] = useState(0.6)

  // Estados da sessão
  const [session, setSession] = useState<DiscoverySession | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [selectedBrandProfile, setSelectedBrandProfile] = useState('')
  const [brandProfiles, setBrandProfiles] = useState<Array<{ id: string; brandName: string }>>([])

  // Log de atividade
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])

  // Carregar perfis de marca
  useEffect(() => {
    loadBrandProfiles()
  }, [])

  // Polling para atualizações da sessão
  useEffect(() => {
    let interval: NodeJS.Timeout
    
    if (session?.sessionId && session.status === 'RUNNING') {
      interval = setInterval(() => {
        updateSessionStatus()
      }, 2000) // Atualizar a cada 2 segundos
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [session?.sessionId, session?.status])

  const loadBrandProfiles = async () => {
    try {
      const response = await fetch('/api/brand-profiles')
      if (response.ok) {
        const data = await response.json()
        setBrandProfiles(data.profiles || [])
        if (data.profiles?.length > 0) {
          setSelectedBrandProfile(data.profiles[0].id)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar perfis:', error)
      toast.error('Erro ao carregar perfis de marca')
    }
  }

  const startDiscovery = async () => {
    if (!selectedBrandProfile) {
      toast.error('Selecione um perfil de marca')
      return
    }

    try {
      setIsRunning(true)
      
      const searchProviders = []
      if (useSerper) searchProviders.push('serper')
      if (useGoogle) searchProviders.push('google')
      if (useBing) searchProviders.push('bing')

      const config = {
        maxQueriesPerSession: maxQueries,
        minConfidenceThreshold: minConfidence,
        enableHistoricalAnalysis: useHistoricalFilter,
        searchProviders,
        respectRateLimits: true
      }

      const response = await fetch('/api/agents/discovery/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: selectedBrandProfile,
          config
        })
      })

      if (response.ok) {
        const data = await response.json()
        addToActivityLog('Descoberta iniciada com sucesso', 'success')
        
        // Iniciar monitoramento da sessão
        setTimeout(() => updateSessionStatus(data.sessionId), 1000)
        
        toast.success('Descoberta iniciada com sucesso!')
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao iniciar descoberta')
      }

    } catch (error) {
      console.error('Erro ao iniciar descoberta:', error)
      toast.error('Erro ao iniciar descoberta')
      setIsRunning(false)
    }
  }

  const updateSessionStatus = async (sessionId?: string) => {
    const currentSessionId = sessionId || session?.sessionId
    if (!currentSessionId) return

    try {
      const response = await fetch(`/api/agents/discovery/${currentSessionId}`)
      if (response.ok) {
        const sessionData = await response.json()
        setSession(sessionData)
        
        // Atualizar status de execução
        setIsRunning(sessionData.status === 'RUNNING')
        
        // Adicionar atividade se houver mudança significativa
        if (sessionData.progress.currentQuery && 
            sessionData.progress.currentQuery !== session?.progress.currentQuery) {
          addToActivityLog(`Processando: ${sessionData.progress.currentQuery}`, 'info')
        }

        // Verificar se completou
        if (sessionData.status === 'COMPLETED') {
          addToActivityLog(
            `Descoberta concluída! ${sessionData.progress.newSitesFound} novos sites encontrados`, 
            'success'
          )
          toast.success('Descoberta concluída!')
        }

        // Verificar se houve erro
        if (sessionData.status === 'ERROR') {
          addToActivityLog(`Erro: ${sessionData.errors.lastError}`, 'error')
          toast.error('Erro na descoberta')
        }

      }
    } catch (error) {
      console.error('Erro ao atualizar status da sessão:', error)
    }
  }

  const pauseDiscovery = async () => {
    if (!session?.sessionId) return

    try {
      const response = await fetch(`/api/agents/discovery/${session.sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' })
      })

      if (response.ok) {
        addToActivityLog('Descoberta pausada', 'info')
        toast.success('Descoberta pausada')
        updateSessionStatus()
      }
    } catch (error) {
      console.error('Erro ao pausar descoberta:', error)
      toast.error('Erro ao pausar descoberta')
    }
  }

  const resumeDiscovery = async () => {
    if (!session?.sessionId) return

    try {
      const response = await fetch(`/api/agents/discovery/${session.sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' })
      })

      if (response.ok) {
        addToActivityLog('Descoberta retomada', 'success')
        toast.success('Descoberta retomada')
        updateSessionStatus()
      }
    } catch (error) {
      console.error('Erro ao retomar descoberta:', error)
      toast.error('Erro ao retomar descoberta')
    }
  }

  const cancelDiscovery = async () => {
    if (!session?.sessionId) return

    try {
      const response = await fetch(`/api/agents/discovery/${session.sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' })
      })

      if (response.ok) {
        addToActivityLog('Descoberta cancelada', 'warning')
        toast.success('Descoberta cancelada')
        setSession(null)
        setIsRunning(false)
      }
    } catch (error) {
      console.error('Erro ao cancelar descoberta:', error)
      toast.error('Erro ao cancelar descoberta')
    }
  }

  const addToActivityLog = (message: string, type: ActivityLogEntry['type']) => {
    const entry: ActivityLogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }
    setActivityLog(prev => [entry, ...prev.slice(0, 49)]) // Manter últimas 50 entradas
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'RUNNING':
        return <Badge className="bg-green-500"><Play className="w-3 h-3 mr-1" />Executando</Badge>
      case 'PAUSED':
        return <Badge className="bg-yellow-500"><Pause className="w-3 h-3 mr-1" />Pausado</Badge>
      case 'COMPLETED':
        return <Badge className="bg-blue-500"><CheckCircle className="w-3 h-3 mr-1" />Concluído</Badge>
      case 'ERROR':
        return <Badge className="bg-red-500"><AlertCircle className="w-3 h-3 mr-1" />Erro</Badge>
      default:
        return <Badge variant="outline">Inativo</Badge>
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Search className="w-8 h-8" />
            Agente de Descoberta
          </h1>
          <p className="text-muted-foreground">
            Descoberta de novos sites baseada em padrões históricos e análise multi-API
          </p>
        </div>
        
        <div className="flex gap-2">
          {session?.status === 'RUNNING' && (
            <>
              <Button variant="outline" onClick={pauseDiscovery}>
                <Pause className="w-4 h-4 mr-2" />
                Pausar
              </Button>
              <Button variant="destructive" onClick={cancelDiscovery}>
                <Square className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </>
          )}
          
          {session?.status === 'PAUSED' && (
            <>
              <Button onClick={resumeDiscovery}>
                <Play className="w-4 h-4 mr-2" />
                Retomar
              </Button>
              <Button variant="destructive" onClick={cancelDiscovery}>
                <Square className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </>
          )}
          
          {(!session || ['COMPLETED', 'ERROR'].includes(session.status)) && (
            <Button onClick={startDiscovery} disabled={isRunning || !selectedBrandProfile}>
              <Play className="w-4 h-4 mr-2" />
              {isRunning ? 'Descobrindo...' : 'Iniciar Descoberta'}
            </Button>
          )}
        </div>
      </div>

      {/* Status da sessão atual */}
      {session && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Status da Sessão</CardTitle>
              {getStatusBadge(session.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Progresso</span>
                  <span>{session.progress.percentage.toFixed(1)}%</span>
                </div>
                <Progress value={session.progress.percentage} className="h-2" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Queries processadas:</span>
                  <span className="ml-2 font-mono">{session.progress.queriesProcessed}/{session.progress.totalQueries}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tempo decorrido:</span>
                  <span className="ml-2 font-mono">{session.timing.elapsedFormatted}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Query atual:</span>
                  <span className="ml-2 font-mono text-xs">{session.progress.currentQuery || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Taxa de sucesso:</span>
                  <span className="ml-2 font-mono">{session.performance.successRate}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Configurações de busca */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Busca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Seleção do perfil de marca */}
            <div>
              <Label className="text-base font-semibold">Perfil da Marca</Label>
              <select 
                value={selectedBrandProfile} 
                onChange={(e) => setSelectedBrandProfile(e.target.value)}
                className="w-full mt-2 p-2 border rounded-md"
                disabled={isRunning}
              >
                <option value="">Selecione um perfil</option>
                {brandProfiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.brandName}
                  </option>
                ))}
              </select>
            </div>

            {/* APIs ativas */}
            <div>
              <Label className="text-base font-semibold">APIs de Busca</Label>
              <div className="space-y-3 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="serper"
                    checked={useSerper} 
                    onCheckedChange={(checked) => setUseSerper(checked as boolean)}
                    disabled={isRunning}
                  />
                  <Label htmlFor="serper">Serper API</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="google"
                    checked={useGoogle} 
                    onCheckedChange={(checked) => setUseGoogle(checked as boolean)}
                    disabled={isRunning}
                  />
                  <Label htmlFor="google">Google Custom Search</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="bing"
                    checked={useBing} 
                    onCheckedChange={(checked) => setUseBing(checked as boolean)}
                    disabled={isRunning}
                  />
                  <Label htmlFor="bing">Bing Search API</Label>
                </div>
              </div>
            </div>
            
            {/* Filtros avançados */}
            <div>
              <Label className="text-base font-semibold">Filtros Avançados</Label>
              <div className="space-y-3 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="historical"
                    checked={useHistoricalFilter} 
                    onCheckedChange={(checked) => setUseHistoricalFilter(checked as boolean)}
                    disabled={isRunning}
                  />
                  <Label htmlFor="historical">Filtrar baseado em histórico</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="patterns"
                    checked={usePatternMatching} 
                    onCheckedChange={(checked) => setUsePatternMatching(checked as boolean)}
                    disabled={isRunning}
                  />
                  <Label htmlFor="patterns">Matching de padrões inteligente</Label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Estatísticas em tempo real */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          title="Queries Executadas" 
          value={session?.progress.queriesProcessed || 0}
          icon={<Search className="w-5 h-5" />}
        />
        <StatCard 
          title="Novos Sites" 
          value={session?.progress.newSitesFound || 0}
          icon={<Database className="w-5 h-5" />}
          className="border-green-200"
        />
        <StatCard 
          title="Duplicatas Filtradas" 
          value={session?.progress.duplicatesFiltered || 0}
          icon={<RefreshCw className="w-5 h-5" />}
          className="border-blue-200"
        />
        <StatCard 
          title="Taxa de Sucesso" 
          value={session?.performance.successRate ? `${session.performance.successRate}%` : 'N/A'}
          icon={<CheckCircle className="w-5 h-5" />}
          className="border-purple-200"
        />
      </div>
      
      {/* Performance em tempo real */}
      {session && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            title="Queries/min" 
            value={session.performance.queriesPerMinute.toFixed(1)}
            icon={<Clock className="w-5 h-5" />}
          />
          <StatCard 
            title="Tempo médio/query" 
            value={`${session.performance.averageTimePerQuery}ms`}
            icon={<Clock className="w-5 h-5" />}
          />
          <StatCard 
            title="Erros" 
            value={session.errors.count}
            icon={<AlertCircle className="w-5 h-5" />}
            className={session.errors.count > 0 ? "border-red-200" : ""}
          />
        </div>
      )}
      
      {/* Log de atividade em tempo real */}
      <Card>
        <CardHeader>
          <CardTitle>Log de Atividade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activityLog.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma atividade registrada
              </p>
            ) : (
              activityLog.map((activity, index) => (
                <div key={index} className="text-sm font-mono flex items-center gap-2">
                  <span className="text-muted-foreground">{activity.timestamp}</span>
                  <span 
                    className={`
                      ${activity.type === 'success' ? 'text-green-600' : ''}
                      ${activity.type === 'error' ? 'text-red-600' : ''}
                      ${activity.type === 'warning' ? 'text-yellow-600' : ''}
                      ${activity.type === 'info' ? 'text-blue-600' : ''}
                    `}
                  >
                    {activity.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
