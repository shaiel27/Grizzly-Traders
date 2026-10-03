'use client'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Slot } from '@radix-ui/react-slot'
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { children, variant = 'primary', size = 'md', loading = false, asChild = false, className, disabled, ...props },
    ref
  ) => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 rounded-full disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      // Also animates shadow + scale, so it needs its own explicit property list (twMerge drops the base transition-colors in favor of this one)
      primary: 'bg-primary text-primary-on hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-[0.98] transition-[color,background-color,box-shadow,transform] duration-150',
      secondary: 'bg-surface-1 text-ink border border-hairline hover:border-[rgb(64,64,64)] hover:bg-surface-2',
      accent: 'bg-accent-blue text-canvas hover:bg-accent-blue-hover',
      ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base',
    }

    const Comp = asChild ? Slot : 'button'
    // twMerge lets callers override base utilities (e.g. `hidden` over the base `inline-flex`)
    const classes = twMerge(clsx(baseClasses, variants[variant], sizes[size], className))

    if (asChild) {
      return (
        <Comp ref={ref} className={classes} disabled={disabled || loading} {...props}>
          {children}
        </Comp>
      )
    }

    return (
      <Comp
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin motion-reduce:animate-none h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </Comp>
    )
  }
)

Button.displayName = 'Button'

export { Button }