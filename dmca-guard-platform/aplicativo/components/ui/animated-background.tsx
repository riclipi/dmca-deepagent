'use client'

import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface AnimatedBackgroundProps {
  variant?: 'gradient' | 'particles' | 'grid'
  className?: string
}

export function AnimatedBackground({ variant = 'gradient', className = '' }: AnimatedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (variant === 'particles' && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      const particles: Array<{
        x: number
        y: number
        vx: number
        vy: number
        radius: number
        opacity: number
      }> = []

      // Create particles
      for (let i = 0; i < 50; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: Math.random() * 2 + 1,
          opacity: Math.random() * 0.5 + 0.2
        })
      }

      function animate() {
        if (!ctx || !canvas) return
        
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        particles.forEach((particle) => {
          particle.x += particle.vx
          particle.y += particle.vy

          if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1
          if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1

          ctx.beginPath()
          ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(139, 92, 246, ${particle.opacity})`
          ctx.fill()
        })

        requestAnimationFrame(animate)
      }

      animate()

      const handleResize = () => {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }

      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [variant])

  if (variant === 'gradient') {
    return (
      <div className={`absolute inset-0 overflow-hidden ${className}`}>
        <div className="absolute inset-0 gradient-bg-animated opacity-20" />
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              'radial-gradient(circle at 20% 80%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 20%, rgba(236, 72, 153, 0.3) 0%, transparent 50%)',
              'radial-gradient(circle at 40% 40%, rgba(59, 130, 246, 0.3) 0%, transparent 50%)',
              'radial-gradient(circle at 20% 80%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)'
            ]
          }}
          transition={{
            duration: 10,
            ease: 'linear',
            repeat: Infinity
          }}
        />
      </div>
    )
  }

  if (variant === 'particles') {
    return (
      <div className={`absolute inset-0 overflow-hidden ${className}`}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ opacity: 0.5 }}
        />
      </div>
    )
  }

  if (variant === 'grid') {
    return (
      <div className={`absolute inset-0 overflow-hidden ${className}`}>
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"
          animate={{
            opacity: [0.5, 0.8, 0.5]
          }}
          transition={{
            duration: 4,
            ease: 'easeInOut',
            repeat: Infinity
          }}
        />
      </div>
    )
  }

  return null
}

