'use client'

import { useSyncExternalStore } from 'react'

// Fecha de publicación con la HORA en la zona horaria de quien lee. El servidor no la conoce y la página se sirve desde caché, así que
// la hora se calcula en el navegador: el servidor pinta solo la fecha (como siempre) y, al montar, se añade la hora sin mover nada.
const sinSuscripcion = () => () => {}

export function FechaPublicacion({ iso, fecha, ago, locale }: { iso: string; fecha: string; ago: string; locale: string }) {
  const hora = useSyncExternalStore(
    sinSuscripcion,
    () => new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit', hour12: locale === 'en' }).format(new Date(iso)),
    () => ''
  )
  return (
    <time dateTime={iso} title={ago}>
      {fecha}
      {hora && `, ${hora}`}
    </time>
  )
}
