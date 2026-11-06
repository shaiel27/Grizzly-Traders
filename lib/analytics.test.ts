import { describe, expect, it } from 'vitest'
import { comandosDeInicio, esCookieDeGoogleAnalytics, esIdMedicion, leerConsentimiento, nombresDeCookies } from './analytics'

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
