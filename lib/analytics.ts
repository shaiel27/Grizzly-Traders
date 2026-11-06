// Google Analytics 4 con consentimiento previo. La lógica pura vive aquí (y se prueba); el componente es components/analytics/Analytics.tsx.
//
// Reglas:
//  - Nada de Google se carga ni se guarda hasta que el visitante ACEPTA (consentimiento previo, no "por defecto").
//  - Si el navegador envía Global Privacy Control, se trata como rechazo y no se pregunta.
//  - La decisión se guarda en localStorage (`gt_consent`): no es una cookie y no viaja al servidor.

export const CLAVE_CONSENTIMIENTO = 'gt_consent'
// El banner y el botón del pie se hablan por eventos del navegador (el pie es un componente de servidor)
export const EVENTO_CONSENTIMIENTO = 'gt:consentimiento'
export const EVENTO_ABRIR_PREFERENCIAS = 'gt:abrir-preferencias'

export type Consentimiento = 'concedido' | 'denegado'

// ID de medición de GA4 (p. ej. G-ABC123DEF4). Cualquier otra cosa se ignora: sin ID válido, la analítica queda apagada.
export const ID_MEDICION = /^G-[A-Z0-9]{6,14}$/
export const esIdMedicion = (valor: string | null | undefined): valor is string => typeof valor === 'string' && ID_MEDICION.test(valor)

export function leerConsentimiento(guardado: string | null | undefined, globalPrivacyControl: boolean): Consentimiento | null {
  if (globalPrivacyControl) return 'denegado'
  return guardado === 'concedido' || guardado === 'denegado' ? guardado : null
}

// Cookies que crea GA4: `_ga` y `_ga_<ID sin "G-">`. Al rechazar o retirar el consentimiento se borran.
export function esCookieDeGoogleAnalytics(nombre: string): boolean {
  return nombre === '_ga' || nombre.startsWith('_ga_') || nombre === '_gid' || nombre === '_gat' || nombre.startsWith('_gat_')
}

export function nombresDeCookies(cookieHeader: string): string[] {
  return cookieHeader
    .split(';')
    .map((parte) => parte.split('=')[0].trim())
    .filter(Boolean)
}

// Comandos de gtag para una sesión con consentimiento: anuncios denegados siempre (no hacemos publicidad), analítica concedida,
// sin señales de Google ni personalización, y sin page_view automático (se envía uno por cambio de ruta).
export function comandosDeInicio(id: string): unknown[][] {
  return [
    ['js', 'FECHA'],
    ['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' }],
    ['config', id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false }],
  ]
}
