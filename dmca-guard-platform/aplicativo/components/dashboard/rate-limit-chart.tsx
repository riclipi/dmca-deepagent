'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import { format } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface RateLimitHistory {
  timestamp: string
  used: number
  limit: number
  endpoint?: string
}

export function RateLimitChart() {
  const [data, setData] = useState<RateLimitHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('24h')
  const [view, setView] = useState<'usage' | 'percentage'>('usage')

  useEffect(() => {
    // Simulate historical data for demo
    const generateMockData = () => {
      const now = new Date()
      const dataPoints: RateLimitHistory[] = []
      const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 1
      
      for (let i = hours; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
        const baseUsage = Math.floor(Math.random() * 50) + 20
        const spike = i === Math.floor(hours / 2) ? 30 : 0 // Spike in the middle
        
        dataPoints.push({
          timestamp: timestamp.toISOString(),
          used: baseUsage + spike + Math.floor(Math.random() * 20),
          limit: 1000
        })
      }
      
      setData(dataPoints)
      setLoading(false)
    }

    generateMockData()
  }, [timeRange])

  const formatXAxisTick = (value: string) => {
    const date = new Date(value)
    if (timeRange === '1h') {
      return format(date, 'HH:mm')
    } else if (timeRange === '24h') {
      return format(date, 'HH:00')
    } else {
      return format(date, 'MM/dd')
    }
  }

  const formatTooltipLabel = (value: string) => {
    return format(new Date(value), 'MMM dd, HH:mm')
  }

  const processedData = data.map(item => ({
    ...item,
    percentage: (item.used / item.limit) * 100,
    remaining: item.limit - item.used
  }))

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage History</CardTitle>
          <CardDescription>Loading chart data...</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Usage History</CardTitle>
            <CardDescription>
              API request patterns over time
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={view} onValueChange={(v) => setView(v as 'usage' | 'percentage')}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usage">Usage</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">24 Hours</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="line" className="w-full">
          <TabsList className="grid w-[200px] grid-cols-2">
            <TabsTrigger value="line">Line</TabsTrigger>
            <TabsTrigger value="area">Area</TabsTrigger>
          </TabsList>
          
          <TabsContent value="line" className="mt-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={processedData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatXAxisTick}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip 
                  labelFormatter={formatTooltipLabel}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                {view === 'usage' ? (
                  <>
                    <Line 
                      type="monotone" 
                      dataKey="used" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Used"
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="limit" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Limit"
                      dot={false}
                    />
                  </>
                ) : (
                  <Line 
                    type="monotone" 
                    dataKey="percentage" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Usage %"
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
          
          <TabsContent value="area" className="mt-4">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={processedData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatXAxisTick}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip 
                  labelFormatter={formatTooltipLabel}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                {view === 'usage' ? (
                  <>
                    <Area 
                      type="monotone" 
                      dataKey="used" 
                      stackId="1"
                      stroke="#3b82f6" 
                      fill="#3b82f6"
                      fillOpacity={0.6}
                      name="Used"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="remaining" 
                      stackId="1"
                      stroke="#10b981" 
                      fill="#10b981"
                      fillOpacity={0.6}
                      name="Remaining"
                    />
                  </>
                ) : (
                  <Area 
                    type="monotone" 
                    dataKey="percentage" 
                    stroke="#3b82f6" 
                    fill="#3b82f6"
                    fillOpacity={0.6}
                    name="Usage %"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}