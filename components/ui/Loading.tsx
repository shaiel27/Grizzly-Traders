'use client'

import { clsx } from 'clsx'

interface LoadingProps {
  variant?: 'spinner' | 'skeleton' | 'cards'
  count?: number
  className?: string
}

export function Loading({ variant = 'spinner', count = 3, className }: LoadingProps) {
  if (variant === 'spinner') {
    return (
      <div className={clsx('flex items-center justify-center py-12', className)}>
        <div className="relative">
          <svg className="w-12 h-12 text-accent-blue animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    )
  }

  if (variant === 'skeleton') {
    return (
      <div className={clsx('space-y-6', className)}>
        {[...Array(count)].map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="aspect-video bg-surface-2 rounded-lg mb-4" />
            <div className="h-4 bg-surface-2 rounded w-3/4 mb-2" />
            <div className="h-4 bg-surface-2 rounded w-1/2 mb-2" />
            <div className="h-3 bg-surface-2 rounded w-1/3" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'cards') {
    return (
      <div className={clsx('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6', className)}>
        {[...Array(count)].map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="aspect-video bg-surface-2 rounded-lg mb-4" />
            <div className="flex gap-2 mb-3">
              <div className="h-5 w-20 bg-surface-2 rounded-full" />
              <div className="h-5 w-16 bg-surface-2 rounded-full" />
            </div>
            <div className="h-6 bg-surface-2 rounded w-4/5 mb-2" />
            <div className="h-4 bg-surface-2 rounded w-3/5 mb-2" />
            <div className="h-4 bg-surface-2 rounded w-2/5" />
          </div>
        ))}
      </div>
    )
  }

  return null
}