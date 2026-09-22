// Client-safe catalog of the terminal (no server imports). Every ticker was checked against the scanner:
// an unknown one silently disappears from the results, so change them only after probing.
export type MarketCategory = 'crypto' | 'forex' | 'commodity' | 'stock' | 'index'

export interface MarketAssetDef {
  symbol: string
  category: MarketCategory
  // Short name shown in the terminal; falls back to the scanner's own name
  label?: string
  // Spanish description; falls back to the scanner's own description
  title?: string
}

export const MARKET_CATEGORY_LABELS: Record<MarketCategory, string> = {
  crypto: 'Cripto',
  forex: 'Forex',
  commodity: 'Materias primas',
  stock: 'Acciones',
  index: 'Índices',
}

export const MARKET_ASSETS: MarketAssetDef[] = [
  // Crypto
  { symbol: 'BINANCE:BTCUSDT', category: 'crypto', label: 'BTC/USD', title: 'Bitcoin' },
  { symbol: 'BINANCE:ETHUSDT', category: 'crypto', label: 'ETH/USD', title: 'Ethereum' },
  { symbol: 'BINANCE:SOLUSDT', category: 'crypto', label: 'SOL/USD', title: 'Solana' },
  { symbol: 'BINANCE:BNBUSDT', category: 'crypto', label: 'BNB/USD', title: 'BNB' },
  { symbol: 'BINANCE:XRPUSDT', category: 'crypto', label: 'XRP/USD', title: 'XRP' },
  { symbol: 'BINANCE:ADAUSDT', category: 'crypto', label: 'ADA/USD', title: 'Cardano' },
  { symbol: 'BINANCE:DOGEUSDT', category: 'crypto', label: 'DOGE/USD', title: 'Dogecoin' },
  { symbol: 'BINANCE:DOTUSDT', category: 'crypto', label: 'DOT/USD', title: 'Polkadot' },
  { symbol: 'BINANCE:AVAXUSDT', category: 'crypto', label: 'AVAX/USD', title: 'Avalanche' },
  { symbol: 'BINANCE:LINKUSDT', category: 'crypto', label: 'LINK/USD', title: 'Chainlink' },
  { symbol: 'BINANCE:POLUSDT', category: 'crypto', label: 'POL/USD', title: 'Polygon' },
  { symbol: 'BINANCE:UNIUSDT', category: 'crypto', label: 'UNI/USD', title: 'Uniswap' },
  { symbol: 'BINANCE:ATOMUSDT', category: 'crypto', label: 'ATOM/USD', title: 'Cosmos' },
  { symbol: 'BINANCE:LTCUSDT', category: 'crypto', label: 'LTC/USD', title: 'Litecoin' },
  { symbol: 'BINANCE:NEARUSDT', category: 'crypto', label: 'NEAR/USD', title: 'NEAR Protocol' },
  // Forex
  { symbol: 'FX:EURUSD', category: 'forex', label: 'EUR/USD', title: 'Euro / Dólar' },
  { symbol: 'FX:GBPUSD', category: 'forex', label: 'GBP/USD', title: 'Libra / Dólar' },
  { symbol: 'FX:USDJPY', category: 'forex', label: 'USD/JPY', title: 'Dólar / Yen' },
  { symbol: 'FX:USDCHF', category: 'forex', label: 'USD/CHF', title: 'Dólar / Franco suizo' },
  { symbol: 'FX:AUDUSD', category: 'forex', label: 'AUD/USD', title: 'Dólar australiano / Dólar' },
  { symbol: 'FX:USDCAD', category: 'forex', label: 'USD/CAD', title: 'Dólar / Dólar canadiense' },
  { symbol: 'FX:NZDUSD', category: 'forex', label: 'NZD/USD', title: 'Dólar neozelandés / Dólar' },
  { symbol: 'FX:EURGBP', category: 'forex', label: 'EUR/GBP', title: 'Euro / Libra' },
  { symbol: 'FX:EURJPY', category: 'forex', label: 'EUR/JPY', title: 'Euro / Yen' },
  { symbol: 'FX:GBPJPY', category: 'forex', label: 'GBP/JPY', title: 'Libra / Yen' },
  // Commodities
  { symbol: 'OANDA:XAUUSD', category: 'commodity', label: 'XAU/USD', title: 'Oro' },
  { symbol: 'TVC:SILVER', category: 'commodity', label: 'XAG/USD', title: 'Plata' },
  { symbol: 'TVC:PLATINUM', category: 'commodity', label: 'PLATINO', title: 'Platino' },
  { symbol: 'TVC:PALLADIUM', category: 'commodity', label: 'PALADIO', title: 'Paladio' },
  { symbol: 'ICEEUR:BRN1!', category: 'commodity', label: 'BRENT', title: 'Petróleo Brent' },
  { symbol: 'NYMEX:CL1!', category: 'commodity', label: 'WTI', title: 'Petróleo WTI' },
  { symbol: 'NYMEX:NG1!', category: 'commodity', label: 'GAS NAT.', title: 'Gas natural' },
  { symbol: 'COMEX:HG1!', category: 'commodity', label: 'COBRE', title: 'Cobre' },
  { symbol: 'CBOT:ZC1!', category: 'commodity', label: 'MAÍZ', title: 'Maíz' },
  { symbol: 'CBOT:ZW1!', category: 'commodity', label: 'TRIGO', title: 'Trigo' },
  { symbol: 'ICEUS:SB1!', category: 'commodity', label: 'AZÚCAR', title: 'Azúcar' },
  { symbol: 'ICEUS:KC1!', category: 'commodity', label: 'CAFÉ', title: 'Café' },
  // Stocks - US (the scanner's own ticker and company name read fine)
  { symbol: 'NASDAQ:AAPL', category: 'stock' },
  { symbol: 'NASDAQ:NVDA', category: 'stock' },
  { symbol: 'NASDAQ:MSFT', category: 'stock' },
  { symbol: 'NASDAQ:GOOGL', category: 'stock' },
  { symbol: 'NASDAQ:AMZN', category: 'stock' },
  { symbol: 'NASDAQ:META', category: 'stock' },
  { symbol: 'NASDAQ:TSLA', category: 'stock' },
  { symbol: 'NASDAQ:AMD', category: 'stock' },
  { symbol: 'NASDAQ:NFLX', category: 'stock' },
  { symbol: 'NASDAQ:INTC', category: 'stock' },
  { symbol: 'NYSE:JPM', category: 'stock' },
  { symbol: 'NYSE:V', category: 'stock' },
  { symbol: 'NYSE:JNJ', category: 'stock' },
  { symbol: 'NYSE:UNH', category: 'stock' },
  // Indices
  { symbol: 'SP:SPX', category: 'index', label: 'S&P 500', title: 'S&P 500' },
  { symbol: 'NASDAQ:NDX', category: 'index', label: 'NASDAQ 100', title: 'Nasdaq 100' },
  { symbol: 'TVC:DJI', category: 'index', label: 'DOW JONES', title: 'Dow Jones Industrial' },
  { symbol: 'TVC:DXY', category: 'index', label: 'DXY', title: 'Índice del dólar' },
  { symbol: 'TVC:DEU40', category: 'index', label: 'DAX', title: 'DAX 40 (Alemania)' },
  { symbol: 'TVC:UKX', category: 'index', label: 'FTSE 100', title: 'FTSE 100 (Reino Unido)' },
  { symbol: 'TVC:CAC40', category: 'index', label: 'CAC 40', title: 'CAC 40 (Francia)' },
  { symbol: 'TVC:SX5E', category: 'index', label: 'EURO STOXX 50', title: 'Euro Stoxx 50' },
  { symbol: 'TVC:NI225', category: 'index', label: 'NIKKEI', title: 'Nikkei 225 (Japón)' },
  { symbol: 'TVC:HSI', category: 'index', label: 'HANG SENG', title: 'Hang Seng (Hong Kong)' },
  { symbol: 'TVC:VIX', category: 'index', label: 'VIX', title: 'Índice de volatilidad' },
  { symbol: 'TVC:US10Y', category: 'index', label: 'US10Y', title: 'Bono de EE. UU. a 10 años' },
  { symbol: 'TVC:US02Y', category: 'index', label: 'US02Y', title: 'Bono de EE. UU. a 2 años' },
]
