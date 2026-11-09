import { describe, expect, it } from 'vitest'
import { CLAVE_CONSENTIMIENTO_PUBLICIDAD, comandosDeInicio, hayQuePreguntar, publicidadActiva, puedeMostrarAnuncios, esCookieDeGoogleAnalytics, esIdMedicion, leerConsentimiento, nombresDeCookies } from './analytics'

describe('ID de medición de GA4', () => {
  it('solo acepta el formato G-XXXXXXXXXX; cualquier otra cosa deja la analítica apagada', () => {
    expect(esIdMedicion('G-ABC123DEF4')).toBe(true)
    expect(esIdMedicion('G-1234567')).toBe(true)
    for (const malo of ['', undefined, null, 'UA-12345-1', 'g-abc123def4', 'G-', 'G-AB', 'G-ABC 123', 'G-ABC123DEF4"><script>', 'GTM-ABC1234']) expect(esIdMedicion(malo as never)).toBe(false)
  })
})

describe('consentimiento', () => {
  it('sin decisión guardada queda pendiente (nunca "concedido" por defecto)', () => {
    expect(leerConsentimiento(null, false)).toBeNull()
    expect(leerConsentimiento(undefined, false)).toBeNull()
    expect(leerConsentimiento('', false)).toBeNull()
  })

  it('respeta lo guardado y descarta valores desconocidos', () => {
    expect(leerConsentimiento('concedido', false)).toBe('concedido')
    expect(leerConsentimiento('denegado', false)).toBe('denegado')
    expect(leerConsentimiento('true', false)).toBeNull()
    expect(leerConsentimiento('CONCEDIDO', false)).toBeNull()
  })

  it('Global Privacy Control del navegador cuenta como rechazo, aunque antes se hubiera aceptado', () => {
    expect(leerConsentimiento(null, true)).toBe('denegado')
    expect(leerConsentimiento('concedido', true)).toBe('denegado')
  })
})

describe('cookies de Google Analytics', () => {
  it('reconoce solo las de GA para borrarlas, no las nuestras', () => {
    for (const c of ['_ga', '_ga_ABC123DEF4', '_gid', '_gat', '_gat_gtag_G_ABC']) expect(esCookieDeGoogleAnalytics(c)).toBe(true)
    for (const c of ['gt_locale', 'sb-abc-auth-token', 'garage', '_gatsby', 'ga']) expect(esCookieDeGoogleAnalytics(c)).toBe(false)
  })

  it('extrae los nombres de document.cookie', () => {
    expect(nombresDeCookies('gt_locale=es; _ga=GA1.1.1; _ga_ABC=GS1.1.2')).toEqual(['gt_locale', '_ga', '_ga_ABC'])
    expect(nombresDeCookies('')).toEqual([])
  })
})

describe('comandos de inicio de gtag', () => {
  const comandos = comandosDeInicio('G-ABC123DEF4')

  it('deniega siempre los anuncios y solo concede la analítica', () => {
    const consentimiento = comandos.find((c) => c[0] === 'consent')!
    expect(consentimiento[1]).toBe('default')
    expect(consentimiento[2]).toEqual({ ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' })
  })

  it('apaga las señales de Google y el page_view automático (se envía uno por ruta)', () => {
    const config = comandos.find((c) => c[0] === 'config')!
    expect(config[1]).toBe('G-ABC123DEF4')
    expect(config[2]).toEqual({ send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false })
  })

  it('el consentimiento se declara antes de configurar la medición', () => {
    expect(comandos.map((c) => c[0])).toEqual(['js', 'consent', 'config'])
  })
})

describe('publicidad: consentimiento propio y separado', () => {
  it('tiene su propia clave: aceptar la analítica no acepta la publicidad', () => {
    expect(CLAVE_CONSENTIMIENTO_PUBLICIDAD).toBe('gt_consent_ads')
    // quien ya aceptó la analítica sigue «pendiente» en publicidad: leerConsentimiento solo mira SU clave
    expect(leerConsentimiento(null, false)).toBeNull()
  })

  it('Global Privacy Control rechaza la publicidad sin preguntar', () => {
    expect(leerConsentimiento('concedido', true)).toBe('denegado')
  })

  it('el interruptor solo se activa con el texto exacto «true»', () => {
    expect(publicidadActiva('true')).toBe(true)
    for (const v of ['', 'false', 'TRUE', '1', 'yes', undefined, null]) expect(publicidadActiva(v as never)).toBe(false)
  })

  it('solo se pregunta por lo que está activo y aún sin decidir', () => {
    const pend = { analitica: 'pendiente', publicidad: 'pendiente' } as const
    expect(hayQuePreguntar({ analitica: true, publicidad: false }, pend)).toBe(true)
    expect(hayQuePreguntar({ analitica: false, publicidad: true }, pend)).toBe(true)
    expect(hayQuePreguntar({ analitica: false, publicidad: false }, pend)).toBe(false)
    // ya decidió la analítica; al activarse la publicidad se le vuelve a preguntar solo por ella
    expect(hayQuePreguntar({ analitica: true, publicidad: true }, { analitica: 'concedido', publicidad: 'pendiente' })).toBe(true)
    expect(hayQuePreguntar({ analitica: true, publicidad: true }, { analitica: 'concedido', publicidad: 'denegado' })).toBe(false)
    // con la publicidad apagada, su decisión pendiente no molesta
    expect(hayQuePreguntar({ analitica: true, publicidad: false }, { analitica: 'denegado', publicidad: 'pendiente' })).toBe(false)
  })

  it('los anuncios exigen sitio activo Y consentimiento concedido: nunca con «pendiente», «denegado» ni en el servidor', () => {
    expect(puedeMostrarAnuncios(true, 'concedido')).toBe(true)
    for (const e of ['pendiente', 'denegado', 'servidor'] as const) expect(puedeMostrarAnuncios(true, e)).toBe(false)
    expect(puedeMostrarAnuncios(false, 'concedido')).toBe(false)
  })
})
