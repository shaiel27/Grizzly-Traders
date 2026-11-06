import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Antes, cualquier etiqueta de GPT que no fuera EXACTAMENTE una de las cuatro caía en la categoría 1 (Criptomonedas): artículos de banca europea,
// IMUNON, Chery o Lilly aparecían ahí. La categoría ahora se normaliza y, si no cuadra, se decide por el tema; la 1 solo si el tema ES cripto.

const CRIPTO = 1
const FOREX = 2
const MATERIAS = 3
const ACCIONES = 4

function cargarClasificador(archivo: string, nodo: string) {
  const flujo = JSON.parse(readFileSync(archivo, 'utf8')) as { nodes: { name: string; parameters: { jsCode?: string } }[] }
  const codigo = flujo.nodes.find((n) => n.name === nodo)!.parameters.jsCode!
  const inicio = codigo.indexOf('// CATEGORIA-INICIO')
  const fin = codigo.indexOf('// CATEGORIA-FIN')
  expect(inicio).toBeGreaterThanOrEqual(0)
  expect(fin).toBeGreaterThan(inicio)
  const fn = new Function(codigo.slice(inicio, fin) + '\nreturn clasificarCategoria;')
  return { clasificar: fn() as (etiqueta: unknown, titulo: string, texto: string) => number, codigo }
}

const flujos = [
  { nombre: 'pipeline de noticias', ...cargarClasificador('n8n/pipeline-noticias.json', 'Parsear JSON') },
  { nombre: 'flujo del CMS asistido', ...cargarClasificador('n8n/cms-editorial.json', 'Parsear analisis') },
]

