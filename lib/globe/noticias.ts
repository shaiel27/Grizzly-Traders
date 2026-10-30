// Carga y cache de noticias de la tarjeta del globo (F4 / F0-03). Extraida de
// TarjetaActivo.tsx para poder testearla (noticias.test.ts); el componente y el prefetch de
// GloboHolografico.tsx consumen estas funciones sin tocar su contrato publico.

import type { Locale } from '@/lib/i18n/get-dictionary'

export interface NoticiaActivo {
  titulo: string
  href: string
  sentimientoLabel: string
  sentimientoClase: string
  fecha: string
}

// Cache de promesas a nivel de modulo (no de componente): abrir la misma tarjeta dos veces, o
// precargar al pasar el mouse y despues tocar el pin, no repite el pedido — son 3 titulares
// publicos, nada sensible que requiera invalidarse por usuario.
// Regla F0-03: los fallos NO se cachean — un !ok o una excepcion retiran la clave para que el
// siguiente montaje reintente en vez de sembrar "Sin noticias" permanente.
const cacheNoticias = new Map<string, Promise<NoticiaActivo[]>>()

function claveNoticias(simbolo: string, locale: Locale): string {
  return `${simbolo}:${locale}`
}

export function obtenerNoticias(simbolo: string, locale: Locale): Promise<NoticiaActivo[]> {
  const clave = claveNoticias(simbolo, locale)
  let promesa = cacheNoticias.get(clave)
  if (!promesa) {
    promesa = fetch(`/api/globe/news?symbol=${encodeURIComponent(simbolo)}&locale=${locale}`)
      .then((res) => {
        // Sin esta comprobacion, un 4xx/5xx caia a res.json() → body.data ausente → []
        // igual que "ok con cero noticias", y encima cacheado (era el bug F0-03).
        if (!res.ok) throw new Error(`Noticias ${simbolo}: HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => (Array.isArray(body?.data) ? (body.data as NoticiaActivo[]) : []))
      .catch((error) => {
        // Retira la entrada fallida ANTES de propagar: cualquier llamador concurrente que
        // llegue despues del rechazo ve una clave ausente y vuelve a la red.
        cacheNoticias.delete(clave)
        throw error
      })
    cacheNoticias.set(clave, promesa)
  }
  return promesa
}

// Entrada "segura" para el prefetch de GloboHolografico.tsx: ahi se llama fire-and-forget
// (sin .catch), asi que la promesa devuelta nunca rechaza. El cache interno si queda limpio
// tras un fallo, de modo que la tarjeta posteriormente no hereda respuesta fallida cacheada.
export function precargarNoticias(simbolo: string, locale: Locale): Promise<NoticiaActivo[]> {
  return obtenerNoticias(simbolo, locale).catch(() => [] as NoticiaActivo[])
}

// Borra la entrada de cache de esa clave: la usa el boton "Reintentar" de la tarjeta para que
// el siguiente obtenerNoticias vaya a red en vez de reutilizar la promesa fallida.
export function olvidarNoticias(simbolo: string, locale: Locale): void {
  cacheNoticias.delete(claveNoticias(simbolo, locale))
}
