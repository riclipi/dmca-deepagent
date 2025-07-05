'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSocket } from '@/hooks/use-socket'
import { Loader2, X } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

interface QueueStatus {
  activeScans: number
  queuedScans: number
  position?: number
}

interface QueueUpdate {
  queueId: string
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED'
  position?: number
  estimatedStartTime?: string
}

export function QueueStatusWidget() {
  const { socket, isConnected } = useSocket('/monitoring')
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [currentQueue, setCurrentQueue] = useState<QueueUpdate[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch initial queue status
  useEffect(() => {
    fetchQueueStatus()
  }, [])

  // Socket event listeners
  useEffect(() => {
    if (socket && isConnected) {
      const handleQueueUpdate = (update: QueueUpdate) => {
        console.log('[Queue Widget] Queue update received:', update)
        
        setCurrentQueue(prev => {
          const existing = prev.find(q => q.queueId === update.queueId)
          if (existing) {
            return prev.map(q => q.queueId === update.queueId ? update : q)
          }
          return [...prev, update]
        })

        // Update counts based on status changes
        if (update.status === 'COMPLETED' || update.status === 'CANCELLED') {
          fetchQueueStatus()
        }
      }

      socket.on('queue-update', handleQueueUpdate)

      return () => {
        socket.off('queue-update', handleQueueUpdate)
      }
    }
  }, [socket, isConnected])

  const fetchQueueStatus = async () => {
    try {
      const response = await fetch('/api/queue/status')
      if (!response.ok) throw new Error('Failed to fetch queue status')
      
      const data = await response.json()
      setQueueStatus(data.data)
    } catch (error) {
      console.error('[Queue Widget] Error fetching status:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o status da fila',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const cancelQueuedScan = async (queueId: string) => {
    try {
      const response = await fetch('/api/queue/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId })
      })

      if (!response.ok) throw new Error('Failed to cancel scan')

      toast({
        title: 'Sucesso',
        description: 'Scan cancelado com sucesso'
      })

      // Remove from current queue
      setCurrentQueue(prev => prev.filter(q => q.queueId !== queueId))
      fetchQueueStatus()
    } catch (error) {
      console.error('[Queue Widget] Error cancelling scan:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível cancelar o scan',
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Status da Fila</CardTitle>
        <Badge variant={isConnected ? 'default' : 'secondary'}>
          {isConnected ? 'Conectado' : 'Desconectado'}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">{queueStatus?.activeScans || 0}</p>
              <p className="text-xs text-muted-foreground">Scans ativos</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{queueStatus?.queuedScans || 0}</p>
              <p className="text-xs text-muted-foreground">Na fila</p>
            </div>
          </div>

          {queueStatus?.position && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm">
                Sua posição na fila: <span className="font-bold">#{queueStatus.position}</span>
              </p>
            </div>
          )}

          {currentQueue.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Scans recentes:</p>
              {currentQueue.slice(0, 5).map(queue => (
                <div key={queue.queueId} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    {queue.status === 'PROCESSING' && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    <Badge variant={
                      queue.status === 'COMPLETED' ? 'success' :
                      queue.status === 'PROCESSING' ? 'default' :
                      queue.status === 'CANCELLED' ? 'destructive' :
                      'secondary'
                    }>
                      {queue.status}
                    </Badge>
                    {queue.position && (
                      <span className="text-xs text-muted-foreground">
                        Posição: #{queue.position}
                      </span>
                    )}
                  </div>
                  {queue.status === 'QUEUED' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => cancelQueuedScan(queue.queueId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}