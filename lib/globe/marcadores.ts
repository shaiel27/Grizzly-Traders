// Catalogo de pines del globo: datos puros, sin React ni Three.js, para que sean faciles de
// testear y de ajustar (coordenadas, simbolos) sin tocar el renderer. Maximo 8 — mas que eso y
// se amontonan sobre un globo de este tamaño (plan 009 §1.1).

// 'indice' = futuros de indices bursatiles (ES, FDAX, NKD; PLAN-FUTUROS.md D6)
export type TipoMarcador = 'energia' | 'metal' | 'indice'

export interface Marcador {
  id: string
  tipo: TipoMarcador
  simbolo: string // cotizacion (lib/ticker.ts / lib/prices.ts)
  // Simbolo con el que se etiquetan las noticias, si difiere de `simbolo` (los artículos hablan del
  // índice, no del contrato: ES -> SPX; PLAN-FUTUROS.md D7). Usar simboloNoticias(), no este campo.
  simboloNoticias?: string
  nombreClave: string // clave de lib/i18n/dictionaries/{es,en}.json -> home.globoMarcadores
  lat: number // grados
  lon: number // grados, positivo = este
}

// Cotizacion que page.tsx reparte en DatosGlobo.cotizacionesPines y que el pin recibe via la
// prop `cotizaciones` (F1): solo lee `cambio` para su badge live y su pulso con senal; `precio`
// viaja en el mismo objeto porque es lo que ya entrega la fuente y lo consume TarjetaActivo.
export interface CotizacionPin {
  precio: number
  cambio: number | null
}

export const MARCADORES: Marcador[] = [
  { id: 'brent', tipo: 'energia', simbolo: 'BRENT', nombreClave: 'brent', lat: 58.5, lon: 1.8 },
  { id: 'wti', tipo: 'energia', simbolo: 'WTI', nombreClave: 'wti', lat: 35.98, lon: -96.77 },
  { id: 'oroSudafrica', tipo: 'metal', simbolo: 'XAUUSD', nombreClave: 'oroSudafrica', lat: -26.2, lon: 27.9 },
  { id: 'plataMexico', tipo: 'metal', simbolo: 'XAGUSD', nombreClave: 'plataMexico', lat: 22.77, lon: -102.58 },
  { id: 'gasLuisiana', tipo: 'energia', simbolo: 'NG', nombreClave: 'gasLuisiana', lat: 30.0, lon: -92.1 },
  // Futuros de indices (el `simbolo` es el `plain` del catalogo, que es como indexa lib/ticker.ts)
  { id: 'esChicago', tipo: 'indice', simbolo: 'ES', simboloNoticias: 'SPX', nombreClave: 'esChicago', lat: 41.88, lon: -87.63 },
  { id: 'fdaxFrankfurt', tipo: 'indice', simbolo: 'FDAX', simboloNoticias: 'DAX', nombreClave: 'fdaxFrankfurt', lat: 50.11, lon: 8.68 },
  { id: 'nikkeiTokio', tipo: 'indice', simbolo: 'NKD', simboloNoticias: 'NIKKEI', nombreClave: 'nikkeiTokio', lat: 35.68, lon: 139.69 },
]

export function simboloNoticias(m: Marcador): string {
  return m.simboloNoticias ?? m.simbolo
}
