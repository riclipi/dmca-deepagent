import * as React from "react"
import { cn } from "@/lib/utils"
import { motion, MotionProps } from "framer-motion"

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement>, MotionProps {
  variant?: 'default' | 'purple' | 'pink' | 'blue'
  blur?: 'sm' | 'md' | 'lg'
  glow?: boolean
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', blur = 'md', glow = false, children, ...props }, ref) => {
    const blurClasses = {
      sm: 'backdrop-blur-sm',
      md: 'backdrop-blur-md',
      lg: 'backdrop-blur-lg'
    }

    const variantClasses = {
      default: 'bg-white/5 border-white/10',
      purple: 'bg-primary-500/10 border-primary-500/20',
      pink: 'bg-secondary-500/10 border-secondary-500/20',
      blue: 'bg-accent-blue-500/10 border-accent-blue-500/20'
    }

    const glowClasses = {
      default: 'hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]',
      purple: 'hover:shadow-[0_0_30px_rgba(139,92,246,0.3)]',
      pink: 'hover:shadow-[0_0_30px_rgba(236,72,153,0.3)]',
      blue: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]'
    }

    return (
      <motion.div
        ref={ref}
        className={cn(
          "rounded-xl border transition-all duration-300",
          blurClasses[blur],
          variantClasses[variant],
          glow && glowClasses[variant],
          "shadow-lg",
          className
        )}
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
GlassCard.displayName = "GlassCard"

const GlassCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
GlassCardHeader.displayName = "GlassCardHeader"

const GlassCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
GlassCardTitle.displayName = "GlassCardTitle"

const GlassCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
GlassCardDescription.displayName = "GlassCardDescription"

const GlassCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
GlassCardContent.displayName = "GlassCardContent"

const GlassCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
GlassCardFooter.displayName = "GlassCardFooter"

export { GlassCard, GlassCardHeader, GlassCardFooter, GlassCardTitle, GlassCardDescription, GlassCardContent }