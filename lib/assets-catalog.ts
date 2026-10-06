// Única fuente de verdad del catálogo de activos de todo el sitio (plan: PLAN-API-ACTIVOS.md).
// Antes había 4 listas independientes (MARKET_ASSETS 64, PIVOT_ASSETS 34, TICKER_ASSETS 35, seed
// de la tabla `activos` en Supabase con 10-11) que divergían en cantidad porque cada una se editó
// por separado con el tiempo. lib/market-assets.ts, lib/pivot-assets.ts y lib/ticker.ts ahora
// DERIVAN sus formas específicas de este archivo (ver cada uno) en vez de declarar sus propios
// arrays a mano — agregar un activo nuevo es editar ACA una sola vez.
//
// Cada ticker de `tv` fue probado contra el scanner de TradingView: uno desconocido desaparece en
// silencio del resultado (confirmado de nuevo el 2026-10-06, no solo heredado del diagnóstico
// original). `TVC:DJI` es el caso real: no devuelve fila, `DJ:DJI` sí — por eso el Dow Jones usa
// ese ticker acá, no el que todavía figura en TradingView como "oficial" para mostrar en un chart.

export type AssetClass = 'crypto' | 'forex' | 'commodity' | 'stock' | 'index'

export interface AssetDefinition {
  // Símbolo corto: columna `activos.symbol` en Supabase, chips de artículo, company-profile.
  // Los que ya existían en TICKER_ASSETS/la tabla real se preservaron tal cual (BTC, ETH, SOL,
  // EURUSD, GBPUSD, XAUUSD, XAGUSD, AAPL, NVDA, SPX, DXY) para que la migración de la Fase 3 los
  // reconozca como el MISMO activo (on conflict) en vez de crear un duplicado.
  plain: string
  name: string
  cls: AssetClass
  // Ticker de TradingView para el scanner (scanTradingView en lib/markets.ts)
  tv: string
  // Símbolo de Yahoo Finance para velas (lib/candles.ts); ausente = sin cobertura conocida
  yahoo?: string
  // Decimales de precio (lib/format.ts) — 2 para casi todo, forex usa 3 o 5 según el par
  decimals: number
  // Quick-select de la calculadora de pivotes Y fila principal de los filtros de artículos
  popular?: boolean
  // true = se antepone "$" al formatear (lib/format.ts); forex e índices no lo usan
  currency: boolean
  // Texto corto para la terminal (lib/market-assets.ts) cuando difiere de `plain` — p.ej.
  // 'XAU/USD' en vez de 'XAUUSD', o 'PLATINO' en vez de 'PLATINUM' (el `plain` en inglés es el
  // que ya vive en la DB/los chips de artículo; el label es el que ya se mostraba en la terminal
  // antes de este catálogo, se preserva tal cual). Sin esto, las acciones usan el nombre propio
  // que ya devuelve el scanner de TradingView.
  label?: string
}

