'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { Loader2 } from 'lucide-react'

export function ViolationsByKeyword() {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate data fetch
    setTimeout(() => {
      setData([
        { keyword: 'brand name', count: 45 },
        { keyword: 'product X', count: 38 },
        { keyword: 'logo', count: 32 },
        { keyword: 'campaign 2024', count: 28 },
        { keyword: 'slogan', count: 25 },
        { keyword: 'trademark', count: 22 },
        { keyword: 'model Y', count: 18 },
        { keyword: 'design', count: 15 },
        { keyword: 'pattern', count: 12 },
        { keyword: 'copyright', count: 10 }
      ])
      setIsLoading(false)
    }, 1000)
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 Keywords</CardTitle>
        <CardDescription>
          Most frequently violated keywords and terms
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical">
              <XAxis type="number" />
              <YAxis 
                dataKey="keyword" 
                type="category" 
                width={100}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <p className="text-sm font-medium">{payload[0].payload.keyword}</p>
                        <p className="text-sm text-muted-foreground">
                          {payload[0].value} violations
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}