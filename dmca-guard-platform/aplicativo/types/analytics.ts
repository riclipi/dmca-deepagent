// Analytics Types and Interfaces

export type Period = 'today' | '7d' | '30d' | '90d' | 'custom'
export type TrendDirection = 'up' | 'down' | 'neutral'

export interface AnalyticsData {
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
    detections: TrendDirection
    takedowns: TrendDirection
    effectiveness: TrendDirection
  }
  
  // Period info
  periodStart: string
  periodEnd: string
  generatedAt: string
  userId?: string
}

export interface ChartDataPoint {
  date: string
  value: number
  [key: string]: any
}

export interface ViolationTrendData {
  date: string
  violations: number
  removed: number
}

export interface PlatformDistributionData {
  name: string
  value: number
  percentage: number
}

export interface KeywordViolationData {
  keyword: string
  count: number
}

export interface ResponseTimeData {
  platform: string
  avgTime: number
  minTime: number
  maxTime: number
}

export interface AgentPerformanceData {
  agent: string
  performance: number
  fullMark: number
}

export interface UserGrowthData {
  date: string
  totalUsers: number
  newUsers: number
  activeUsers: number
}

export interface PlanDistributionData {
  name: string
  count: number
  percentage: number
  revenue: number
  icon?: React.ReactNode
  color?: string
}

export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv'
  period: Period
  customDates?: {
    from: Date
    to: Date
  }
  includeCharts?: boolean
  includeRawData?: boolean
}