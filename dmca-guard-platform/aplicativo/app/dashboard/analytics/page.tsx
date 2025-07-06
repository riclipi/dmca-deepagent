'use client'

import React, { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { PeriodSelector } from '@/components/analytics/period-selector'
import { ExportMenu } from '@/components/analytics/export-menu'
import { KpiGrid } from '@/components/analytics/kpi-grid'
import { ViolationsTrendChart } from '@/components/analytics/violations/trend-chart'
import { ViolationsByPlatform } from '@/components/analytics/violations/by-platform'
import { ViolationsByKeyword } from '@/components/analytics/violations/by-keyword'
import { ViolationsHeatmap } from '@/components/analytics/violations/heatmap'
import { TakedownSuccessRate } from '@/components/analytics/takedowns/success-rate'
import { TakedownResponseTime } from '@/components/analytics/takedowns/response-time'
import { TakedownByAgent } from '@/components/analytics/takedowns/by-agent'
import { UserGrowthChart } from '@/components/analytics/business/user-growth'
import { PlanDistribution } from '@/components/analytics/business/plan-distribution'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { format as formatDate } from 'date-fns'

export type Period = 'today' | '7d' | '30d' | '90d' | 'custom'

interface AnalyticsData {
  // KPIs
  successRate: number
  coverage: number
  takedownsSent: number
  totalDetectedContent: number
  detectedContentLast30Days: number
  successfulTakedowns: number
  activeBrandProfiles: number
  activeMonitoringSessions: number
  recentNotifications: number
  
  // Distributions
  takedownsByStatus: Record<string, number>
  
  // Calculated metrics
  effectiveness: number
  averageResponseTime: number | null
  
  // Trends
  trends: {
    detections: 'up' | 'down' | 'neutral'
    takedowns: 'up' | 'down' | 'neutral'
    effectiveness: 'up' | 'down' | 'neutral'
  }
  
  // Period info
  periodStart: string
  periodEnd: string
  generatedAt: string
}

export default function AnalyticsDashboard() {
  const { data: session } = useSession()
  const [period, setPeriod] = useState<Period>('30d')
  const [customDates, setCustomDates] = useState<{ from: Date; to: Date }>()
  const [isLoading, setIsLoading] = useState(true)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Fetch analytics data
  const fetchAnalytics = async () => {
    if (!session?.user?.id) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/analytics/summary')
      if (!response.ok) throw new Error('Failed to fetch analytics')

      const data = await response.json()
      if (data.success) {
        setAnalyticsData(data.data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error('Failed to load analytics data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [session, period, customDates])

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    if (!analyticsData) {
      toast.error('No data to export')
      return
    }

    try {
      toast.info(`Exporting analytics as ${format.toUpperCase()}...`)
      
      const { AnalyticsExportService } = await import('@/lib/services/analytics-export.service')
      
      const exportOptions = {
        format,
        period,
        customDates,
        includeCharts: true,
        includeRawData: true
      }
      
      let blob: Blob
      let filename: string
      
      switch (format) {
        case 'csv':
          blob = await AnalyticsExportService.exportToCSV(analyticsData, exportOptions)
          filename = `dmca-guard-analytics-${formatDate(new Date(), 'yyyy-MM-dd')}.csv`
          break
        case 'excel':
          blob = await AnalyticsExportService.exportToExcel(analyticsData, exportOptions)
          filename = `dmca-guard-analytics-${formatDate(new Date(), 'yyyy-MM-dd')}.xlsx`
          break
        case 'pdf':
          blob = await AnalyticsExportService.exportToPDF(analyticsData, exportOptions)
          filename = `dmca-guard-analytics-${formatDate(new Date(), 'yyyy-MM-dd')}.pdf`
          break
      }
      
      AnalyticsExportService.downloadFile(blob, filename)
      toast.success(`Analytics exported successfully as ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error(`Failed to export analytics as ${format.toUpperCase()}`)
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into your DMCA protection performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector 
            period={period} 
            onPeriodChange={setPeriod}
            customDates={customDates}
            onCustomDatesChange={setCustomDates}
          />
          <ExportMenu onExport={handleExport} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : analyticsData ? (
        <>
          {/* KPI Grid */}
          <KpiGrid data={analyticsData} />

          {/* Tabbed Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="violations">Violations</TabsTrigger>
              <TabsTrigger value="takedowns">Takedowns</TabsTrigger>
              <TabsTrigger value="business">Business</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <ViolationsTrendChart period={period} />
                <TakedownSuccessRate data={analyticsData} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <ViolationsByPlatform />
                <ViolationsByKeyword />
              </div>
            </TabsContent>

            <TabsContent value="violations" className="space-y-4">
              <ViolationsTrendChart period={period} />
              <div className="grid gap-4 md:grid-cols-2">
                <ViolationsByPlatform />
                <ViolationsByKeyword />
              </div>
              <ViolationsHeatmap period={period} />
            </TabsContent>

            <TabsContent value="takedowns" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <TakedownSuccessRate data={analyticsData} />
                <TakedownResponseTime />
              </div>
              <TakedownByAgent />
            </TabsContent>

            <TabsContent value="business" className="space-y-4">
              <UserGrowthChart period={period} />
              <PlanDistribution />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <Card className="p-8">
          <p className="text-center text-muted-foreground">
            No analytics data available
          </p>
        </Card>
      )}
    </div>
  )
}