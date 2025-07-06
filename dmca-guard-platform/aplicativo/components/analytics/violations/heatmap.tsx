'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface ViolationsHeatmapProps {
  period: string
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function ViolationsHeatmap({ period }: ViolationsHeatmapProps) {
  const [data, setData] = useState<number[][]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate data fetch
    setTimeout(() => {
      // Generate random heatmap data
      const heatmapData = DAYS.map(() => 
        HOURS.map(() => Math.floor(Math.random() * 100))
      )
      setData(heatmapData)
      setIsLoading(false)
    }, 1000)
  }, [period])

  const getColor = (value: number) => {
    if (value === 0) return 'bg-gray-100'
    if (value < 20) return 'bg-blue-100'
    if (value < 40) return 'bg-blue-200'
    if (value < 60) return 'bg-blue-300'
    if (value < 80) return 'bg-blue-400'
    return 'bg-blue-500'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Heatmap</CardTitle>
        <CardDescription>
          Violation detection patterns by day and hour
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-1">
              <div className="w-12" /> {/* Spacer for day labels */}
              {HOURS.map((hour) => (
                <div key={hour} className="flex-1 text-center text-xs text-muted-foreground">
                  {hour}
                </div>
              ))}
            </div>
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="flex gap-1 items-center">
                <div className="w-12 text-sm text-muted-foreground">{day}</div>
                {HOURS.map((hour) => (
                  <div
                    key={`${day}-${hour}`}
                    className={`flex-1 aspect-square rounded-sm ${getColor(data[dayIndex]?.[hour] || 0)}`}
                    title={`${day} ${hour}:00 - ${data[dayIndex]?.[hour] || 0} violations`}
                  />
                ))}
              </div>
            ))}
            <div className="flex items-center gap-4 justify-center mt-4">
              <span className="text-xs text-muted-foreground">Less</span>
              <div className="flex gap-1">
                {['bg-gray-100', 'bg-blue-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500'].map((color) => (
                  <div key={color} className={`w-4 h-4 rounded-sm ${color}`} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">More</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}