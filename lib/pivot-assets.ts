export type PivotCategory = 'crypto' | 'forex' | 'commodity' | 'index' | 'stock'

export interface PivotAsset {
  // TradingView ticker; the scanner echoes it back, so it identifies the asset everywhere
  tv: string
  label: string
  name: string
  category: PivotCategory
}

export const PIVOT_CATEGORIES: { key: PivotCategory; label: string }[] = [
  { key: 'crypto', label: 'Cripto' },
  { key: 'forex', label: 'Forex' },
  { key: 'commodity', label: 'Materias primas' },
  { key: 'index', label: 'Índices' },
  { key: 'stock', label: 'Acciones' },
]

// Every ticker below was checked against the scanner: an unknown one silently disappears from the results
export const PIVOT_ASSETS: PivotAsset[] = [
  { tv: 'BINANCE:BTCUSDT', label: 'BTC/USD', name: 'Bitcoin', category: 'crypto' },
  { tv: 'BINANCE:ETHUSDT', label: 'ETH/USD', name: 'Ethereum', category: 'crypto' },
  { tv: 'BINANCE:SOLUSDT', label: 'SOL/USD', name: 'Solana', category: 'crypto' },
  { tv: 'BINANCE:BNBUSDT', label: 'BNB/USD', name: 'BNB', category: 'crypto' },
  { tv: 'BINANCE:XRPUSDT', label: 'XRP/USD', name: 'XRP', category: 'crypto' },
  { tv: 'BINANCE:ADAUSDT', label: 'ADA/USD', name: 'Cardano', category: 'crypto' },
  { tv: 'BINANCE:DOGEUSDT', label: 'DOGE/USD', name: 'Dogecoin', category: 'crypto' },
  { tv: 'BINANCE:AVAXUSDT', label: 'AVAX/USD', name: 'Avalanche', category: 'crypto' },
  { tv: 'BINANCE:LINKUSDT', label: 'LINK/USD', name: 'Chainlink', category: 'crypto' },
  { tv: 'FX:EURUSD', label: 'EUR/USD', name: 'Euro / Dólar', category: 'forex' },
  { tv: 'FX:GBPUSD', label: 'GBP/USD', name: 'Libra / Dólar', category: 'forex' },
  { tv: 'FX:USDJPY', label: 'USD/JPY', name: 'Dólar / Yen', category: 'forex' },
  { tv: 'FX:AUDUSD', label: 'AUD/USD', name: 'Dólar australiano / Dólar', category: 'forex' },
  { tv: 'FX:USDCAD', label: 'USD/CAD', name: 'Dólar / Dólar canadiense', category: 'forex' },
  { tv: 'FX:USDCHF', label: 'USD/CHF', name: 'Dólar / Franco suizo', category: 'forex' },
  { tv: 'OANDA:XAUUSD', label: 'XAU/USD', name: 'Oro', category: 'commodity' },
  { tv: 'TVC:SILVER', label: 'XAG/USD', name: 'Plata', category: 'commodity' },
  { tv: 'ICEEUR:BRN1!', label: 'BRENT', name: 'Petróleo Brent', category: 'commodity' },
  { tv: 'NYMEX:CL1!', label: 'WTI', name: 'Petróleo WTI', category: 'commodity' },
  { tv: 'NYMEX:NG1!', label: 'GAS NAT.', name: 'Gas natural', category: 'commodity' },
  { tv: 'SP:SPX', label: 'S&P 500', name: 'S&P 500', category: 'index' },
  { tv: 'NASDAQ:NDX', label: 'NASDAQ 100', name: 'Nasdaq 100', category: 'index' },
  { tv: 'TVC:DJI', label: 'DOW JONES', name: 'Dow Jones', category: 'index' },
  { tv: 'TVC:DXY', label: 'DXY', name: 'Índice del dólar', category: 'index' },
  { tv: 'TVC:DEU40', label: 'DAX', name: 'DAX 40', category: 'index' },
  { tv: 'TVC:UKX', label: 'FTSE 100', name: 'FTSE 100', category: 'index' },
  { tv: 'TVC:NI225', label: 'NIKKEI', name: 'Nikkei 225', category: 'index' },
  { tv: 'NASDAQ:AAPL', label: 'AAPL', name: 'Apple', category: 'stock' },
  { tv: 'NASDAQ:NVDA', label: 'NVDA', name: 'Nvidia', category: 'stock' },
  { tv: 'NASDAQ:MSFT', label: 'MSFT', name: 'Microsoft', category: 'stock' },
  { tv: 'NASDAQ:TSLA', label: 'TSLA', name: 'Tesla', category: 'stock' },
  { tv: 'NASDAQ:AMZN', label: 'AMZN', name: 'Amazon', category: 'stock' },
  { tv: 'NASDAQ:META', label: 'META', name: 'Meta', category: 'stock' },
  { tv: 'NASDAQ:GOOGL', label: 'GOOGL', name: 'Alphabet', category: 'stock' },
]

export const PIVOT_ASSET_BY_TV = new Map(PIVOT_ASSETS.map((asset) => [asset.tv, asset]))

// Shortcuts shown in the calculator
export const POPULAR_PIVOT_ASSETS = [
  'BINANCE:BTCUSDT',
  'BINANCE:ETHUSDT',
  'FX:EURUSD',
  'FX:GBPUSD',
  'OANDA:XAUUSD',
  'SP:SPX',
  'NASDAQ:NVDA',
  'NASDAQ:AAPL',
]