export const ASSETS: readonly AssetDefinition[] = [
  // --- Crypto (15) ---
  { plain: 'BTC', name: 'Bitcoin', cls: 'crypto', tv: 'BINANCE:BTCUSDT', decimals: 2, popular: true, currency: true, label: 'BTC/USD' },
  { plain: 'ETH', name: 'Ethereum', cls: 'crypto', tv: 'BINANCE:ETHUSDT', decimals: 2, popular: true, currency: true, label: 'ETH/USD' },
  { plain: 'SOL', name: 'Solana', cls: 'crypto', tv: 'BINANCE:SOLUSDT', decimals: 2, currency: true, label: 'SOL/USD' },
  { plain: 'BNB', name: 'BNB', cls: 'crypto', tv: 'BINANCE:BNBUSDT', decimals: 2, currency: true, label: 'BNB/USD' },
  { plain: 'XRP', name: 'XRP', cls: 'crypto', tv: 'BINANCE:XRPUSDT', decimals: 2, currency: true, label: 'XRP/USD' },
  { plain: 'ADA', name: 'Cardano', cls: 'crypto', tv: 'BINANCE:ADAUSDT', decimals: 2, currency: true, label: 'ADA/USD' },
  { plain: 'DOGE', name: 'Dogecoin', cls: 'crypto', tv: 'BINANCE:DOGEUSDT', decimals: 2, currency: true, label: 'DOGE/USD' },
  { plain: 'DOT', name: 'Polkadot', cls: 'crypto', tv: 'BINANCE:DOTUSDT', decimals: 2, currency: true, label: 'DOT/USD' },
  { plain: 'AVAX', name: 'Avalanche', cls: 'crypto', tv: 'BINANCE:AVAXUSDT', decimals: 2, currency: true, label: 'AVAX/USD' },
  { plain: 'LINK', name: 'Chainlink', cls: 'crypto', tv: 'BINANCE:LINKUSDT', decimals: 2, currency: true, label: 'LINK/USD' },
  { plain: 'POL', name: 'Polygon', cls: 'crypto', tv: 'BINANCE:POLUSDT', decimals: 2, currency: true, label: 'POL/USD' },
  { plain: 'UNI', name: 'Uniswap', cls: 'crypto', tv: 'BINANCE:UNIUSDT', decimals: 2, currency: true, label: 'UNI/USD' },
  { plain: 'ATOM', name: 'Cosmos', cls: 'crypto', tv: 'BINANCE:ATOMUSDT', decimals: 2, currency: true, label: 'ATOM/USD' },
  { plain: 'LTC', name: 'Litecoin', cls: 'crypto', tv: 'BINANCE:LTCUSDT', decimals: 2, currency: true, label: 'LTC/USD' },
  { plain: 'NEAR', name: 'NEAR Protocol', cls: 'crypto', tv: 'BINANCE:NEARUSDT', decimals: 2, currency: true, label: 'NEAR/USD' },

  // --- Forex (10) ---
  { plain: 'EURUSD', name: 'Euro / Dólar', cls: 'forex', tv: 'FX:EURUSD', decimals: 5, popular: true, currency: false, label: 'EUR/USD' },
  { plain: 'GBPUSD', name: 'Libra / Dólar', cls: 'forex', tv: 'FX:GBPUSD', decimals: 5, popular: true, currency: false, label: 'GBP/USD' },
  { plain: 'USDJPY', name: 'Dólar / Yen', cls: 'forex', tv: 'FX:USDJPY', decimals: 3, currency: false, label: 'USD/JPY' },
  { plain: 'USDCHF', name: 'Dólar / Franco suizo', cls: 'forex', tv: 'FX:USDCHF', decimals: 3, currency: false, label: 'USD/CHF' },
  { plain: 'AUDUSD', name: 'Dólar australiano / Dólar', cls: 'forex', tv: 'FX:AUDUSD', decimals: 5, currency: false, label: 'AUD/USD' },
  { plain: 'USDCAD', name: 'Dólar / Dólar canadiense', cls: 'forex', tv: 'FX:USDCAD', decimals: 3, currency: false, label: 'USD/CAD' },
  { plain: 'NZDUSD', name: 'Dólar neozelandés / Dólar', cls: 'forex', tv: 'FX:NZDUSD', decimals: 5, currency: false, label: 'NZD/USD' },
  { plain: 'EURGBP', name: 'Euro / Libra', cls: 'forex', tv: 'FX:EURGBP', decimals: 3, currency: false, label: 'EUR/GBP' },
  { plain: 'EURJPY', name: 'Euro / Yen', cls: 'forex', tv: 'FX:EURJPY', decimals: 3, currency: false, label: 'EUR/JPY' },
  { plain: 'GBPJPY', name: 'Libra / Yen', cls: 'forex', tv: 'FX:GBPJPY', decimals: 3, currency: false, label: 'GBP/JPY' },

  // --- Materias primas (12) ---
  { plain: 'XAUUSD', name: 'Oro', cls: 'commodity', tv: 'OANDA:XAUUSD', yahoo: 'GC=F', decimals: 2, popular: true, currency: true, label: 'XAU/USD' },
  { plain: 'XAGUSD', name: 'Plata', cls: 'commodity', tv: 'TVC:SILVER', yahoo: 'SI=F', decimals: 2, currency: true, label: 'XAG/USD' },
  { plain: 'PLATINUM', name: 'Platino', cls: 'commodity', tv: 'TVC:PLATINUM', yahoo: 'PL=F', decimals: 2, currency: true, label: 'PLATINO' },
  { plain: 'PALLADIUM', name: 'Paladio', cls: 'commodity', tv: 'TVC:PALLADIUM', yahoo: 'PA=F', decimals: 2, currency: true, label: 'PALADIO' },
  { plain: 'BRENT', name: 'Petróleo Brent', cls: 'commodity', tv: 'ICEEUR:BRN1!', yahoo: 'BZ=F', decimals: 2, currency: true, label: 'BRENT' },
  { plain: 'WTI', name: 'Petróleo WTI', cls: 'commodity', tv: 'NYMEX:CL1!', yahoo: 'CL=F', decimals: 2, currency: true, label: 'WTI' },
  { plain: 'NG', name: 'Gas natural', cls: 'commodity', tv: 'NYMEX:NG1!', yahoo: 'NG=F', decimals: 2, currency: true, label: 'GAS NAT.' },
  { plain: 'COPPER', name: 'Cobre', cls: 'commodity', tv: 'COMEX:HG1!', yahoo: 'HG=F', decimals: 2, currency: true, label: 'COBRE' },
  { plain: 'CORN', name: 'Maíz', cls: 'commodity', tv: 'CBOT:ZC1!', yahoo: 'ZC=F', decimals: 2, currency: true, label: 'MAÍZ' },
  { plain: 'WHEAT', name: 'Trigo', cls: 'commodity', tv: 'CBOT:ZW1!', yahoo: 'ZW=F', decimals: 2, currency: true, label: 'TRIGO' },
  { plain: 'SUGAR', name: 'Azúcar', cls: 'commodity', tv: 'ICEUS:SB1!', yahoo: 'SB=F', decimals: 2, currency: true, label: 'AZÚCAR' },
  { plain: 'COFFEE', name: 'Café', cls: 'commodity', tv: 'ICEUS:KC1!', yahoo: 'KC=F', decimals: 2, currency: true, label: 'CAFÉ' },

  // --- Acciones (14, sin label: el scanner ya devuelve nombre/ticker legibles por si solo) ---
  { plain: 'AAPL', name: 'Apple', cls: 'stock', tv: 'NASDAQ:AAPL', decimals: 2, popular: true, currency: true },
  { plain: 'NVDA', name: 'Nvidia', cls: 'stock', tv: 'NASDAQ:NVDA', decimals: 2, popular: true, currency: true },
  { plain: 'MSFT', name: 'Microsoft', cls: 'stock', tv: 'NASDAQ:MSFT', decimals: 2, currency: true },
  { plain: 'GOOGL', name: 'Alphabet', cls: 'stock', tv: 'NASDAQ:GOOGL', decimals: 2, currency: true },
  { plain: 'AMZN', name: 'Amazon', cls: 'stock', tv: 'NASDAQ:AMZN', decimals: 2, currency: true },
  { plain: 'META', name: 'Meta', cls: 'stock', tv: 'NASDAQ:META', decimals: 2, currency: true },
  { plain: 'TSLA', name: 'Tesla', cls: 'stock', tv: 'NASDAQ:TSLA', decimals: 2, currency: true },
  { plain: 'AMD', name: 'AMD', cls: 'stock', tv: 'NASDAQ:AMD', decimals: 2, currency: true },
  { plain: 'NFLX', name: 'Netflix', cls: 'stock', tv: 'NASDAQ:NFLX', decimals: 2, currency: true },
  { plain: 'INTC', name: 'Intel', cls: 'stock', tv: 'NASDAQ:INTC', decimals: 2, currency: true },
  { plain: 'JPM', name: 'JPMorgan Chase', cls: 'stock', tv: 'NYSE:JPM', decimals: 2, currency: true },
  { plain: 'V', name: 'Visa', cls: 'stock', tv: 'NYSE:V', decimals: 2, currency: true },
  { plain: 'JNJ', name: 'Johnson & Johnson', cls: 'stock', tv: 'NYSE:JNJ', decimals: 2, currency: true },
  { plain: 'UNH', name: 'UnitedHealth', cls: 'stock', tv: 'NYSE:UNH', decimals: 2, currency: true },

  // --- Índices (13) ---
  { plain: 'SPX', name: 'S&P 500', cls: 'index', tv: 'SP:SPX', yahoo: '^GSPC', decimals: 2, popular: true, currency: false, label: 'S&P 500' },
  { plain: 'NDX', name: 'Nasdaq 100', cls: 'index', tv: 'NASDAQ:NDX', yahoo: '^NDX', decimals: 2, currency: false, label: 'NASDAQ 100' },
  // Fix verificado en vivo (2026-10-06): TVC:DJI no devuelve fila del scanner, DJ:DJI sí.
  { plain: 'DJI', name: 'Dow Jones Industrial', cls: 'index', tv: 'DJ:DJI', yahoo: '^DJI', decimals: 2, currency: false, label: 'DOW JONES' },
  { plain: 'DXY', name: 'Índice del dólar', cls: 'index', tv: 'TVC:DXY', yahoo: 'DX-Y.NYB', decimals: 2, currency: false, label: 'DXY' },
  { plain: 'DAX', name: 'DAX 40 (Alemania)', cls: 'index', tv: 'TVC:DEU40', yahoo: '^GDAXI', decimals: 2, currency: false, label: 'DAX' },
  { plain: 'FTSE', name: 'FTSE 100 (Reino Unido)', cls: 'index', tv: 'TVC:UKX', yahoo: '^FTSE', decimals: 2, currency: false, label: 'FTSE 100' },
  { plain: 'CAC40', name: 'CAC 40 (Francia)', cls: 'index', tv: 'TVC:CAC40', yahoo: '^FCHI', decimals: 2, currency: false, label: 'CAC 40' },
  { plain: 'ESTX50', name: 'Euro Stoxx 50', cls: 'index', tv: 'TVC:SX5E', yahoo: '^STOXX50E', decimals: 2, currency: false, label: 'EURO STOXX 50' },
  { plain: 'NIKKEI', name: 'Nikkei 225 (Japón)', cls: 'index', tv: 'TVC:NI225', yahoo: '^N225', decimals: 2, currency: false, label: 'NIKKEI' },
  { plain: 'HSI', name: 'Hang Seng (Hong Kong)', cls: 'index', tv: 'TVC:HSI', yahoo: '^HSI', decimals: 2, currency: false, label: 'HANG SENG' },
  { plain: 'VIX', name: 'Índice de volatilidad', cls: 'index', tv: 'TVC:VIX', yahoo: '^VIX', decimals: 2, currency: false, label: 'VIX' },
  { plain: 'US10Y', name: 'Bono de EE. UU. a 10 años', cls: 'index', tv: 'TVC:US10Y', yahoo: '^TNX', decimals: 2, currency: false, label: 'US10Y' },
  // Sin cobertura de Yahoo conocida (ya documentado antes de este catálogo) — sin velas, el resto funciona.
  { plain: 'US02Y', name: 'Bono de EE. UU. a 2 años', cls: 'index', tv: 'TVC:US02Y', decimals: 2, currency: false, label: 'US02Y' },
] as const

