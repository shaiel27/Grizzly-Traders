'use client'

import { useState } from 'react'

interface MediaPreviewProps {
  src?: string | null
  icon: string
  mediaGradient: string
  symbol?: string
}

export function MediaPreview({ src, mediaGradient, symbol }: MediaPreviewProps) {
  const [failed, setFailed] = useState(false)
  const stamp = symbol || 'GRIZZLY'

  if (src && !failed) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- cover hosts are not known ahead of time */}
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-[var(--ease-out)] group-hover:scale-[1.02]"
          onError={() => setFailed(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" aria-hidden="true" />
      </>
    )
  }

  return (
    <div className={`absolute inset-0 bg-surface-container-lowest bg-gradient-to-br ${mediaGradient}`} aria-hidden="true">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      <span className="absolute inset-0 flex select-none items-center justify-center font-mono text-[42px] font-bold uppercase tracking-[0.28em] text-white/[0.07]">
        {stamp}
      </span>

      <span className="absolute bottom-3 left-3 font-mono text-[11px] font-bold tracking-wider text-ink/85 uppercase">
        {stamp}
      </span>
    </div>
  )
}
