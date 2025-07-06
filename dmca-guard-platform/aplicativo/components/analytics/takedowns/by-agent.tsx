'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Loader2 } from 'lucide-react'

export function TakedownByAgent() {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate data fetch
    setTimeout(() => {
      setData([
        { agent: 'Known Sites', performance: 85, fullMark: 100 },
        { agent: 'Discovery', performance: 75, fullMark: 100 },
        { agent: 'Image Search', performance: 70, fullMark: 100 },
        { agent: 'Social Media', performance: 90, fullMark: 100 },
        { agent: 'Legal', performance: 95, fullMark: 100 },
        { agent: 'Marketplace', performance: 80, fullMark: 100 }
      ])
      setIsLoading(false)
    }, 1000)
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Performance</CardTitle>
        <CardDescription>
          Success rate by AI agent type
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={data}>
              <PolarGrid />
              <PolarAngleAxis dataKey="agent" fontSize={12} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar
                name="Performance"
                dataKey="performance"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <p className="text-sm font-medium">{payload[0].payload.agent}</p>
                        <p className="text-sm text-muted-foreground">
                          Performance: {payload[0].value}%
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}