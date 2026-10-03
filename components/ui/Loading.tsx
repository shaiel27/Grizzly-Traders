'use client'

import { clsx } from 'clsx'

interface LoadingProps {
  variant?: 'spinner' | 'skeleton' | 'cards' | 'article' | 'home'
  count?: number
  className?: string
}

// Shared card shape for the 'home' and 'cards' variants
function CardSkeleton() {
  return (
    <div className="card animate-pulse motion-reduce:animate-none" aria-hidden="true">
      <div className="aspect-[16/10] bg-surface-2 rounded-lg mb-4" />
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-20 bg-surface-2 rounded-full" />
        <div className="h-5 w-16 bg-surface-2 rounded-full" />
      </div>
      <div className="h-6 bg-surface-2 rounded w-4/5 mb-2" />
      <div className="h-4 bg-surface-2 rounded w-3/5 mb-2" />
      <div className="h-4 bg-surface-2 rounded w-2/5" />
    </div>
  )
}

// Shared bar for the 'article' skeleton: a plain rounded block, sized per call site
function Bar({ className }: { className: string }) {
  return <div className={clsx('animate-pulse motion-reduce:animate-none rounded bg-surface-2', className)} />
}

export function Loading({ variant = 'spinner', count = 3, className }: LoadingProps) {
  if (variant === 'spinner') {
    return (
      <div className={clsx('flex items-center justify-center py-12', className)} role="status" aria-live="polite">
        <div className="relative">
          <svg className="w-12 h-12 text-accent-blue animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
        </div>
        <span className="sr-only">Cargando contenido…</span>
      </div>
    )
  }

  if (variant === 'skeleton') {
    return (
      <div className={clsx('space-y-6', className)} role="status" aria-live="polite">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="card animate-pulse motion-reduce:animate-none" aria-hidden="true">
            <div className="aspect-[16/10] bg-surface-2 rounded-lg mb-4" />
            <div className="h-4 bg-surface-2 rounded w-3/4 mb-2" />
            <div className="h-4 bg-surface-2 rounded w-1/2 mb-2" />
            <div className="h-3 bg-surface-2 rounded w-1/3" />
          </div>
        ))}
        <span className="sr-only">Cargando contenido…</span>
      </div>
    )
  }

  if (variant === 'cards') {
    return (
      <div className={clsx('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)} role="status" aria-live="polite">
        {[...Array(count)].map((_, i) => <CardSkeleton key={i} />)}
        <span className="sr-only">Cargando contenido…</span>
      </div>
    )
  }

  if (variant === 'home') {
    // Mirrors app/(site)/page.tsx: hero text, stats bar, breaking post, news grid, one category row
    return (
      <div className={clsx('w-full', className)} role="status" aria-live="polite">
        <div aria-hidden="true">
          {/* Hero */}
          <div className="mb-8 flex flex-col gap-5">
            <Bar className="h-10 w-full max-w-xl sm:h-12" />
            <Bar className="h-4 w-full max-w-2xl" />
            <Bar className="h-4 w-3/4 max-w-xl" />
          </div>

          {/* Stats bar */}
          <div className="mb-8 rounded-xl border border-hairline-soft bg-surface-1/50 p-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Bar className="size-9 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Bar className="h-4 w-12" />
                    <Bar className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Breaking post */}
          <div className="mb-8 grid gap-0 overflow-hidden rounded-2xl border border-hairline lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col gap-4 p-5 md:p-6">
              <Bar className="h-5 w-24 rounded-full" />
              <Bar className="h-8 w-full" />
              <Bar className="h-4 w-2/3" />
              <div className="grid grid-cols-3 gap-2">
                {[...Array(3)].map((_, i) => <Bar key={i} className="h-14 rounded-lg" />)}
              </div>
            </div>
            <Bar className="min-h-[220px] rounded-none" />
          </div>

          {/* News grid */}
          <div className="mb-4 flex items-end justify-between">
            <Bar className="h-6 w-40" />
            <Bar className="h-4 w-24" />
          </div>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
          </div>

          {/* One category row, representative of "Explorar por Categoría" */}
          <Bar className="mb-4 h-6 w-48" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </div>
        <span className="sr-only">Cargando portal…</span>
      </div>
    )
  }

  if (variant === 'article') {
    // Mirrors app/(site)/articulos/[slug]/page.tsx: breadcrumb, chips, h1, meta row, cover, prose lines
    return (
      <div className={clsx('w-full', className)} role="status" aria-live="polite">
        <div aria-hidden="true">
          <div className="mb-6 flex items-center gap-1.5">
            <Bar className="h-3 w-12" />
            <div className="size-1 rounded-full bg-surface-2" />
            <Bar className="h-3 w-16" />
            <div className="size-1 rounded-full bg-surface-2" />
            <Bar className="h-3 w-28" />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Bar className="h-6 w-24 rounded-full" />
            <Bar className="h-6 w-20 rounded-full" />
          </div>

          <div className="mb-4 space-y-3">
            <Bar className="h-9 w-full sm:h-11" />
            <Bar className="h-9 w-2/3 sm:h-11" />
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Bar className="size-8 rounded-full" />
              <Bar className="h-3 w-24" />
            </div>
            <Bar className="h-3 w-24" />
            <Bar className="h-3 w-16" />
          </div>

          <Bar className="mb-8 aspect-video w-full rounded-2xl" />

          <div className="max-w-[68ch] space-y-3">
            {[...Array(6)].map((_, i) => (
              <Bar key={i} className={clsx('h-4', i % 3 === 2 ? 'w-2/3' : 'w-full')} />
            ))}
          </div>
        </div>
        <span className="sr-only">Cargando artículo…</span>
      </div>
    )
  }

  return null
}