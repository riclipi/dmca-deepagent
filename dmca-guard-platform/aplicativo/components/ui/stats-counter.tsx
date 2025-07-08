'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { cn } from '@/lib/utils'

interface StatsCounterProps {
  end: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
  formatNumber?: (num: number) => string
}

export function StatsCounter({
  end,
  duration = 2,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
  formatNumber
}: StatsCounterProps) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.5 })

  useEffect(() => {
    if (!isInView) return

    let startTime: number | null = null
    const startValue = 0
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / (duration * 1000), 1)
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentCount = Math.floor(easeOutQuart * (end - startValue) + startValue)
      
      setCount(currentCount)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setCount(end)
      }
    }
    
    requestAnimationFrame(animate)
  }, [end, duration, isInView])

  const displayValue = formatNumber 
    ? formatNumber(count) 
    : count.toFixed(decimals)

  return (
    <motion.span
      ref={ref}
      className={cn('tabular-nums', className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5 }}
    >
      {prefix}{displayValue}{suffix}
    </motion.span>
  )
}

interface AnimatedStatsProps {
  stats: Array<{
    label: string
    value: number
    prefix?: string
    suffix?: string
    decimals?: number
    description?: string
    icon?: React.ComponentType<{ className?: string }>
    color?: 'purple' | 'pink' | 'blue'
  }>
  className?: string
}

export function AnimatedStats({ stats, className = '' }: AnimatedStatsProps) {
  const colorClasses = {
    purple: 'text-primary-500',
    pink: 'text-secondary-500',
    blue: 'text-accent-blue-500'
  }

  const bgClasses = {
    purple: 'bg-primary-500/10',
    pink: 'bg-secondary-500/10',
    blue: 'bg-accent-blue-500/10'
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6', className)}>
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          {stat.icon && (
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4',
              bgClasses[stat.color || 'purple']
            )}>
              <stat.icon className={cn('h-6 w-6', colorClasses[stat.color || 'purple'])} />
            </div>
          )}
          
          <div className="text-3xl md:text-4xl font-bold mb-2">
            <StatsCounter
              end={stat.value}
              prefix={stat.prefix}
              suffix={stat.suffix}
              decimals={stat.decimals}
              className={stat.color ? colorClasses[stat.color] : ''}
            />
          </div>
          
          <div className="text-lg font-semibold text-foreground mb-1">
            {stat.label}
          </div>
          
          {stat.description && (
            <div className="text-sm text-muted-foreground">
              {stat.description}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}