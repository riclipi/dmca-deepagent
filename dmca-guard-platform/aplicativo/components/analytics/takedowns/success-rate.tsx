'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

interface TakedownSuccessRateProps {
  data: {
    successRate: number
    successfulTakedowns: number
    takedownsSent: number
    takedownsByStatus: Record<string, number>
  }
}

export function TakedownSuccessRate({ data }: TakedownSuccessRateProps) {
  const pending = data.takedownsByStatus['Pendente'] || 0
  const failed = data.takedownsByStatus['Falhou'] || 0
  const rejected = data.takedownsByStatus['Rejeitado'] || 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Takedown Success Rate</CardTitle>
        <CardDescription>
          Overall performance of takedown requests
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold">{data.successRate}%</span>
            <span className="text-sm text-muted-foreground">
              {data.successfulTakedowns} of {data.takedownsSent}
            </span>
          </div>
          <Progress value={data.successRate} className="h-3" />
        </div>

        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Successful</span>
            </div>
            <span className="text-sm font-medium">{data.successfulTakedowns}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">Pending</span>
            </div>
            <span className="text-sm font-medium">{pending}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm">Failed/Rejected</span>
            </div>
            <span className="text-sm font-medium">{failed + rejected}</span>
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-500">
                {data.successRate > 80 ? 'Excellent' : data.successRate > 60 ? 'Good' : 'Needs Improvement'}
              </p>
              <p className="text-xs text-muted-foreground">Performance</p>
            </div>
            <div>
              <p className="text-2xl font-bold">24h</p>
              <p className="text-xs text-muted-foreground">Avg. Response</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}