'use client'

import { useState } from 'react'
import Image from 'next/image'

interface MediaPreviewProps {
  src?: string | null
  icon: string
  mediaGradient: string
  symbol?: string
  // Ancho real que ocupa la imagen en pantalla: sin esto el navegador pediría la variante más grande
  sizes?: string
}

// Solo las portadas del bucket propio pasan por el optimizador de Next (están en remotePatterns). Una portada
// pegada a mano desde otro sitio se muestra tal cual: con next/image fallaría el render de la página entera.
const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/`
const canOptimize = (src: string) => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && src.startsWith(STORAGE_PREFIX)

const IMAGE_CLASS =
  'object-cover transition-transform duration-300 ease-[var(--ease-out)] motion-reduce:transition-none [@media(hover:hover)]:group-hover:scale-[1.03]'

export function MediaPreview({ src, mediaGradient, symbol, sizes = '(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw' }: MediaPreviewProps) {
  const [failed, setFailed] = useState(false)
  const stamp = symbol || 'GRIZZLY'

  if (src && !failed) {
    return (
      <>
        {canOptimize(src) ? (
          // Las tarjetas están bajo el hero (no son el LCP de la home), por eso sin `priority`: carga diferida
          <Image src={src} alt="" fill sizes={sizes} className={IMAGE_CLASS} onError={() => setFailed(true)} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- portada de un host que no conocemos de antemano
          <img src={src} alt="" loading="lazy" decoding="async" className={`absolute inset-0 size-full ${IMAGE_CLASS}`} onError={() => setFailed(true)} />
        )}
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
