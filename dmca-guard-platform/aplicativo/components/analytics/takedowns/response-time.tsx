'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { Loader2 } from 'lucide-react'

export function TakedownResponseTime() {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate data fetch
    setTimeout(() => {
      setData([
        { platform: 'Google', avgTime: 12, minTime: 2, maxTime: 24 },
        { platform: 'Facebook', avgTime: 18, minTime: 6, maxTime: 36 },
        { platform: 'Instagram', avgTime: 16, minTime: 4, maxTime: 32 },
        { platform: 'Twitter', avgTime: 8, minTime: 1, maxTime: 16 },
        { platform: 'YouTube', avgTime: 24, minTime: 12, maxTime: 48 },
        { platform: 'TikTok', avgTime: 20, minTime: 8, maxTime: 40 }
      ])
      setIsLoading(false)
    }, 1000)
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Response Time by Platform</CardTitle>
        <CardDescription>
          Average time to content removal (in hours)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <XAxis 
                dataKey="platform" 
                angle={-45}
                textAnchor="end"
                height={60}
                fontSize={12}
              />
              <YAxis 
                label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                fontSize={12}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <p className="text-sm font-medium">{payload[0].payload.platform}</p>
                        <div className="space-y-1 mt-1">
                          <p className="text-xs">Average: {payload[0].value}h</p>
                          <p className="text-xs text-muted-foreground">
                            Range: {payload[0].payload.minTime}h - {payload[0].payload.maxTime}h
                          </p>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="avgTime" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}