// Generates public/globo/tierra-mascara-{2048,4096}.png: una mascara en blanco y negro
// (tierra blanca, agua negra) en proyeccion equirectangular, a partir de world-atlas/land-50m.json.
// Se genera localmente y se commitea el PNG en vez de descargar una textura de un CDN en runtime:
// la CSP del sitio (next.config.ts) solo permite 'self' para imagenes/fuentes, asi que una textura
// remota no cargaria en el navegador de todos modos.
import { createCanvas } from '@napi-rs/canvas'
import { geoEquirectangular, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'globo')
mkdirSync(outDir, { recursive: true })

const landTopologyPath = require.resolve('world-atlas/land-50m.json')
const landTopology = JSON.parse(readFileSync(landTopologyPath, 'utf8'))
const land = feature(landTopology, landTopology.objects.land)

function renderMask(width, height, outFile) {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Agua = negro
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)

  const projection = geoEquirectangular().fitSize([width, height], land)
  const path = geoPath(projection, ctx)

  // Tierra = blanco
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  path(land)
  ctx.fill()

  writeFileSync(join(outDir, outFile), canvas.toBuffer('image/png'))
  console.log(`Escrito public/globo/${outFile} (${width}x${height})`)
}

// Solo se usa la de 2048 para el muestreo (components/globe/GloboHolografico.tsx la reduce
// a 1024x512 de todos modos antes de leer pixeles) — no se genera una de 4096 sin uso real.
renderMask(2048, 1024, 'tierra-mascara-2048.png')
