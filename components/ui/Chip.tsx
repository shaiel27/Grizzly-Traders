import Link from 'next/link'
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface ChipProps {
  children: ReactNode
  className?: string
  active?: boolean
  onClick?: () => void
  href?: string
  icon?: ReactNode
}

export function Chip({ children, className, active = false, onClick, href, icon }: ChipProps) {
  const interactive = Boolean(onClick || href)
  const classes = clsx(
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-150',
    'bg-surface-1 border border-hairline-soft text-ink-muted',
    active && 'border-accent-blue text-ink bg-accent-blue/10',
    !active && interactive && 'hover:border-accent-blue hover:text-ink',
    interactive && 'cursor-pointer',
    className
  )

  if (href) {
    return (
      <Link href={href} className={classes}>
        {icon}
        {children}
      </Link>
    )
  }

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-pressed={active}>
        {icon}
        {children}
      </button>
    )
  }

  return (
    <span className={classes}>
      {icon}
      {children}
    </span>
  )
}
