import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { motion, MotionProps } from "framer-motion"

const glowButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        purple: "bg-primary-500 text-white hover:bg-primary-600",
        pink: "bg-secondary-500 text-white hover:bg-secondary-600",
        blue: "bg-accent-blue-500 text-white hover:bg-accent-blue-600",
        gradient: "bg-gradient-to-r from-primary-500 to-secondary-500 text-white",
        outline: "border-2 border-primary-500 bg-transparent text-primary-500 hover:bg-primary-500 hover:text-white",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
      glow: {
        none: "",
        sm: "shadow-[0_0_15px_rgba(139,92,246,0.5)]",
        md: "shadow-[0_0_25px_rgba(139,92,246,0.6)]",
        lg: "shadow-[0_0_35px_rgba(139,92,246,0.7)]",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      glow: "none"
    },
  }
)

interface GlowButtonProps extends 
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof glowButtonVariants> {
  asChild?: boolean
  ripple?: boolean
}

const GlowButton = React.forwardRef<HTMLButtonElement, GlowButtonProps & Partial<MotionProps>>(
  ({ className, variant, size, glow, asChild = false, ripple = true, children, whileHover, whileTap, ...props }, ref) => {
    const [ripples, setRipples] = React.useState<Array<{ x: number; y: number; id: number }>>([])
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (ripple) {
        const button = e.currentTarget
        const rect = button.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const id = Date.now()
        
        setRipples(prev => [...prev, { x, y, id }])
        setTimeout(() => {
          setRipples(prev => prev.filter(r => r.id !== id))
        }, 600)
      }
      
      props.onClick?.(e)
    }

    if (asChild) {
      return (
        <Slot
          className={cn(glowButtonVariants({ variant, size, glow, className }))}
          ref={ref}
          onClick={handleClick}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <motion.button
        className={cn(glowButtonVariants({ variant, size, glow, className }))}
        ref={ref}
        whileHover={whileHover || { scale: 1.05 }}
        whileTap={whileTap || { scale: 0.95 }}
        onClick={handleClick}
        {...props}
      >
        {/* Glow effect overlay */}
        {glow !== 'none' && (
          <motion.div
            className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: variant === 'gradient' 
                ? 'radial-gradient(circle at center, rgba(139,92,246,0.3), transparent 70%)'
                : variant === 'pink'
                ? 'radial-gradient(circle at center, rgba(236,72,153,0.3), transparent 70%)'
                : variant === 'blue'
                ? 'radial-gradient(circle at center, rgba(59,130,246,0.3), transparent 70%)'
                : 'radial-gradient(circle at center, rgba(139,92,246,0.3), transparent 70%)',
              filter: 'blur(20px)'
            }}
          />
        )}
        
        {/* Ripple effects */}
        {ripple && ripples.map(({ x, y, id }) => (
          <span
            key={id}
            className="absolute rounded-full bg-white/30 animate-ping"
            style={{
              left: x - 10,
              top: y - 10,
              width: 20,
              height: 20,
            }}
          />
        ))}
        
        {/* Button content */}
        <span className="relative z-10">{children}</span>
      </motion.button>
    )
  }
)
GlowButton.displayName = "GlowButton"

export { GlowButton, glowButtonVariants }