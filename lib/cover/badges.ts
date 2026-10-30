import { CRYPTO_SVG, FLAG_SVG } from './assets.generated'

// Insignias de las portadas: banderas de los países de la noticia y logos de los activos que la protagonizan.
// Se dibujan con SVG oficiales (banderas, criptomonedas) o con glifos propios (metales, energía, granos), nunca
// con texto: no depende de las fuentes del servidor y la IA no tiene que dibujar logos, que le salen mal.

export const MAX_BADGES = 4

export type Badge = { kind: 'flag' | 'crypto' | 'glyph'; id: string; svg: string }

const CURRENCY_FLAG: Record<string, string> = { USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP', CHF: 'CH', CAD: 'CA', AUD: 'AU', NZD: 'NZ' }

// Índices y futuros → bandera del mercado al que pertenecen
const MARKET_FLAG: Record<string, string> = {
  SPX: 'US', NDX: 'US', DJI: 'US', DXY: 'US', VIX: 'US', US02Y: 'US', US10Y: 'US', ES: 'US', NQ: 'US', YM: 'US', RTY: 'US', MES: 'US', MNQ: 'US', MYM: 'US', M2K: 'US', VX: 'US', ZN: 'US',
  DAX: 'DE', FDAX: 'DE', CAC40: 'FR', FCE: 'FR', FTSE: 'GB', FTSEF: 'GB', NIKKEI: 'JP', NIY: 'JP', NKD: 'JP', HSI: 'HK', HSIF: 'HK', ESTX50: 'EU', FESX: 'EU', CN50: 'CN', NIFTYF: 'IN', SPI200F: 'AU',
}

const CRYPTO_ALIAS: Record<string, string> = { POL: 'MATIC' }

type Metal = { light: string; dark: string }
const METALS: Record<string, Metal> = {
  XAUUSD: { light: '#fbe08a', dark: '#b8860b' },
  XAGUSD: { light: '#f1f3f5', dark: '#8a94a3' },
  PLATINUM: { light: '#e3e8ee', dark: '#7d8aa0' },
  PALLADIUM: { light: '#d6dee9', dark: '#6b7b93' },
  COPPER: { light: '#f4b184', dark: '#a8551f' },
}
const METAL_ALIAS: Record<string, string> = { XAU: 'XAUUSD', GOLD: 'XAUUSD', ORO: 'XAUUSD', XAG: 'XAGUSD', SILVER: 'XAGUSD', PLATA: 'XAGUSD' }

const OIL = new Set(['WTI', 'BRENT'])
const GAS = new Set(['NG'])
const GRAIN = new Set(['CORN', 'WHEAT', 'SUGAR', 'COFFEE'])

function glyph(id: string, inner: string, bg: [string, string]): Badge {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/>${inner}</svg>`
  return { kind: 'glyph', id, svg }
}

function ingots({ light, dark }: Metal): string {
  const bar = (x: number, y: number) =>
    `<polygon points="${x},${y + 20} ${x + 44},${y + 20} ${x + 36},${y} ${x + 8},${y}" fill="${light}"/><polygon points="${x},${y + 20} ${x + 44},${y + 20} ${x + 42},${y + 14} ${x + 2},${y + 14}" fill="${dark}" opacity=".35"/>`
  return `${bar(8, 54)}${bar(48, 54)}${bar(28, 30)}`
}

function metalBadge(symbol: string): Badge {
  const metal = METALS[symbol]
  return glyph(symbol, ingots(metal), ['#1b1b1b', '#0a0a0a'])
}

const OIL_GLYPH = glyph('OIL', '<path d="M50 14C50 14 24 46 24 62a26 26 0 0 0 52 0C76 46 50 14 50 14Z" fill="#f4f4f5"/><path d="M38 60a12 12 0 0 0 8 12" stroke="#9ca3af" stroke-width="5" stroke-linecap="round" fill="none"/>', ['#26282d', '#0d0e10'])
const GAS_GLYPH = glyph('GAS', '<path d="M50 12C56 30 78 40 78 62a28 28 0 0 1-56 0C22 48 32 40 38 28c4 8 8 8 12-16Z" fill="#4fc3ff"/><path d="M50 50c4 8 14 12 14 22a14 14 0 0 1-28 0c0-6 4-10 8-14 2 4 4 4 6-8Z" fill="#e0f4ff"/>', ['#0c2233', '#06121c'])
const GRAIN_GLYPH = glyph(
  'GRAIN',
  '<path d="M50 90V34" stroke="#f7b955" stroke-width="5" stroke-linecap="round"/>' +
    [20, 38, 56]
      .map((y) => `<ellipse cx="38" cy="${y + 8}" rx="8" ry="15" transform="rotate(-32 38 ${y + 8})" fill="#f7b955"/><ellipse cx="62" cy="${y + 8}" rx="8" ry="15" transform="rotate(32 62 ${y + 8})" fill="#f7b955"/>`)
      .join('') +
    '<ellipse cx="50" cy="16" rx="7" ry="13" fill="#f7b955"/>',
  ['#2a1f0a', '#110c03']
)

function flagBadge(code: string): Badge | null {
  const svg = FLAG_SVG[code]
  return svg ? { kind: 'flag', id: code, svg } : null
}

function assetBadges(symbolInput: string): Badge[] {
  const symbol = symbolInput.trim().toUpperCase()
  if (!symbol) return []
  const metal = METAL_ALIAS[symbol] ?? symbol
  if (METALS[metal]) return [metalBadge(metal)]
  if (OIL.has(symbol)) return [OIL_GLYPH]
  if (GAS.has(symbol)) return [GAS_GLYPH]
  if (GRAIN.has(symbol)) return [GRAIN_GLYPH]

  const crypto = CRYPTO_ALIAS[symbol] ?? symbol
  if (CRYPTO_SVG[crypto]) return [{ kind: 'crypto', id: crypto, svg: CRYPTO_SVG[crypto] }]

  // Par de divisas (EURUSD): las dos banderas
  const pair = /^([A-Z]{3})\/?([A-Z]{3})$/.exec(symbol)
  if (pair && CURRENCY_FLAG[pair[1]] && CURRENCY_FLAG[pair[2]]) {
    return [flagBadge(CURRENCY_FLAG[pair[1]]), flagBadge(CURRENCY_FLAG[pair[2]])].filter((b): b is Badge => b !== null)
  }
  const market = MARKET_FLAG[symbol]
  return market ? [flagBadge(market)].filter((b): b is Badge => b !== null) : []
}

export interface BadgeInput {
  // Códigos ISO 3166-1 alfa-2 (EU para la zona euro) de los países de la noticia
  flags?: readonly string[]
  // Símbolos del catálogo de activos (BTC, XAUUSD, EURUSD, SPX…)
  assets?: readonly string[]
}

// Orden de prioridad: primero los activos (lo más específico de la noticia), después las banderas pedidas. Sin
// repetidos y con un tope para que la portada no se llene de insignias.
export function resolveBadges({ flags = [], assets = [] }: BadgeInput, max = MAX_BADGES): Badge[] {
  const out: Badge[] = []
  const seen = new Set<string>()
  const push = (badge: Badge | null) => {
    if (!badge) return
    const key = `${badge.kind}:${badge.id}`
    if (seen.has(key) || out.length >= max) return
    seen.add(key)
    out.push(badge)
  }
  for (const symbol of assets) for (const badge of assetBadges(symbol)) push(badge)
  for (const code of flags) push(flagBadge(code.trim().toUpperCase()))
  return out
}

export function isKnownFlag(code: string): boolean {
  return code.toUpperCase() in FLAG_SVG
}
