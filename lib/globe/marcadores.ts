// Catalogo de pines del globo: datos puros, sin React ni Three.js, para que sean faciles de
// testear y de ajustar (coordenadas, simbolos) sin tocar el renderer. Maximo 8 — mas que eso y
// se amontonan sobre un globo de este tamaño (plan 009 §1.1).

export type TipoMarcador = 'energia' | 'metal'

export interface Marcador {
  id: string
  tipo: TipoMarcador
  simbolo: string // cotizacion (lib/ticker.ts / lib/prices.ts)
  nombreClave: string // clave de lib/i18n/dictionaries/{es,en}.json -> home.globoMarcadores
  lat: number // grados
  lon: number // grados, positivo = este
}

export const MARCADORES: Marcador[] = [
  { id: 'brent', tipo: 'energia', simbolo: 'BRENT', nombreClave: 'brent', lat: 58.5, lon: 1.8 },
  { id: 'wti', tipo: 'energia', simbolo: 'WTI', nombreClave: 'wti', lat: 35.98, lon: -96.77 },
  { id: 'crudoOriente', tipo: 'energia', simbolo: 'BRENT', nombreClave: 'crudoOriente', lat: 25.4, lon: 49.6 },
  { id: 'oroVenezuela', tipo: 'metal', simbolo: 'XAUUSD', nombreClave: 'oroVenezuela', lat: 7.0, lon: -62.5 },
  { id: 'oroSudafrica', tipo: 'metal', simbolo: 'XAUUSD', nombreClave: 'oroSudafrica', lat: -26.2, lon: 27.9 },
  { id: 'oroAustralia', tipo: 'metal', simbolo: 'XAUUSD', nombreClave: 'oroAustralia', lat: -30.75, lon: 121.47 },
  { id: 'plataMexico', tipo: 'metal', simbolo: 'XAGUSD', nombreClave: 'plataMexico', lat: 22.77, lon: -102.58 },
  { id: 'gasLuisiana', tipo: 'energia', simbolo: 'NG', nombreClave: 'gasLuisiana', lat: 30.0, lon: -92.1 },
]
