'use client'

import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { X, AlertTriangle, Info, CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface RateLimitAlertProps {
  threshold?: number // Percentage threshold (default: 80)
  onDismiss?: () => void
}

export function RateLimitAlert({ threshold = 80, onDismiss }: RateLimitAlertProps) {
  const [usage, setUsage] = useState<number>(0)
  const [limit, setLimit] = useState<number>(1000)
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const checkUsage = async () => {
      try {
        const response = await fetch('/api/rate-limit/usage')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data.globalUsage) {
            const { used, limit: userLimit } = data.data.globalUsage
            setUsage(used)
            setLimit(userLimit)
            
            const percentage = (used / userLimit) * 100
            setShow(percentage >= threshold && !dismissed)
          }
        }
      } catch (error) {
        console.error('Failed to check rate limit usage:', error)
      }
    }

    // Check immediately
    checkUsage()
    
    // Check every minute
    const interval = setInterval(checkUsage, 60000)
    
    return () => clearInterval(interval)
  }, [threshold, dismissed])

  const handleDismiss = () => {
    setDismissed(true)
    setShow(false)
    onDismiss?.()
    
    // Reset dismissal after 1 hour
    setTimeout(() => setDismissed(false), 3600000)
  }

  if (!show) return null

  const percentage = Math.round((usage / limit) * 100)
  const remaining = limit - usage
  
  const getAlertVariant = () => {
    if (percentage >= 95) return 'destructive'
    if (percentage >= 90) return 'destructive'
    return 'default'
  }

  const getIcon = () => {
    if (percentage >= 90) return <AlertTriangle className="h-4 w-4" />
    return <Info className="h-4 w-4" />
  }

  const getTitle = () => {
    if (percentage >= 95) return 'Critical: Rate Limit Nearly Exceeded'
    if (percentage >= 90) return 'Warning: High API Usage'
    return 'Rate Limit Alert'
  }

  const getRecommendation = () => {
    if (percentage >= 95) {
      return 'Consider upgrading your plan or reducing API calls immediately.'
    }
    if (percentage >= 90) {
      return 'You may want to monitor your usage closely or consider upgrading.'
    }
    return 'Keep an eye on your API usage to avoid hitting limits.'
  }

  return (
    <Alert variant={getAlertVariant()} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      
      {getIcon()}
      
      <AlertTitle className="flex items-center gap-2">
        {getTitle()}
        <Badge variant={percentage >= 90 ? "destructive" : "secondary"}>
          {percentage}% used
        </Badge>
      </AlertTitle>
      
      <AlertDescription className="mt-2 space-y-2">
        <p>
          You've used <strong>{usage.toLocaleString()}</strong> of your{' '}
          <strong>{limit.toLocaleString()}</strong> API requests.
          Only <strong>{remaining.toLocaleString()}</strong> requests remaining.
        </p>
        
        <p className="text-sm">{getRecommendation()}</p>
        
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" asChild>
            <a href="/dashboard/usage">View Details</a>
          </Button>
          {percentage >= 90 && (
            <Button variant="default" size="sm" asChild>
              <a href="/settings/billing">Upgrade Plan</a>
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}