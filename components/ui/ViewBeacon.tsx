'use client'

import { useEffect } from 'react'

// Cuenta la visita del artículo una vez por carga de página, sin bloquear el render ni leer cabeceras en el servidor
// (así la página del artículo puede servirse desde caché).
export function ViewBeacon({ postId }: { postId: string }) {
  useEffect(() => {
    const url = `/api/views/${postId}`
    if (typeof navigator.sendBeacon === 'function') navigator.sendBeacon(url)
    else void fetch(url, { method: 'POST', keepalive: true }).catch(() => undefined)
  }, [postId])
  return null
}
