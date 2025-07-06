'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertTriangle, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface RateLimitUsage {
  endpoint: string
  limit: number
  used: number
  remaining: number
  resetAt: string
  resetIn: number
}

interface RateLimitData {
  usage: RateLimitUsage[]
  globalUsage: {
    limit: number
    used: number
    remaining: number
    resetAt: string
    resetIn: number
  }
}

export function RateLimitWidget() {
  const [data, setData] = useState<RateLimitData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRateLimitData = async () => {
    try {
      setError(null)
      const response = await fetch('/api/rate-limit/usage')
      
      if (!response.ok) {
        throw new Error('Failed to fetch rate limit data')
      }
      
      const result = await response.json()
      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Unknown error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rate limit data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchRateLimitData()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchRateLimitData, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchRateLimitData()
  }

  const formatResetTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  }

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-500'
    if (percentage >= 80) return 'text-orange-500'
    if (percentage >= 70) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 80) return 'bg-orange-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Rate Limits</CardTitle>
          <CardDescription>Loading usage data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Rate Limits</CardTitle>
          <CardDescription>Error loading data</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return null
  }

  const globalPercentage = (data.globalUsage.used / data.globalUsage.limit) * 100

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>API Rate Limits</CardTitle>
          <CardDescription>
            Monitor your API usage across all endpoints
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={refreshing}
          className={refreshing ? 'animate-spin' : ''}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Usage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">Global Usage</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total API calls across all endpoints</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-sm text-gray-500">
              Resets in {formatResetTime(data.globalUsage.resetIn)}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className={getUsageColor(globalPercentage)}>
                {data.globalUsage.used} / {data.globalUsage.limit} requests
              </span>
              <span className="text-gray-500">
                {data.globalUsage.remaining} remaining
              </span>
            </div>
            
            <Progress 
              value={globalPercentage} 
              className="h-2"
            />
          </div>

          {globalPercentage >= 80 && (
            <Alert className="mt-3" variant={globalPercentage >= 90 ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {globalPercentage >= 90 
                  ? `Critical: You've used ${globalPercentage.toFixed(0)}% of your rate limit!`
                  : `Warning: You've used ${globalPercentage.toFixed(0)}% of your rate limit.`
                }
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Endpoint Usage */}
        {data.usage.length > 0 && (
          <div>
            <h3 className="font-medium mb-3">Endpoint Breakdown</h3>
            <div className="space-y-3">
              {data.usage.map((endpoint) => {
                const percentage = (endpoint.used / endpoint.limit) * 100
                
                return (
                  <div key={endpoint.endpoint} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {endpoint.endpoint}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {endpoint.used}/{endpoint.limit}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatResetTime(endpoint.resetIn)}
                      </span>
                    </div>
                    
                    <Progress 
                      value={percentage} 
                      className="h-1.5"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* No usage */}
        {data.usage.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No API calls made yet</p>
            <p className="text-xs mt-1">Your limits will appear here as you use the API</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}