export const ASSET_CLASS_TIPO_ID: Record<AssetClass, number> = {
  crypto: 1,
  forex: 2,
  commodity: 3,
  stock: 4,
  index: 5,
}

export const ASSET_BY_PLAIN = new Map(ASSETS.map((a) => [a.plain, a]))
export const ASSET_BY_TV = new Map(ASSETS.map((a) => [a.tv, a]))

// Orden intercalado por clase (round-robin), no agrupado — mismo criterio que ya usaba
// TICKER_ASSETS a mano ("cada tramo de la barra mezcla clases de activo"), ahora generado en vez
// de mantenido a mano. El orden de clases de abajo es el mismo que ya se sentía bien en el ticker
// original: cripto/forex/índice/materia prima/acción repitiendo.
const ORDEN_CLASES: AssetClass[] = ['crypto', 'forex', 'index', 'commodity', 'stock']

export function intercalarPorClase(assets: readonly AssetDefinition[]): AssetDefinition[] {
  const porClase = new Map<AssetClass, AssetDefinition[]>(ORDEN_CLASES.map((c) => [c, []]))
  for (const asset of assets) porClase.get(asset.cls)?.push(asset)

  const resultado: AssetDefinition[] = []
  let quedan = true
  while (quedan) {
    quedan = false
    for (const cls of ORDEN_CLASES) {
      const lista = porClase.get(cls)!
      const siguiente = lista.shift()
      if (siguiente) {
        resultado.push(siguiente)
        quedan = true
      }
    }
  }
  return resultado
}
