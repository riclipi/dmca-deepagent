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
  Image,
  Mail,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useSocket } from '@/hooks/use-socket'

interface ScanProgress {
  scanId: string
  userId: string
  isRunning: boolean
  startedAt: Date
  completedAt?: Date
  elapsedMinutes: number
  currentActivity: string
  progress: number
  phase: 'initializing' | 'searching' | 'analyzing' | 'verifying' | 'completed' | 'failed'
}

interface ScanMethods {
  targetedSiteScans: { completed: boolean; count: number; sites: string[] }
  searchEngines: { completed: boolean; queries: number; engines: string[] }
  imageSearches: { completed: boolean; images: number; processed: number }
  reverseImageSearches: { completed: boolean; matches: number; verified: number }
  nicheBasedSearches: { completed: boolean; platforms: number; found: number }
  dmcaDetection: { completed: boolean; contacts: number; compliance: number }
}

interface ScanInsights {
  linksAnalysed: number
  leakingSites: number
  leaksFound: number
  imagesScanned: number
  dmcaContactsFound: number
  complianceSites: number
  estimatedRemovalTime: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

interface ScanActivity {
  id: string
  timestamp: Date
  type: 'search' | 'detection' | 'verification' | 'dmca' | 'completion'
  message: string
  icon: string
  status: 'running' | 'success' | 'warning' | 'error'
  metadata?: any
}

interface InsightCardProps {
  icon: React.ReactNode
  label: string
  value: number | string
  isLive?: boolean
  alert?: boolean
  change?: string
}

function InsightCard({ icon, label, value, isLive, alert, change }: InsightCardProps) {
  return (
    <Card className={`relative ${alert ? 'border-red-200 bg-red-50' : ''}`}>
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
          {change && (
            <Badge variant="outline" className="text-xs">
              {change}
            </Badge>
          )}
        </div>
        <div className="space-y-1">
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

interface ActivityFeedProps {
  activities: ScanActivity[]
}

function ActivityFeed({ activities }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll to top when new activities arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [activities])

  const getActivityIcon = (activity: ScanActivity) => {
    switch (activity.status) {
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>Live Activity Feed</span>
        </CardTitle>
        <CardDescription>Real-time scan progress and findings</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96" ref={scrollRef}>
          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No scan activity yet</p>
              </div>
            ) : (
              activities.map((activity, index) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getActivityIcon(activity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.message}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTime(activity.timestamp)}
                      </p>
                    </div>
                    {activity.metadata && (
                      <p className="text-xs text-gray-500 mt-1">
                        {JSON.stringify(activity.metadata, null, 2)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

interface ScanMethodsGridProps {
  methods: ScanMethods
}

function ScanMethodsGrid({ methods }: ScanMethodsGridProps) {
  const methodCards = [
    {
      key: 'searchEngines',
      title: 'Search Engines',
      icon: <Search className="h-5 w-5" />,
      data: methods.searchEngines,
      metric: 'queries'
    },
    {
      key: 'targetedSiteScans',
      title: 'Targeted Sites',
      icon: <Globe className="h-5 w-5" />,
      data: methods.targetedSiteScans,
      metric: 'count'
    },
    {
      key: 'imageSearches',
      title: 'Image Analysis',
      icon: <Image className="h-5 w-5" />,
      data: methods.imageSearches,
      metric: 'processed'
    },
    {
      key: 'dmcaDetection',
      title: 'DMCA Detection',
      icon: <Mail className="h-5 w-5" />,
      data: methods.dmcaDetection,
      metric: 'contacts'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {methodCards.map((method) => (
        <Card key={method.key} className={`${method.data.completed ? 'border-green-200 bg-green-50' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between space-y-0 pb-2">
              {method.icon}
              {method.data.completed ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Clock className="h-4 w-4 text-gray-400" />
              )}
            </div>
            <div className="space-y-1">
              <div className="text-xl font-bold">
                {method.data[method.metric as keyof typeof method.data] || 0}
              </div>
              <p className="text-xs text-muted-foreground">{method.title}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

interface RealTimeScanDashboardProps {
  brandProfiles: Array<{ id: string; brandName: string }>
}

export function RealTimeScanDashboard({ brandProfiles }: RealTimeScanDashboardProps) {
  const [activeScan, setActiveScan] = useState<string | null>(null)
  const [scanData, setScanData] = useState<{
    progress: ScanProgress | null
    methods: ScanMethods | null
    insights: ScanInsights | null
    activities: ScanActivity[]
  }>({
    progress: null,
    methods: null,
    insights: null,
    activities: []
  })
  const [isStarting, setIsStarting] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState(brandProfiles[0]?.id || '')
  
  const { toast } = useToast()
  const { socket, isConnected } = useSocket('/monitoring')
  const lastActivityRef = useRef<string | null>(null)

  useEffect(() => {
    // Check for existing active scans on mount
    checkActiveScans()
  }, [])

  useEffect(() => {
    if (socket && isConnected && activeScan) {
      const room = `scan:${activeScan}`
      
      // Join the scan room
      socket.emit('join', room)
      
      // Listen for scan progress updates
      socket.on('scan-progress', (data: any) => {
        if (data.scanId === activeScan) {
          setScanData(prevData => ({
            ...prevData,
            progress: {
              ...prevData.progress!,
              ...data.progress
            }
          }))
        }
      })
      
      // Listen for method updates
      socket.on('scan-methods', (data: any) => {
        if (data.scanId === activeScan) {
          setScanData(prevData => ({
            ...prevData,
            methods: data.methods
          }))
        }
      })
      
      // Listen for insights updates
      socket.on('scan-insights', (data: any) => {
        if (data.scanId === activeScan) {
          setScanData(prevData => ({
            ...prevData,
            insights: data.insights
          }))
        }
      })
      
      // Listen for new activities
      socket.on('scan-activity', (data: any) => {
        if (data.scanId === activeScan && data.activity.id !== lastActivityRef.current) {
          lastActivityRef.current = data.activity.id
          setScanData(prevData => ({
            ...prevData,
            activities: [data.activity, ...prevData.activities].slice(0, 50) // Keep last 50 activities
          }))
        }
      })
      
      // Listen for scan completion
      socket.on('scan-complete', (data: any) => {
        if (data.scanId === activeScan) {
          setScanData(prevData => ({
            ...prevData,
            progress: {
              ...prevData.progress!,
              isRunning: false,
              completedAt: new Date(data.completedAt),
              phase: 'completed'
            }
          }))
          
          toast({
            title: 'Scan Completed',
            description: `Found ${data.totalViolations} violations across ${data.sitesScanned} sites`,
            duration: 5000
          })
        }
      })
      
      // Get initial data once
      fetchScanData(activeScan)
      
      return () => {
        socket.emit('leave', room)
        socket.off('scan-progress')
        socket.off('scan-methods')
        socket.off('scan-insights')
        socket.off('scan-activity')
        socket.off('scan-complete')
      }
    }
  }, [socket, isConnected, activeScan, toast])

  const checkActiveScans = async () => {
    try {
      const response = await fetch('/api/scan/start')
      const data = await response.json()
      
      if (data.success && data.hasActiveScans && data.activeScans.length > 0) {
        setActiveScan(data.activeScans[0])
      }
    } catch (error) {
      console.error('Error checking active scans:', error)
    }
  }

  const fetchScanData = async (scanId: string) => {
    try {
      const response = await fetch(`/api/scan/${scanId}`)
      const data = await response.json()
      
      if (data.success) {
        setScanData(data.scan)
      }
    } catch (error) {
      console.error('Error fetching scan data:', error)
    }
  }

  const startScan = async () => {
    if (!selectedProfile) {
      toast({
        title: 'Profile Required',
        description: 'Please select a brand profile to scan',
        variant: 'destructive'
      })
      return
    }

    setIsStarting(true)
    
    try {
      const response = await fetch('/api/scan/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: selectedProfile, scanType: 'full' })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setActiveScan(data.scanId)
        toast({
          title: '🚀 Scan Started',
          description: 'Comprehensive leak detection scan initiated'
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error starting scan:', error)
      toast({
        title: 'Scan Failed',
        description: error instanceof Error ? error.message : 'Failed to start scan',
        variant: 'destructive'
      })
    } finally {
      setIsStarting(false)
    }
  }

  const stopScan = async () => {
    if (!activeScan) return
    
    try {
      const response = await fetch(`/api/scan/${activeScan}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setActiveScan(null)
        setScanData({
          progress: null,
          methods: null,
          insights: null,
          activities: []
        })
        toast({
          title: '⏹️ Scan Stopped',
          description: 'Scan stopped successfully'
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error stopping scan:', error)
      toast({
        title: 'Error',
        description: 'Failed to stop scan',
        variant: 'destructive'
      })
    }
  }

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'text-red-600 bg-red-100'
      case 'HIGH': return 'text-orange-600 bg-orange-100'
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100'
      case 'LOW': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const formatElapsedTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`
    }
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  const { progress, methods, insights, activities } = scanData

  return (
    <div className="space-y-6">
      {/* Scan Control Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-6 w-6" />
                <span>Real-Time Protection Scan</span>
                <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
                  {isConnected ? (
                    <>
                      <Wifi className="h-3 w-3 mr-1" />
                      Live
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 mr-1" />
                      Offline
                    </>
                  )}
                </Badge>
              </CardTitle>
              <CardDescription>
                Comprehensive leak detection across multiple platforms and search engines
              </CardDescription>
            </div>
            <div className="flex items-center space-x-3">
              {!activeScan ? (
                <>
                  <select
                    value={selectedProfile}
                    onChange={(e) => setSelectedProfile(e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm"
                  >
                    {brandProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.brandName}
                      </option>
                    ))}
                  </select>
                  <Button onClick={startScan} disabled={isStarting}>
                    {isStarting ? (
                      <>
                        <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Start Scan
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button 
                  variant="destructive" 
                  onClick={stopScan}
                  disabled={!progress?.isRunning}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop Scan
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        {progress && (
          <CardContent>
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {progress.currentActivity}
                  </span>
                  <span className="text-muted-foreground">
                    {progress.progress}% • {formatElapsedTime(progress.elapsedMinutes)}
                  </span>
                </div>
                <Progress value={progress.progress} className="h-2" />
              </div>
              
              {/* Status Badges */}
              <div className="flex items-center space-x-3">
                <Badge variant={progress.isRunning ? 'default' : 'secondary'}>
                  {progress.isRunning ? '🔴 LIVE' : '⏹️ STOPPED'}
                </Badge>
                <Badge variant="outline">
                  Phase: {progress.phase.toUpperCase()}
                </Badge>
                {insights && (
                  <Badge className={getRiskLevelColor(insights.riskLevel)}>
                    Risk: {insights.riskLevel}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Live Insights Grid */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <InsightCard
            icon={<Search className="h-4 w-4" />}
            label="Links analysed"
            value={insights.linksAnalysed}
            isLive={progress?.isRunning}
            change="+12"
          />
          <InsightCard
            icon={<Globe className="h-4 w-4" />}
            label="Leaking sites"
            value={insights.leakingSites}
            alert={insights.leakingSites > 0}
          />
          <InsightCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Leaks found"
            value={insights.leaksFound}
            alert={insights.leaksFound > 0}
          />
          <InsightCard
            icon={<Image className="h-4 w-4" />}
            label="Images scanned"
            value={insights.imagesScanned}
            isLive={progress?.phase === 'verifying'}
          />
          <InsightCard
            icon={<Mail className="h-4 w-4" />}
            label="DMCA contacts"
            value={insights.dmcaContactsFound}
          />
          <InsightCard
            icon={<Clock className="h-4 w-4" />}
            label="Est. removal"
            value={insights.estimatedRemovalTime}
          />
        </div>
      )}

      {/* Scan Methods Progress */}
      {methods && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Methods Progress</CardTitle>
            <CardDescription>Detection methods and their completion status</CardDescription>
          </CardHeader>
          <CardContent>
            <ScanMethodsGrid methods={methods} />
          </CardContent>
        </Card>
      )}

      {/* Activity Feed */}
      <ActivityFeed activities={activities} />
    </div>
  )
}