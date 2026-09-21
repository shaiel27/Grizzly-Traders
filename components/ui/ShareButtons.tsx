'use client'

import { useEffect, useState } from 'react'

interface ShareButtonsProps {
  title: string
  url: string
}

const NETWORKS = [
  { label: 'X', build: (u: string, t: string) => `https://twitter.com/intent/tweet?url=${u}&text=${t}`, icon: 'X' },
  { label: 'WhatsApp', build: (u: string, t: string) => `https://wa.me/?text=${t}%20${u}`, icon: 'chat' },
  { label: 'Telegram', build: (u: string, t: string) => `https://t.me/share/url?url=${u}&text=${t}`, icon: 'send' },
  { label: 'LinkedIn', build: (u: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, icon: 'work' },
]

const ITEM_CLASS =
  'inline-flex size-9 items-center justify-center rounded-full border border-hairline bg-white/[0.04] text-ink-muted transition-colors hover:border-accent-blue hover:text-ink'

export function ShareButtons({ title, url }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  useEffect(() => {
    // navigator.share only exists in the browser, so it can't be decided during server render
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt('Copia el enlace:', url)
    }
  }

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, url })
    } catch {
      // user dismissed the share sheet
    }
  }

  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-body-sm text-ink-muted">Compartir:</span>

      {NETWORKS.map((network) => (
        <a
          key={network.label}
          href={network.build(encodedUrl, encodedTitle)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Compartir en ${network.label}`}
          className={ITEM_CLASS}
        >
          {network.icon === 'X' ? (
            <span className="text-[13px] font-bold" aria-hidden="true">
              X
            </span>
          ) : (
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              {network.icon}
            </span>
          )}
        </a>
      ))}

      {canNativeShare && (
        <button type="button" onClick={handleNativeShare} aria-label="Compartir con otras aplicaciones" className={ITEM_CLASS}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            ios_share
          </span>
        </button>
      )}

      <button type="button" onClick={handleCopy} aria-label="Copiar enlace" className={ITEM_CLASS}>
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          {copied ? 'check' : 'link'}
        </span>
      </button>
      <span role="status" className="text-micro text-semantic-success">
        {copied ? 'Enlace copiado' : ''}
      </span>
    </div>
  )
}
