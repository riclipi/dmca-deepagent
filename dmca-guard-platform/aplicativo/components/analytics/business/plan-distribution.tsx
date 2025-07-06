'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Users, Crown, Zap, Rocket } from 'lucide-react'
import { Loader2 } from 'lucide-react'

interface PlanData {
  name: string
  count: number
  percentage: number
  revenue: number
  icon: React.ReactNode
  color: string
}

export function PlanDistribution() {
  const [data, setData] = useState<PlanData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)

  useEffect(() => {
    // Simulate data fetch
    setTimeout(() => {
      const planData: PlanData[] = [
        {
          name: 'Free',
          count: 450,
          percentage: 45,
          revenue: 0,
          icon: <Users className="h-5 w-5" />,
          color: 'text-gray-500'
        },
        {
          name: 'Basic',
          count: 300,
          percentage: 30,
          revenue: 8970,
          icon: <Zap className="h-5 w-5" />,
          color: 'text-blue-500'
        },
        {
          name: 'Premium',
          count: 200,
          percentage: 20,
          revenue: 15960,
          icon: <Crown className="h-5 w-5" />,
          color: 'text-purple-500'
        },
        {
          name: 'Enterprise',
          count: 50,
          percentage: 5,
          revenue: 14950,
          icon: <Rocket className="h-5 w-5" />,
          color: 'text-orange-500'
        }
      ]
      
      setData(planData)
      setTotalUsers(planData.reduce((sum, plan) => sum + plan.count, 0))
      setTotalRevenue(planData.reduce((sum, plan) => sum + plan.revenue, 0))
      setIsLoading(false)
    }, 1000)
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan Distribution</CardTitle>
        <CardDescription>
          User distribution across subscription plans
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 pb-4 border-b">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{totalUsers.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                <p className="text-2xl font-bold">R$ {totalRevenue.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-4">
              {data.map((plan) => (
                <div key={plan.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={plan.color}>{plan.icon}</div>
                      <div>
                        <p className="font-medium">{plan.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {plan.count} users • R$ {plan.revenue.toLocaleString()}/mo
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium">{plan.percentage}%</span>
                  </div>
                  <Progress value={plan.percentage} className="h-2" />
                </div>
              ))}
            </div>

            <div className="pt-4 border-t">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold">R$ {(totalRevenue / totalUsers).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Avg. Revenue per User</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{((data[0].count / totalUsers) * 100).toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">Free to Paid Ratio</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}