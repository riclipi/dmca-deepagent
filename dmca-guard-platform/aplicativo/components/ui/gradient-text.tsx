import * as React from "react"
import { cn } from "@/lib/utils"
import { motion, MotionProps } from "framer-motion"

interface GradientTextProps extends React.HTMLAttributes<HTMLSpanElement>, MotionProps {
  variant?: 'purple-pink' | 'blue-purple' | 'pink-blue' | 'rainbow'
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl'
  weight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold'
  animate?: boolean
}

const GradientText = React.forwardRef<HTMLSpanElement, GradientTextProps>(
  ({ 
    className, 
    variant = 'purple-pink', 
    size = 'md', 
    weight = 'bold',
    animate = false,
    children, 
    ...props 
  }, ref) => {
    const gradients = {
      'purple-pink': 'from-primary-500 to-secondary-500',
      'blue-purple': 'from-accent-blue-500 to-primary-500',
      'pink-blue': 'from-secondary-500 to-accent-blue-500',
      'rainbow': 'from-primary-500 via-secondary-500 to-accent-blue-500'
    }

    const sizes = {
      'sm': 'text-sm',
      'md': 'text-base',
      'lg': 'text-lg',
      'xl': 'text-xl',
      '2xl': 'text-2xl',
      '3xl': 'text-3xl',
      '4xl': 'text-4xl',
      '5xl': 'text-5xl',
      '6xl': 'text-6xl'
    }

    const weights = {
      'normal': 'font-normal',
      'medium': 'font-medium',
      'semibold': 'font-semibold',
      'bold': 'font-bold',
      'extrabold': 'font-extrabold'
    }

    const Component = animate ? motion.span : 'span'

    return (
      <Component
        ref={ref}
        className={cn(
          "inline-block bg-gradient-to-r bg-clip-text text-transparent",
          gradients[variant],
          sizes[size],
          weights[weight],
          animate && "animate-shimmer bg-[length:200%_100%]",
          className
        )}
        {...(animate ? {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5 }
        } : {})}
        {...props}
      >
        {children}
      </Component>
    )
  }
)
GradientText.displayName = "GradientText"

export { GradientText }