// Score risk-on/risk-off: funcion pura (plan 009 §3.1) — recibe los % de cambio del dia ya
// obtenidos (lib/ticker.ts + el scan extra de SSE/XJO en page.tsx) y devuelve una clasificacion.
// Nada de fetch aca: mas facil de testear y de ajustar los pesos sin tocar red.

export interface EntradaSentimiento {
  spx: number | null
  dax: number | null
  nikkei: number | null
  sse: number | null // China — no esta en lib/ticker.ts, se pide aparte (plan 009 D3)
  ftse: number | null
  vix: number | null
}

export type ClasificacionRiesgo = 'RISK-ON' | 'RISK-OFF' | 'NEUTRAL'

export interface ResultadoSentimiento {
  score: number
  clasificacion: ClasificacionRiesgo
}

// Pesos del plan: EEUU 0.4, Europa 0.25, Japon 0.15, China 0.15, Reino Unido 0.05.
const PESOS = { spx: 0.4, dax: 0.25, nikkei: 0.15, sse: 0.15, ftse: 0.05 }

export function calcularSentimiento(entrada: EntradaSentimiento): ResultadoSentimiento {
  let sumaPesos = 0
  let sumaPonderada = 0
  for (const clave of Object.keys(PESOS) as (keyof typeof PESOS)[]) {
    const valor = entrada[clave]
    if (valor == null) continue
    sumaPonderada += valor * PESOS[clave]
    sumaPesos += PESOS[clave]
  }
  // Si falta algun indice, se normaliza por los pesos que si estan disponibles, en vez de
  // diluir el score hacia 0 artificialmente.
  let score = sumaPesos > 0 ? sumaPonderada / sumaPesos : 0

  // Penalizacion: un VIX que sube mas de 5% en el dia resta confianza aunque los indices esten
  // parejos (el miedo se mide aparte del movimiento de precio).
  if (entrada.vix != null && entrada.vix > 5) {
    score -= (entrada.vix - 5) * 0.05
  }

  let clasificacion: ClasificacionRiesgo = 'NEUTRAL'
  if (score > 0.3) clasificacion = 'RISK-ON'
  else if (score < -0.3) clasificacion = 'RISK-OFF'

  return { score, clasificacion }
}
