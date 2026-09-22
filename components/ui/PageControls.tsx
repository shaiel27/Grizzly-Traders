'use client'

import { clsx } from 'clsx'
import { pageCount, pageWindow } from '@/lib/pagination'

interface PageControlsProps {
  // 0-based index of the current page
  page: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  // Accessible name of the navigation landmark
  label: string
  className?: string
}

const NAV_BUTTON =
  'flex h-8 items-center gap-1 rounded-[6px] px-2.5 text-[13px] text-ink-muted transition-colors hover:bg-surface-1 hover:text-ink disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent-blue'

// Previous / numbered pages / next. Renders nothing when everything fits on one page.
export function PageControls({ page, total, pageSize, onPageChange, label, className }: PageControlsProps) {
  const totalPages = pageCount(total, pageSize)
  if (totalPages <= 1) return null

  const current = Math.min(Math.max(0, page), totalPages - 1)
  const first = current * pageSize + 1
  const last = Math.min(total, (current + 1) * pageSize)

  return (
    <nav aria-label={label} className={clsx('flex flex-wrap items-center justify-between gap-x-6 gap-y-3', className)}>
      <p className="text-[13px] tabular-nums text-ink-muted" aria-live="polite">
        Mostrando {first} a {last} de {total}
      </p>

      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPageChange(current - 1)} disabled={current === 0} className={NAV_BUTTON}>
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            arrow_back
          </span>
          Anterior
        </button>

        <ul className="flex items-center gap-0.5">
          {pageWindow(current, totalPages).map((item, index) =>
            item === 'ellipsis' ? (
              <li key={`gap-${index}`} aria-hidden="true" className="w-6 text-center text-[13px] text-ink-subtle">
                …
              </li>
            ) : (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => onPageChange(item)}
                  aria-label={`Página ${item + 1}`}
                  aria-current={item === current ? 'page' : undefined}
                  className={clsx(
                    'h-8 min-w-8 rounded-[6px] px-2 text-[13px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                    item === current ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-1 hover:text-ink'
                  )}
                >
                  {item + 1}
                </button>
              </li>
            )
          )}
        </ul>

        <button type="button" onClick={() => onPageChange(current + 1)} disabled={current === totalPages - 1} className={NAV_BUTTON}>
          Siguiente
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            arrow_forward
          </span>
        </button>
      </div>
    </nav>
  )
}
