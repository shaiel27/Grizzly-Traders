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

// IMPORTANTE: antes esto usaba geoEquirectangular().fitSize([width,height], land) — ajusta
// escala/traslacion al bounding box de la TIERRA (no de todo el planeta), que es mas angosto en
// latitud que -90..90 (no hay tierra pegada a los polos exactos). components/globe/
// muestrearTierra.ts convierte lat/lon a pixel con una formula lineal que SI asume el globo
// completo (px = (lon+PI)/(2*PI)*width, py = (PI/2-lat)/PI*height) — con fitSize, esa formula
// y la proyeccion real de la mascara quedaban desalineadas (un desplazamiento chico cerca del
// centro, mucho mas grande hacia los bordes). Se noto recien al verificar a mano el mapa de
// regiones: Tokio y Sidney caian en pixeles de AGUA, Londres caia en el pixel de Alemania.
// Esta funcion fuerza escala/traslacion EXPLICITAS para que el globo completo (-180..180,
// -90..90) mapee exacto a [0,width]x[0,height] — la misma formula que ya asume el muestreo.
function proyeccionGlobal(width, height) {
  return geoEquirectangular()
    .scale(width / (2 * Math.PI))
    .translate([width / 2, height / 2])
}

// Plan 009 §3.2: regiones para el mapa de calor del sentimiento. Los ids de pais son el codigo
// ISO 3166-1 numerico (como string de 3 digitos, asi los trae world-atlas/countries-50m.json).
// 0 = ninguna region, 1-6 = las de abajo. El canal R de regiones-2048.png guarda id*40 (40, 80,
// 120...) — pasos bien separados, sobreviven un poco de antialiasing en los bordes sin que
// muestrearTierra.ts (que redondea al mas cercano) confunda una region con otra.
const REGIONES = [
  { id: 1, paises: ['840'] }, // EE. UU.
  { id: 2, paises: ['276', '250', '380', '724', '528', '056', '040', '620', '372', '246'] }, // Eurozona: DE FR IT ES NL BE AT PT IE FI
  { id: 3, paises: ['826'] }, // Reino Unido
  { id: 4, paises: ['392'] }, // Japon
  { id: 5, paises: ['156'] }, // China
  { id: 6, paises: ['036'] }, // Australia
]

function renderMask(width, height, outFile) {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Agua = negro
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)

  const projection = proyeccionGlobal(width, height)
  const path = geoPath(projection, ctx)

  // Tierra = blanco
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  path(land)
  ctx.fill()

  writeFileSync(join(outDir, outFile), canvas.toBuffer('image/png'))
  console.log(`Escrito public/globo/${outFile} (${width}x${height})`)
}

function renderRegiones(width, height, outFile) {
  const countriesTopologyPath = require.resolve('world-atlas/countries-50m.json')
  const countriesTopology = JSON.parse(readFileSync(countriesTopologyPath, 'utf8'))
  const countries = feature(countriesTopology, countriesTopology.objects.countries).features
  // OJO: mas de un feature puede compartir el mismo id ISO numerico (territorios externos usan
  // el codigo del pais del que dependen — p.ej. "Ashmore and Cartier Is." tiene el mismo id que
  // Australia, 036). Un Map id->feature se queda solo con el ULTIMO del array y perdia el
  // continente entero (Australia no pintaba nada, el id quedaba apuntando a esa isla minuscula
  // sin que nada avisara, confirmado muestreando el PNG a mano). Agrupar en listas evita perder
  // features por una colision de id.
  const porId = new Map()
  for (const c of countries) {
    const lista = porId.get(c.id) ?? []
    lista.push(c)
    porId.set(c.id, lista)
  }

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)

  // MISMA proyeccion exacta que la mascara de tierra (ver proyeccionGlobal arriba) — si usaran
  // proyecciones distintas, un lat/lon dado caeria en un pixel distinto en cada mascara y el
  // muestreo (components/globe/muestrearTierra.ts) asignaria la region equivocada a cada punto.
  const projection = proyeccionGlobal(width, height)
  const path = geoPath(projection, ctx)

  for (const region of REGIONES) {
    const gris = region.id * 40
    ctx.fillStyle = `rgb(${gris},${gris},${gris})`
    for (const codigoPais of region.paises) {
      const features = porId.get(codigoPais)
      if (!features || features.length === 0) {
        console.warn(`Aviso: no se encontro el pais ${codigoPais} (region ${region.id}) en countries-50m.json`)
        continue
      }
      for (const pais of features) {
        ctx.beginPath()
        path(pais)
        ctx.fill()
      }
    }
  }

  writeFileSync(join(outDir, outFile), canvas.toBuffer('image/png'))
  console.log(`Escrito public/globo/${outFile} (${width}x${height})`)
}

// components/globe/GloboHolografico.tsx muestrea esta mascara a su resolucion real (2048x1024)
// — no se genera una de 4096 sin uso real.
renderMask(2048, 1024, 'tierra-mascara-2048.png')
renderRegiones(2048, 1024, 'regiones-2048.png')
