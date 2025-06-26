'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Play, 
  Pause, 
  Square, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Activity,
  Eye,
  TrendingUp,
  Shield
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface KnownSitesControllerProps {
  brandProfileId: string
  brandProfileName: string
}

interface ScanSession {
  sessionId: string
  brandProfile: {
    id: string
    name: string
  }
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR'
  progress: {
    totalSites: number
    sitesScanned: number
    violationsFound: number
    errorCount: number
    percentage: number
    currentSite?: string
    estimatedCompletion?: string
  }
  timing: {
    startedAt: string
    elapsedMs: number
    elapsedFormatted: string
    averageTimePerSite: number
    estimatedRemainingMs: number
    estimatedRemainingFormatted: string
  }
  violations: {
    total: number
    byRisk: Record<string, number>
    recent: Array<{
      id: string
      url: string
      title: string
      riskLevel: string
      confidence: number
      detectedAt: string
      site: string
    }>
  }
  performance: {
    sitesPerMinute: number
    successRate: number
    violationRate: number
  }
}

interface ControlActions {
  pause?: any
  resume?: any
  cancel?: any
}

export function KnownSitesController({ brandProfileId, brandProfileName }: KnownSitesControllerProps) {
  const [currentSession, setCurrentSession] = useState<ScanSession | null>(null)
  const [availableActions, setAvailableActions] = useState<ControlActions>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [knownSitesCount, setKnownSitesCount] = useState(0)

  // Buscar contagem de sites conhecidos
  useEffect(() => {
    fetchKnownSitesCount()
  }, [])

  // Polling para atualizar status se há sessão ativa
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (currentSession && ['RUNNING', 'PAUSED'].includes(currentSession.status)) {
      interval = setInterval(() => {
        fetchSessionStatus(currentSession.sessionId)
      }, 2000) // Atualizar a cada 2 segundos
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [currentSession?.sessionId, currentSession?.status])

  // Verificar sessão ativa ao carregar
  useEffect(() => {
    checkActiveSession()
  }, [brandProfileId])

  const fetchKnownSitesCount = async () => {
    try {
      const response = await fetch('/api/known-sites/stats')
      if (response.ok) {
        const data = await response.json()
        setKnownSitesCount(data.overview.totalSites)
      }
    } catch (error) {
      console.error('Erro ao buscar contagem de sites:', error)
    }
  }

  const checkActiveSession = async () => {
    try {
      const response = await fetch(`/api/agents/known-sites/scan?brandProfileId=${brandProfileId}&status=RUNNING,PAUSED`)
      if (response.ok) {
        const data = await response.json()
        if (data.sessions.length > 0) {
          const activeSession = data.sessions[0]
          await fetchSessionStatus(activeSession.sessionId)
        }
      }
    } catch (error) {
      console.error('Erro ao verificar sessão ativa:', error)
    }
  }

  const fetchSessionStatus = async (sessionId: string) => {
    try {
      const [statusResponse, controlResponse] = await Promise.all([
        fetch(`/api/agents/known-sites/${sessionId}/status`),
        fetch(`/api/agents/known-sites/${sessionId}/control`)
      ])

      if (statusResponse.ok && controlResponse.ok) {
        const statusData = await statusResponse.json()
        const controlData = await controlResponse.json()
        
        setCurrentSession(statusData)
        setAvailableActions(controlData.availableActions)
      }
    } catch (error) {
      console.error('Erro ao buscar status da sessão:', error)
    }
  }

  const startScan = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/agents/known-sites/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId,
          options: {
            respectRobots: true,
            maxConcurrency: 3,
            timeout: 30000,
            screenshotViolations: true,
            skipRecentlyScanned: true,
            recentThreshold: 24
          }
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Aguardar um pouco e buscar o status inicial
        setTimeout(() => {
          fetchSessionStatus(data.sessionId)
        }, 1000)
      } else {
        setError(data.error || 'Erro ao iniciar varredura')
        if (data.activeSessionId) {
          // Há uma sessão ativa, carregar ela
          fetchSessionStatus(data.activeSessionId)
        }
      }
    } catch (error) {
      setError('Erro de conexão ao iniciar varredura')
    } finally {
      setIsLoading(false)
    }
  }

  const executeAction = async (action: string) => {
    if (!currentSession) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/agents/known-sites/${currentSession.sessionId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (response.ok) {
        // Atualizar status após ação
        setTimeout(() => {
          fetchSessionStatus(currentSession.sessionId)
        }, 500)
      } else {
        const data = await response.json()
        setError(data.error)
      }
    } catch (error) {
      setError('Erro ao executar ação')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = () => {
    if (!currentSession) return <Shield className="h-5 w-5" />
    
    switch (currentSession.status) {
      case 'RUNNING': return <Activity className="h-5 w-5 text-green-500" />
      case 'PAUSED': return <Pause className="h-5 w-5 text-yellow-500" />
      case 'COMPLETED': return <CheckCircle className="h-5 w-5 text-blue-500" />
      case 'ERROR': return <AlertTriangle className="h-5 w-5 text-red-500" />
      default: return <Shield className="h-5 w-5" />
    }
  }

  const getStatusBadge = () => {
    if (!currentSession) return null

    const variants = {
      'RUNNING': 'default',
      'PAUSED': 'secondary',
      'COMPLETED': 'outline',
      'ERROR': 'destructive'
    } as const

    const labels = {
      'RUNNING': 'Executando',
      'PAUSED': 'Pausado',
      'COMPLETED': 'Concluído',
      'ERROR': 'Erro'
    }

    return (
      <Badge variant={variants[currentSession.status]}>
        {labels[currentSession.status]}
      </Badge>
    )
  }

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'CRITICAL': return 'destructive'
      case 'HIGH': return 'destructive'
      case 'MEDIUM': return 'secondary'
      case 'LOW': return 'outline'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      {/* Card Principal */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon()}
                Agente de Sites Conhecidos
              </CardTitle>
              <CardDescription>
                Varredura de {knownSitesCount.toLocaleString()} sites com histórico de violações para a marca "{brandProfileName}"
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Controles principais */}
            <div className="flex items-center gap-3">
              {!currentSession || ['COMPLETED', 'ERROR'].includes(currentSession.status) ? (
                <Button 
                  onClick={startScan} 
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  {isLoading ? 'Iniciando...' : 'Iniciar Varredura'}
                </Button>
              ) : (
                <>
                  {availableActions.pause && (
                    <Button
                      variant="secondary"
                      onClick={() => executeAction('pause')}
                      disabled={isLoading}
                      className="flex items-center gap-2"
                    >
                      <Pause className="h-4 w-4" />
                      Pausar
                    </Button>
                  )}
                  
                  {availableActions.resume && (
                    <Button
                      onClick={() => executeAction('resume')}
                      disabled={isLoading}
                      className="flex items-center gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Retomar
                    </Button>
                  )}
                  
                  {availableActions.cancel && (
                    <Button
                      variant="destructive"
                      onClick={() => executeAction('cancel')}
                      disabled={isLoading}
                      className="flex items-center gap-2"
                    >
                      <Square className="h-4 w-4" />
                      Cancelar
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Mensagem de erro */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Progress da sessão ativa */}
            {currentSession && ['RUNNING', 'PAUSED'].includes(currentSession.status) && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Progresso: {currentSession.progress.sitesScanned}/{currentSession.progress.totalSites}</span>
                  <span>{currentSession.progress.violationsFound} violações encontradas</span>
                </div>
                
                <Progress value={currentSession.progress.percentage} className="h-2" />
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Taxa de Sucesso</div>
                    <div className="font-medium">{currentSession.performance.successRate}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Sites/min</div>
                    <div className="font-medium">{currentSession.performance.sitesPerMinute}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Tempo Restante</div>
                    <div className="font-medium">{currentSession.timing.estimatedRemainingFormatted}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Erros</div>
                    <div className="font-medium">{currentSession.progress.errorCount}</div>
                  </div>
                </div>

                {currentSession.progress.currentSite && (
                  <div className="bg-muted p-3 rounded text-sm">
                    <div className="text-muted-foreground">Processando:</div>
                    <div className="font-mono">{currentSession.progress.currentSite}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs com detalhes */}
      {currentSession && (
        <Tabs defaultValue="violations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="violations" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Violações ({currentSession.violations.total})
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="violations" className="space-y-4">
            {/* Resumo por risco */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(currentSession.violations.byRisk).map(([risk, count]) => (
                <Card key={risk}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Badge variant={getRiskBadgeVariant(risk)}>{risk}</Badge>
                      <span className="text-2xl font-bold">{count}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Lista de violações recentes */}
            <Card>
              <CardHeader>
                <CardTitle>Violações Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentSession.violations.recent.length > 0 ? (
                    currentSession.violations.recent.map((violation) => (
                      <div key={violation.id} className="flex items-start justify-between p-3 border rounded">
                        <div className="space-y-1 flex-1">
                          <div className="font-medium truncate">{violation.title}</div>
                          <div className="text-sm text-muted-foreground truncate">{violation.url}</div>
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant={getRiskBadgeVariant(violation.riskLevel)} className="text-xs">
                              {violation.riskLevel}
                            </Badge>
                            <span>{violation.confidence}% confiança</span>
                            <span>{violation.site}</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(violation.detectedAt), { locale: ptBR, addSuffix: true })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      Nenhuma violação encontrada ainda
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Taxa de Violações</div>
                    <div className="text-2xl font-bold">{currentSession.performance.violationRate}%</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Tempo Decorrido</div>
                    <div className="text-2xl font-bold">{currentSession.timing.elapsedFormatted}</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Média por Site</div>
                    <div className="text-2xl font-bold">{(currentSession.timing.averageTimePerSite / 1000).toFixed(1)}s</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Atividade da Sessão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Iniciado em:</span>
                    <span>{new Date(currentSession.timing.startedAt).toLocaleString('pt-BR')}</span>
                  </div>
                  
                  {currentSession.timing.estimatedRemainingMs > 0 && (
                    <div className="flex justify-between">
                      <span>Previsão de término:</span>
                      <span>
                        {new Date(Date.now() + currentSession.timing.estimatedRemainingMs).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span>Tempo por site:</span>
                    <span>{(currentSession.timing.averageTimePerSite / 1000).toFixed(2)}s</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}