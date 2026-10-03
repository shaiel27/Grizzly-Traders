'use client'

import { clsx } from 'clsx'
import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, id, ...rest }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const errorId = error ? `${inputId}-error` : undefined

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-ink-muted">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className={clsx(
              // Border-color + the focus ring (box-shadow), not transition-all: no layout/transform properties here
              'w-full rounded-full px-5 py-3 text-base text-ink placeholder-ink-subtle bg-canvas/70 border transition-[border-color,box-shadow] duration-150',
              icon ? 'pl-12' : '',
              error
                ? 'border-semantic-danger focus:border-semantic-danger focus:ring-semantic-danger/20'
                : 'border-outline-variant/70 focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20',
              'focus:outline-none',
              className
            )}
            {...rest}
          />
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-semantic-danger">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }