// Genera lib/cover/assets.generated.ts con los SVG de banderas (flag-icons, MIT) y de criptomonedas
// (cryptocurrency-icons, CC0) que se pueden poner en las portadas. Los SVG van incrustados en el código para que el
// servidor no dependa de node_modules en tiempo de ejecución. Se ejecuta a mano: `node scripts/build-cover-assets.mjs`.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const FLAGS = [
  'us', 'eu', 'gb', 'jp', 'cn', 'de', 'fr', 'it', 'es', 'ca', 'au', 'nz', 'ch', 'mx', 'br', 'ar', 'cl', 'co', 'pe', 've',
  'in', 'id', 'kr', 'tw', 'hk', 'sg', 'th', 'my', 'ph', 'vn', 'tr', 'ru', 'ua', 'pl', 'se', 'no', 'dk', 'nl', 'be', 'pt',
  'ie', 'at', 'gr', 'za', 'ng', 'eg', 'sa', 'ae', 'il', 'ir', 'iq', 'qa', 'kw', 'pk', 'bd', 'cz', 'hu', 'ro', 'fi', 'sy', 'ly',
]
const CRYPTO = ['btc', 'eth', 'sol', 'xrp', 'ada', 'doge', 'bnb', 'dot', 'avax', 'link', 'ltc', 'uni', 'atom', 'near', 'matic', 'usdt', 'usdc', 'trx', 'shib', 'xlm', 'bch', 'etc']

const compact = (svg) => svg.replace(/<\?xml[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/> </g, '><').trim()

function collect(dir, names, label) {
  const out = {}
  for (const name of names) {
    const file = `${dir}/${name}.svg`
    if (!existsSync(file)) {
      console.warn(`falta ${label} ${name}`)
      continue
    }
    out[name.toUpperCase()] = compact(readFileSync(file, 'utf8'))
  }
  return out
}

const flags = collect('node_modules/flag-icons/flags/1x1', FLAGS, 'bandera')
const crypto = collect('node_modules/cryptocurrency-icons/svg/color', CRYPTO, 'cripto')

const body = `// GENERADO por scripts/build-cover-assets.mjs: no editar a mano.
// Banderas: flag-icons (MIT). Criptomonedas: cryptocurrency-icons (CC0).

export const FLAG_SVG: Record<string, string> = ${JSON.stringify(flags, null, 1)}

export const CRYPTO_SVG: Record<string, string> = ${JSON.stringify(crypto, null, 1)}
`
writeFileSync('lib/cover/assets.generated.ts', body)
console.log(`banderas ${Object.keys(flags).length}, criptos ${Object.keys(crypto).length}, ${(body.length / 1024).toFixed(0)} KB`)
