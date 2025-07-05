'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { useSocket } from '@/hooks/use-socket'
import { 
  Play, 
  Pause, 
  Square, 
  Activity, 
  AlertTriangle,
  CheckCircle,
  Wifi,
  WifiOff,
  Search,
  Shield,
  Clock
} from 'lucide-react'

interface RealTimeMonitoringProps {
  sessionId: string
  initialData?: {
    progress: number
    currentKeyword: string
    status: string
    sitesScanned: number
    violationsFound: number
  }
}

export function RealTimeMonitoring({ sessionId, initialData }: RealTimeMonitoringProps) {
  const { socket, isConnected } = useSocket('/monitoring')
  const { toast } = useToast()
  
  const [progress, setProgress] = useState(initialData?.progress || 0)
  const [currentKeyword, setCurrentKeyword] = useState(initialData?.currentKeyword || '')
  const [status, setStatus] = useState(initialData?.status || 'PENDING')
  const [sitesScanned, setSitesScanned] = useState(initialData?.sitesScanned || 0)
  const [violationsFound, setViolationsFound] = useState(initialData?.violationsFound || 0)
  const [activities, setActivities] = useState<any[]>([])

  useEffect(() => {
    if (!socket || !isConnected || !sessionId) return

    const room = `session:${sessionId}`
    
    // Entrar na sala da sessão
    socket.emit('join', room)
    
    // Escutar atualizações de progresso
    socket.on('progress', (data) => {
      setProgress(data.progress || 0)
      setCurrentKeyword(data.currentKeyword || '')
      
      if (data.status) setStatus(data.status)
      if (data.sitesScanned !== undefined) setSitesScanned(data.sitesScanned)
      if (data.violationsFound !== undefined) setViolationsFound(data.violationsFound)
      
      // Adicionar atividade
      setActivities(prev => [{
        id: Date.now(),
        type: 'progress',
        message: `Escaneando: ${data.currentKeyword}`,
        timestamp: new Date(),
        data
      }, ...prev.slice(0, 49)])
    })
    
    // Escutar violações detectadas
    socket.on('violation-detected', (data) => {
      setViolationsFound(prev => prev + 1)
      
      toast({
        title: "Violação Detectada!",
        description: `Nova violação encontrada em: ${data.violation.url}`,
        variant: "destructive"
      })
      
      setActivities(prev => [{
        id: Date.now(),
        type: 'violation',
        message: `Violação detectada: ${data.violation.violationType}`,
        timestamp: new Date(),
        data: data.violation
      }, ...prev.slice(0, 49)])
    })
    
    // Limpar ao desmontar
    return () => {
      socket.off('progress')
      socket.off('violation-detected')
      socket.emit('leave', room)
    }
  }, [socket, isConnected, sessionId, toast])

  const getStatusColor = () => {
    switch (status) {
      case 'RUNNING': return 'text-green-600'
      case 'COMPLETED': return 'text-blue-600'
      case 'FAILED': return 'text-red-600'
      case 'PAUSED': return 'text-yellow-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'RUNNING': return <Activity className="w-4 h-4" />
      case 'COMPLETED': return <CheckCircle className="w-4 h-4" />
      case 'FAILED': return <AlertTriangle className="w-4 h-4" />
      case 'PAUSED': return <Pause className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Monitoramento em Tempo Real</CardTitle>
              <CardDescription>
                Sessão: {sessionId.slice(0, 8)}...
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? 'default' : 'destructive'}>
                {isConnected ? (
                  <><Wifi className="w-3 h-3 mr-1" /> Conectado</>
                ) : (
                  <><WifiOff className="w-3 h-3 mr-1" /> Desconectado</>
                )}
              </Badge>
              <Badge className={getStatusColor()}>
                {getStatusIcon()}
                <span className="ml-1">{status}</span>
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Progresso</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            {currentKeyword && (
              <p className="text-sm text-muted-foreground mt-2">
                Palavra-chave atual: <span className="font-medium">{currentKeyword}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Sites Escaneados</span>
                  </div>
                  <span className="text-2xl font-bold">{sitesScanned}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Violações</span>
                  </div>
                  <span className="text-2xl font-bold text-red-600">{violationsFound}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atividade em Tempo Real</CardTitle>
          <CardDescription>
            Últimas 50 atividades da sessão
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 w-full">
            <div className="space-y-2">
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aguardando atividades...
                </p>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-2 p-2 rounded hover:bg-muted/50">
                    <div className="flex-shrink-0 mt-0.5">
                      {activity.type === 'violation' ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : (
                        <Activity className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}