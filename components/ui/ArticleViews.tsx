'use client'

import { useEffect, useState } from 'react'
import { t } from '@/lib/i18n/get-dictionary'

// Cuenta la visita una vez por carga y muestra el contador al día. El número que llega desde el servidor puede venir de
// caché, así que después de contar se pide el valor actual. Sin bloquear el render.
export function ArticleViews({ postId, initial, template, locale }: { postId: string; initial: number; template: string; locale: string }) {
  const [views, setViews] = useState(initial)

  useEffect(() => {
    let vigente = true
    const url = `/api/views/${postId}`
    fetch(url, { method: 'POST', keepalive: true })
      .catch(() => undefined)
      .then(() => fetch(url, { cache: 'no-store' }))
      .then((res) => (res.ok ? (res.json() as Promise<{ views: number | null }>) : null))
      .then((data) => {
        if (vigente && data && typeof data.views === 'number') setViews(data.views)
      })
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [postId])

  return <span>{t(template, { n: views.toLocaleString(locale === 'en' ? 'en-US' : 'es-ES') })}</span>
}
