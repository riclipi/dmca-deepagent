
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'

interface StatsCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  description?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  trend,
  className 
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2 }}
    >
      <Card className={`hover:shadow-lg transition-all duration-200 ${className}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {typeof value === 'number' ? (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {value.toLocaleString()}
              </motion.span>
            ) : (
              value
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">
              {description}
            </p>
          )}
          {trend && (
            <div className={`text-xs mt-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? '+' : ''}{trend.value}% em relação ao mês anterior
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
