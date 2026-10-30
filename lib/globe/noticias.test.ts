import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoticiaActivo } from './noticias'

// El cache de noticias es estado de modulo (Map de promesas): cada test importa una copia
// fresca del modulo con vi.resetModules para que la clave de un test no contamine al
// siguiente. Mismo patron de aislamiento que cualquier singleton testeable con vitest.
async function cargarModulo() {
  vi.resetModules()
  return import('./noticias')
}

function respuestaOk(data: NoticiaActivo[]) {
  return { ok: true, json: () => Promise.resolve({ success: true, data }) }
}

function respuestaHttpFallo(status = 502) {
  return { ok: false, status, json: () => Promise.resolve({ success: false, data: [] }) }
}

const NOTICIA: NoticiaActivo = {
  titulo: 'Oro firme ante dolar debil',
  href: '/articulos/oro-firme',
  sentimientoLabel: 'Positivo',
  sentimientoClase: 'chip-success',
  fecha: 'hace 1 h',
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('obtenerNoticias', () => {
  it('cachea el exito: dos llamadas con la misma clave hacen un solo fetch', async () => {
    const { obtenerNoticias } = await cargarModulo()
    fetchMock.mockResolvedValue(respuestaOk([NOTICIA]))
    const [a, b] = await Promise.all([obtenerNoticias('XAUUSD', 'es'), obtenerNoticias('XAUUSD', 'es')])
    expect(a).toEqual([NOTICIA])
    expect(b).toEqual([NOTICIA])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('claves distintas (simbolo o locale) no comparten la entrada de cache', async () => {
    const { obtenerNoticias } = await cargarModulo()
    fetchMock.mockResolvedValue(respuestaOk([NOTICIA]))
    await obtenerNoticias('XAUUSD', 'es')
    await obtenerNoticias('XAUUSD', 'en')
    await obtenerNoticias('XAGUSD', 'es')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  // Regresion F0-03: el codigo anterior hacia res.json() sin comprobar res.ok y cacheaba el
  // resultado — un 502 se convertia en [] y la tarjeta anunciaba "Sin noticias" para siempre.
  it('rechaza un !ok en vez de devolver [] disfrazado de exito', async () => {
    const { obtenerNoticias } = await cargarModulo()
    fetchMock.mockResolvedValueOnce(respuestaHttpFallo(502))
    await expect(obtenerNoticias('XAUUSD', 'es')).rejects.toThrow()
  })

  // Regresion F0-03: el fallo no puede quedarse en el cache; el siguiente montaje de la
  // tarjeta debe volver a la red.
  it('no cachea un !ok: la siguiente llamada vuelve a la red', async () => {
    const { obtenerNoticias } = await cargarModulo()
    fetchMock.mockResolvedValueOnce(respuestaHttpFallo(502))
    await expect(obtenerNoticias('XAUUSD', 'es')).rejects.toThrow()
    fetchMock.mockResolvedValueOnce(respuestaOk([NOTICIA]))
    await expect(obtenerNoticias('XAUUSD', 'es')).resolves.toEqual([NOTICIA])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('no cachea un fetch que rechaza (red caida): el siguiente llamado re-intenta', async () => {
    const { obtenerNoticias } = await cargarModulo()
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    await expect(obtenerNoticias('XAUUSD', 'es')).rejects.toThrow('network down')
    fetchMock.mockResolvedValueOnce(respuestaOk([NOTICIA]))
    await expect(obtenerNoticias('XAUUSD', 'es')).resolves.toEqual([NOTICIA])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('un body sin data en arreglo resuelve [] (ok con cero resultados)', async () => {
    const { obtenerNoticias } = await cargarModulo()
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) })
    await expect(obtenerNoticias('XAUUSD', 'es')).resolves.toEqual([])
  })

  it('pide la ruta con el simbolo y el locale codificados', async () => {
    const { obtenerNoticias } = await cargarModulo()
    fetchMock.mockResolvedValue(respuestaOk([]))
    await obtenerNoticias('XAUUSD', 'en')
    expect(fetchMock).toHaveBeenCalledWith('/api/globe/news?symbol=XAUUSD&locale=en')
  })
})

describe('olvidarNoticias', () => {
  it('borra el exito cacheado para que el siguiente pedido vaya a red', async () => {
    const { obtenerNoticias, olvidarNoticias } = await cargarModulo()
    fetchMock.mockResolvedValue(respuestaOk([NOTICIA]))
    await obtenerNoticias('XAUUSD', 'es')
    olvidarNoticias('XAUUSD', 'es')
    await obtenerNoticias('XAUUSD', 'es')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('no afecta a la clave de otro simbolo', async () => {
    const { obtenerNoticias, olvidarNoticias } = await cargarModulo()
    fetchMock.mockResolvedValue(respuestaOk([NOTICIA]))
    await obtenerNoticias('XAUUSD', 'es')
    await obtenerNoticias('XAGUSD', 'es')
    olvidarNoticias('XAUUSD', 'es')
    await obtenerNoticias('XAGUSD', 'es')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('precargarNoticias', () => {
  // Contrato con GloboHolografico.tsx:703 — el prefetch es fire-and-forget (sin .catch),
  // asi que la promesa devuelta nunca puede rechazar; el fallo se traga ahi pero el cache
  // interno ya quedo limpio, asi que la tarjeta no hereda un "Sin noticias" sembrado.
  it('nunca rechaza, pero no siembra el fallo en el cache para la tarjeta', async () => {
    const { precargarNoticias, obtenerNoticias } = await cargarModulo()
    fetchMock.mockResolvedValueOnce(respuestaHttpFallo(502))
    await expect(precargarNoticias('XAUUSD', 'es')).resolves.toEqual([])
    fetchMock.mockResolvedValueOnce(respuestaOk([NOTICIA]))
    await expect(obtenerNoticias('XAUUSD', 'es')).resolves.toEqual([NOTICIA])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('comparte el exito en cache con obtenerNoticias', async () => {
    const { precargarNoticias, obtenerNoticias } = await cargarModulo()
    fetchMock.mockResolvedValue(respuestaOk([NOTICIA]))
    await precargarNoticias('XAUUSD', 'es')
    await expect(obtenerNoticias('XAUUSD', 'es')).resolves.toEqual([NOTICIA])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