describe.each(flujos)('categoría en el $nombre', ({ clasificar, codigo }) => {
  it('ya no existe el valor por defecto que mandaba todo a Criptomonedas', () => {
    expect(codigo).not.toMatch(/categoryMap\[[^\]]*\]\s*\|\|\s*1/)
    expect(codigo).not.toMatch(/\|\|\s*1;\s*$/m)
  })

  it('una etiqueta que no es de las cuatro (banca, salud, tecnología…) cae en Acciones, no en Criptomonedas', () => {
    expect(clasificar('banca', 'Datos consolidados del sector bancario de la UE al cierre de junio de 2026', 'Los bancos de la UE...')).toBe(ACCIONES)
    expect(clasificar('biotecnologia', 'IMUNON presenta datos prometedores en SITC 2026 sobre la inmunidad antitumoral en cáncer de ovario', 'La empresa presentó...')).toBe(ACCIONES)
    expect(clasificar('salud', 'Lilly se asocia con Hims & Hers para distribuir medicamentos para la pérdida de peso', '')).toBe(ACCIONES)
    expect(clasificar(undefined, 'Chery presenta su estrategia de globalización 3.0', '')).toBe(ACCIONES)
    expect(clasificar(null, 'Stellantis alarga la parada de producción del Fiat 500', '')).toBe(ACCIONES)
  })

  it('normaliza mayúsculas, acentos, espacios y sinónimos (antes "Acciones" con mayúscula ya fallaba)', () => {
    expect(clasificar('Acciones', 'Resultados de Apple', '')).toBe(ACCIONES)
    expect(clasificar(' FOREX ', 'Sin pistas', '')).toBe(FOREX)
    expect(clasificar('Materias Primas', 'Sin pistas', '')).toBe(MATERIAS)
    expect(clasificar('commodities', 'Sin pistas', '')).toBe(MATERIAS)
    expect(clasificar('Criptomonedas', 'Bitcoin supera los 80.000 dólares', '')).toBe(CRIPTO)
    expect(clasificar('crypto', 'Ethereum sube tras la actualización', '')).toBe(CRIPTO)
  })

  it('"criptomonedas" solo si el tema es cripto: si GPT lo dice pero el texto habla de otra cosa, no se confía', () => {
    expect(clasificar('criptomonedas', 'IMUNON presenta datos en SITC 2026', 'Inmunidad antitumoral en cáncer de ovario')).toBe(ACCIONES)
    expect(clasificar('criptomonedas', 'Adam Goldstein asume la presidencia del Federal Home Loan Bank de Nueva York', '')).toBe(ACCIONES)
    expect(clasificar('criptomonedas', 'El BCE mantiene los tipos', 'Tasas de interés sin cambios')).toBe(FOREX)
  })

  it('sin etiqueta, decide por el tema: divisas → Forex, petróleo y metales → Materias primas, cripto → Criptomonedas', () => {
    expect(clasificar('', 'El dólar se mantiene mientras el yen avanza', '')).toBe(FOREX)
    expect(clasificar('', 'La libra se deprecia antes de la decisión del BoE', '')).toBe(FOREX)
    expect(clasificar('', 'Monedas asiáticas se fortalecen mientras el dólar se debilita', '')).toBe(FOREX)
    expect(clasificar('', 'La inflación en Alemania se desacelera más de lo previsto', '')).toBe(FOREX)
    expect(clasificar('', 'El petróleo Brent cae un 2%', '')).toBe(MATERIAS)
    expect(clasificar('', 'El oro marca máximos históricos', '')).toBe(MATERIAS)
    expect(clasificar('', 'Zcash lanza su primer ETP en Europa', '')).toBe(CRIPTO)
    expect(clasificar('', 'Circle lanza Arc, su blockchain de stablecoins', '')).toBe(CRIPTO)
  })

  it('una palabra suelta en el cuerpo no cambia el tema: divisas y materias primas se deciden por el titular', () => {
    expect(clasificar('', 'Datos consolidados del sector bancario de la UE al cierre de junio de 2026', 'Los bancos de la zona euro reportaron un capital de nivel 1 del 16%. El tipo de cambio...')).toBe(ACCIONES)
    expect(clasificar('', 'Caída de precios de viviendas en el Reino Unido alcanza el 0.6% en octubre', 'El precio medio superó las 270.000 libras. Las tasas de interés...')).toBe(ACCIONES)
    expect(clasificar('', 'Inversores japoneses adquieren bonos extranjeros ante la caída de acciones tecnológicas', 'El yen se debilitó...')).toBe(ACCIONES)
    expect(clasificar('', 'Lilly se asocia con Hims & Hers', 'La empresa petrolera...  trigo y maíz')).toBe(ACCIONES)
  })

  it('lo que sí es cripto se queda en Criptomonedas aunque el titular no diga "bitcoin" (Ledger, tokenización, DLT, CBDC)', () => {
    expect(clasificar('', 'Ledger solicita la suspensión de ventas en Asia por investigación de manipulación', '')).toBe(CRIPTO)
    expect(clasificar('', 'El BCE invertirá en valores tokenizados a través de la DLT Pontes', '')).toBe(CRIPTO)
    expect(clasificar('', 'Bancos canadienses investigan depósitos tokenizados en dólares canadienses', '')).toBe(CRIPTO)
    expect(clasificar('', 'La AEVM focaliza la supervisión de la IA y la tokenización en 2027', '')).toBe(CRIPTO)
    expect(clasificar('', 'El efectivo digital y sus desafíos de privacidad: informe del BPI', '')).toBe(CRIPTO)
    expect(clasificar('', 'Kalshi niega contacto de la CFTC por actividad de trading inusual', '')).toBe(CRIPTO)
  })

  it('una etiqueta válida de GPT se respeta aunque el texto tenga otras palabras', () => {
    expect(clasificar('forex', 'Resultados de un banco', 'El bitcoin se menciona de pasada')).toBe(FOREX)
    expect(clasificar('materias-primas', 'Mercados', '')).toBe(MATERIAS)
  })
})

describe('prompts de clasificación', () => {
  it('piden usar acciones para empresas, bancos, salud y tecnología, y cripto solo si el tema son criptoactivos', () => {
    for (const archivo of ['n8n/pipeline-noticias.json', 'n8n/cms-editorial.json']) {
      const texto = readFileSync(archivo, 'utf8')
      expect(texto).toContain('usa acciones para empresas, bancos, salud, tecnologia y economia en general')
      expect(texto).toContain('criptomonedas SOLO si el tema principal son criptoactivos')
    }
  })
})
