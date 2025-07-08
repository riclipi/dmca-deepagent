'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TimelineItem {
  title: string
  description: string
  icon?: React.ComponentType<{ className?: string }>
  color?: 'purple' | 'pink' | 'blue'
}

interface TimelineProps {
  items: TimelineItem[]
  className?: string
}

export function Timeline({ items, className = '' }: TimelineProps) {
  const colorClasses = {
    purple: {
      bg: 'bg-primary-500/20',
      border: 'border-primary-500',
      text: 'text-primary-500',
      glow: 'shadow-[0_0_20px_rgba(139,92,246,0.5)]'
    },
    pink: {
      bg: 'bg-secondary-500/20',
      border: 'border-secondary-500',
      text: 'text-secondary-500',
      glow: 'shadow-[0_0_20px_rgba(236,72,153,0.5)]'
    },
    blue: {
      bg: 'bg-accent-blue-500/20',
      border: 'border-accent-blue-500',
      text: 'text-accent-blue-500',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.5)]'
    }
  }

  return (
    <div className={cn('relative', className)}>
      {/* Vertical line */}
      <div className="absolute left-8 top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary-500/0 via-primary-500/50 to-primary-500/0 md:left-1/2 md:-translate-x-1/2" />
      
      <div className="space-y-12">
        {items.map((item, index) => {
          const color = item.color || (index % 3 === 0 ? 'purple' : index % 3 === 1 ? 'pink' : 'blue')
          const colors = colorClasses[color]
          const isEven = index % 2 === 0
          
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: isEven ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={cn(
                'relative flex items-center',
                'md:justify-center'
              )}
            >
              {/* Mobile layout */}
              <div className="flex items-start gap-4 w-full md:hidden">
                {/* Icon */}
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className={cn(
                    'w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0',
                    'glass-dark border-2',
                    colors.border,
                    'relative z-10'
                  )}
                >
                  {item.icon && <item.icon className={cn('h-8 w-8', colors.text)} />}
                  {!item.icon && (
                    <span className={cn('text-2xl font-bold', colors.text)}>{index + 1}</span>
                  )}
                  
                  {/* Glow effect */}
                  <div className={cn(
                    'absolute inset-0 rounded-2xl opacity-50',
                    colors.glow
                  )} />
                </motion.div>
                
                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
              
              {/* Desktop layout */}
              <div className={cn(
                'hidden md:flex items-center gap-8 w-full',
                isEven ? 'flex-row-reverse' : ''
              )}>
                {/* Content */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className={cn(
                    'flex-1 glass-dark p-6 rounded-2xl',
                    isEven ? 'text-right' : 'text-left'
                  )}
                >
                  <h3 className="text-2xl font-semibold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </motion.div>
                
                {/* Icon */}
                <motion.div
                  whileHover={{ scale: 1.2, rotate: 360 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0',
                    'glass-dark border-4',
                    colors.border,
                    'relative z-10'
                  )}
                >
                  {item.icon && <item.icon className={cn('h-10 w-10', colors.text)} />}
                  {!item.icon && (
                    <span className={cn('text-3xl font-bold', colors.text)}>{index + 1}</span>
                  )}
                  
                  {/* Pulse animation */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.2, 0.5]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                    className={cn(
                      'absolute inset-0 rounded-full',
                      colors.bg
                    )}
                  />
                </motion.div>
                
                {/* Empty space for the other side */}
                <div className="flex-1" />
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}