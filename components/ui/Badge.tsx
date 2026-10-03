'use client'

import { clsx } from 'clsx'
import type { ReactNode } from 'react'

type Sentiment = 'bullish' | 'bearish' | 'neutral'

interface BadgeProps {
  sentiment: Sentiment
  className?: string
  children?: ReactNode
  dot?: boolean
}

const sentimentStyles = {
  bullish: 'text-semantic-success bg-semantic-success/10 border-semantic-success/30',
  bearish: 'text-semantic-danger bg-semantic-danger/10 border-semantic-danger/30',
  neutral: 'text-ink-muted bg-surface-2/60 border-hairline',
}

const sentimentLabels = {
  bullish: 'Alcista',
  bearish: 'Bajista',
  neutral: 'Neutral',
}

const sentimentIcons = {
  bullish: (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12l5 5 10-10" />
    </svg>
  ),
  bearish: (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M19 12l-5 5-10-10" />
    </svg>
  ),
  neutral: (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12h14" />
    </svg>
  ),
}

export function Badge({ sentiment, className, children, dot = true }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border',
        sentimentStyles[sentiment],
        className
      )}
    >
      {dot && sentimentIcons[sentiment]}
      {children || sentimentLabels[sentiment]}
    </span>
  )
}