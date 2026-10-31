// API de CoinGecko. Con COINGECKO_API_KEY (llave gratuita "Demo") las peticiones van identificadas y con el cupo
// propio de la cuenta; sin ella se usa el acceso anónimo, que CoinGecko limita mucho más (ver el cooldown de 429
// en lib/prices.ts). Términos: https://www.coingecko.com/en/api_terms — exigen mostrar "Powered by CoinGecko".

export const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

// Enlace de la atribución obligatoria
export const COINGECKO_CREDIT_URL = 'https://www.coingecko.com/?utm_source=grizzlytraders&utm_medium=referral'

export function coingeckoHeaders(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const key = env.COINGECKO_API_KEY?.trim()
  return key ? { Accept: 'application/json', 'x-cg-demo-api-key': key } : { Accept: 'application/json' }
}
