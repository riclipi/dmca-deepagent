'use client'

import React from 'react'
import { KpiCard } from './kpi-card'
import { 
  Shield, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle,
  FileSearch,
  Users,
  Clock,
  Target
} from 'lucide-react'

interface KpiGridProps {
  data: {
    successRate: number
    coverage: number
    takedownsSent: number
    totalDetectedContent: number
    detectedContentLast30Days: number
    successfulTakedowns: number
    activeBrandProfiles: number
    activeMonitoringSessions: number
    effectiveness: number
    trends: {
      detections: 'up' | 'down' | 'neutral'
      takedowns: 'up' | 'down' | 'neutral'
      effectiveness: 'up' | 'down' | 'neutral'
    }
  }
}

export function KpiGrid({ data }: KpiGridProps) {
  const kpis = [
    {
      title: 'Total Violations',
      value: data.totalDetectedContent.toLocaleString(),
      subtitle: 'All time',
      icon: AlertCircle,
      trend: data.trends.detections,
      trendValue: `${data.detectedContentLast30Days} last 30 days`
    },
    {
      title: 'Success Rate',
      value: `${data.successRate}%`,
      subtitle: 'Takedown success',
      icon: CheckCircle,
      trend: data.trends.takedowns
    },
    {
      title: 'Detection Time',
      value: '< 24h',
      subtitle: 'Average time to detect',
      icon: Clock,
      trend: 'neutral' as const
    },
    {
      title: 'Coverage',
      value: data.coverage.toLocaleString(),
      subtitle: 'Sites monitored',
      icon: Shield,
      trend: 'up' as const
    },
    {
      title: 'Takedowns Sent',
      value: data.takedownsSent.toLocaleString(),
      subtitle: 'Total requests',
      icon: TrendingUp,
      trend: data.trends.takedowns
    },
    {
      title: 'Active Profiles',
      value: data.activeBrandProfiles,
      subtitle: 'Brand profiles',
      icon: Users,
      trend: 'neutral' as const
    },
    {
      title: 'Active Scans',
      value: data.activeMonitoringSessions,
      subtitle: 'Running now',
      icon: FileSearch,
      trend: 'neutral' as const
    },
    {
      title: 'Effectiveness',
      value: `${data.effectiveness}%`,
      subtitle: 'Overall score',
      icon: Target,
      trend: data.trends.effectiveness
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, index) => (
        <KpiCard key={index} {...kpi} />
      ))}
    </div>
  )
}