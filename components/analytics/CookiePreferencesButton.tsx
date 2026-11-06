'use client'

import { EVENTO_ABRIR_PREFERENCIAS } from '@/lib/analytics'

// Enlace del pie para volver a abrir el aviso de cookies y cambiar la decisión (retirar el consentimiento debe ser tan fácil como darlo).
// El pie es un componente de servidor: el aviso lo escucha por un evento del navegador.
export function CookiePreferencesButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_PREFERENCIAS))}>
      {label}
    </button>
  )
}
