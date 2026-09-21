'use client'

import { clsx } from 'clsx'
import type { MouseEventHandler, ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'spotlight'
  hover?: boolean
  onClick?: MouseEventHandler<HTMLDivElement>
}

export function Card({ children, className, variant = 'default', hover = true, onClick }: CardProps) {
  const baseClasses = clsx(
    'transition-all duration-200',
    variant === 'default' && 'bg-surface-1 border border-hairline-soft rounded-xl p-5',
    variant === 'spotlight' && 'relative overflow-hidden bg-surface-1 rounded-2xl p-8 border border-white/10 before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_top,_var(--gradient-violet)_0%,_var(--gradient-magenta)_50%,_transparent_70%)] before:opacity-20',
    hover && 'hover:border-hairline hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.6)]',
    onClick && 'cursor-pointer',
    className
  )

  return (
    <div className={baseClasses} onClick={onClick}>
      {children}
    </div>
  )
}