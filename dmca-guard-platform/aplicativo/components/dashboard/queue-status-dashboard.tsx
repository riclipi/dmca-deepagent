'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ProgressExtended } from '@/components/ui/progress-extended'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import { useSocket } from '@/hooks/use-socket'
import { Clock, Users, Activity, TrendingUp, AlertCircle, XCircle, CheckCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface QueueStatus {
  userId: string
  activeScans: number
  queuedScans: number
  position: number | null
  estimatedWaitTime: number | null
  userPlan: string
  planLimits: {
    maxConcurrent: number
    priority: number
  }
}

interface QueueStats {
  globalQueue: number
  totalQueued: number
  totalProcessing: number
  queuesByPlan: Record<string, number>
}

interface QueueMetrics {
  avgWaitTime: number
  completionRate: number
  errorRate: number
  planDistribution: Record<string, number>
}

export function QueueStatusDashboard() {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null)
  const [queueMetrics, setQueueMetrics] = useState<QueueMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { socket, isConnected } = useSocket('/monitoring')

  // Fetch initial data
  const fetchQueueData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch queue status
      const statusRes = await fetch('/api/queue/status')
      if (!statusRes.ok) throw new Error('Failed to fetch queue status')
      const statusData = await statusRes.json()
      setQueueStatus(statusData.data)

      // Fetch queue stats
      const statsRes = await fetch('/api/queue/stats')
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setQueueStats(statsData.data)
      }

      // Fetch queue metrics
      const metricsRes = await fetch('/api/queue/metrics')
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json()
        setQueueMetrics(metricsData.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueueData()
  }, [fetchQueueData])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return

    const handleQueueUpdate = (data: any) => {
      if (data.userId === queueStatus?.userId) {
        setQueueStatus(prev => ({ ...prev!, ...data }))
      }
    }

    const handleStatsUpdate = (data: QueueStats) => {
      setQueueStats(data)
    }

    socket.on('queue:update', handleQueueUpdate)
    socket.on('queue:stats', handleStatsUpdate)

    return () => {
      socket.off('queue:update', handleQueueUpdate)
      socket.off('queue:stats', handleStatsUpdate)
    }
  }, [socket, isConnected, queueStatus?.userId])

  const handleCancelScan = async (queueId: string) => {
    try {
      const res = await fetch('/api/queue/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId })
      })

      if (!res.ok) throw new Error('Failed to cancel scan')

      toast({
        title: 'Scan cancelled',
        description: 'The queued scan has been cancelled successfully.',
      })

      fetchQueueData()
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to cancel the scan. Please try again.',
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return <QueueStatusSkeleton />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-muted-foreground">
          {isConnected ? 'Connected to real-time updates' : 'Disconnected from real-time updates'}
        </span>
      </div>

      {/* User Queue Status */}
      <Card>
        <CardHeader>
          <CardTitle>Your Queue Status</CardTitle>
          <CardDescription>
            Current scan activity and queue position
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Plan</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{queueStatus?.userPlan}</Badge>
                <span className="text-xs text-muted-foreground">
                  (Max {queueStatus?.planLimits.maxConcurrent} concurrent)
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Active Scans</p>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="text-2xl font-bold">
                  {queueStatus?.activeScans || 0}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Queued Scans</p>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-2xl font-bold">
                  {queueStatus?.queuedScans || 0}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Queue Position</p>
              <div className="flex items-center gap-2">
                {queueStatus?.position ? (
                  <>
                    <span className="text-2xl font-bold">#{queueStatus.position}</span>
                    {queueStatus.estimatedWaitTime && (
                      <span className="text-xs text-muted-foreground">
                        (~{Math.ceil(queueStatus.estimatedWaitTime / 1000 / 60)} min)
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            </div>
          </div>

          {queueStatus?.activeScans === queueStatus?.planLimits.maxConcurrent && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Concurrent scan limit reached</AlertTitle>
              <AlertDescription>
                You have reached the maximum number of concurrent scans for your plan. 
                New scans will be queued until a slot becomes available.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Global Queue Stats */}
      {queueStats && (
        <Card>
          <CardHeader>
            <CardTitle>Global Queue Statistics</CardTitle>
            <CardDescription>
              System-wide queue performance and distribution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Processing</p>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold">{queueStats.totalProcessing}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Queued</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-2xl font-bold">{queueStats.totalQueued}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Global Queue Size</p>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold">{queueStats.globalQueue}</span>
                </div>
              </div>
            </div>

            {Object.keys(queueStats.queuesByPlan).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Queue Distribution by Plan</p>
                <div className="space-y-2">
                  {Object.entries(queueStats.queuesByPlan).map(([plan, count]) => (
                    <div key={plan} className="flex items-center gap-2">
                      <span className="text-sm w-24">{plan}</span>
                      <Progress 
                        value={(count / queueStats.totalQueued) * 100} 
                        className="flex-1" 
                      />
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      {queueMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>
              Queue performance indicators from the last hour
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Avg Wait Time</p>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">
                  {Math.round(queueMetrics.avgWaitTime / 1000 / 60)} min
                </p>
                <p className="text-xs text-muted-foreground">
                  Average time in queue
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Completion Rate</p>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-2xl font-bold">
                  {queueMetrics.completionRate.toFixed(1)}%
                </p>
                <Progress value={queueMetrics.completionRate} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Error Rate</p>
                  <XCircle className="h-4 w-4 text-red-500" />
                </div>
                <p className="text-2xl font-bold">
                  {queueMetrics.errorRate.toFixed(1)}%
                </p>
                <ProgressExtended 
                  value={queueMetrics.errorRate} 
                  className="h-2"
                  indicatorClassName="bg-red-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function QueueStatusSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-48" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}