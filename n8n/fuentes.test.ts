import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Opción A: el pipeline lee SOLO fuentes públicas (dominio público o reutilización libre con atribución) y reparte las notas entre
// ellas. Ver docs/fuentes.md para el análisis de términos de cada fuente.

interface Nodo {
  name: string
  type: string
  parameters: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}
const texto = readFileSync('n8n/pipeline-noticias.json', 'utf8')
const flujo = JSON.parse(texto) as { nodes: Nodo[]; connections: Record<string, { main: { node: string; index: number }[][] }> }
const nodo = (name: string) => flujo.nodes.find((n) => n.name === name)!
const rss = flujo.nodes.filter((n) => n.type.endsWith('rssFeedRead'))

const DOMINIOS_PUBLICOS = ['cftc.gov', 'federalreserve.gov', 'sec.gov', 'ecb.europa.eu', 'eia.gov', 'bea.gov']
const FUENTES = ['CFTC', 'Reserva Federal', 'SEC', 'BCE', 'EIA', 'BEA']

describe('fuentes del pipeline: solo públicas', () => {
  it('cada feed es de un organismo público', () => {
    expect(rss.map((n) => new URL(n.parameters.url).hostname.replace(/^www\./, '')).sort()).toEqual([...DOMINIOS_PUBLICOS].sort())
  })

  it('no queda ninguna fuente comercial cuyos términos prohíben copiar, raspar o reescribir su contenido', () => {
    expect(texto).not.toMatch(/investing\.com|cointelegraph|coindesk|fxstreet|cnbc|seekingalpha|oilprice/i)
  })

  it('todos los feeds entran al Merge, cada uno en su propia entrada, y el Merge tiene exactamente esas entradas', () => {
    expect(nodo('Fuentes Combinadas').parameters.numberInputs).toBe(rss.length)
    const entradas = rss.map((n) => flujo.connections[n.name].main[0].find((c) => c.node === 'Fuentes Combinadas')!.index).sort()
    expect(entradas).toEqual(rss.map((_, i) => i))
    expect(flujo.connections['Publicados recientes'].main[0].map((c) => c.node).sort()).toEqual(rss.map((n) => n.name).sort())
  })

  it('las fuentes oficiales tienen ventana de 7 días', () => {
    const cond = nodo('Filtro Calidad').parameters.conditions.conditions.find((c: { id: string }) => c.id === 'reciente').leftValue as string
    for (const f of FUENTES) expect(cond).toContain(`'${f}'`)
  })
})

describe('Normalizar Item', () => {
  const CODIGO = nodo('Normalizar Item').parameters.jsCode as string
  const correr = (links: string[]) =>
    (new Function('$input', CODIGO)({ all: () => links.map((link) => ({ json: { title: 'T', link, contentSnippet: 'x'.repeat(40), isoDate: '2026-11-05T00:00:00Z' } })) }) as { json: { fuente: string; link: string } }[])

  it('etiqueta la fuente por el dominio del enlace', () => {
    const r = correr([
      'https://www.cftc.gov/PressRoom/PressReleases/9323-26',
      'https://www.federalreserve.gov/newsevents/pressreleases/x.htm',
      'https://www.sec.gov/newsroom/press-releases/2026-1',
      'https://www.ecb.europa.eu//press/pr/date/2026/html/ecb.pr261104~caf181d7ac.en.html',
      'https://www.eia.gov/todayinenergy/detail.php?id=68424',
      'https://www.bea.gov/news/2026/gdp-advance-estimate-3rd-quarter-2026',
    ])
    expect(r.map((x) => x.json.fuente)).toEqual(FUENTES)
  })

  it('del BCE solo entran los comunicados: discursos, entrevistas y blog llevan nombre de autor y piden permiso escrito', () => {
    const r = correr([
      'https://www.ecb.europa.eu//press/pr/date/2026/html/ecb.pr261104~caf181d7ac.en.html',
      'https://www.ecb.europa.eu//press/key/date/2026/html/ecb.sp261105_1~5e97d9d5a0.en.html',
      'https://www.ecb.europa.eu/press/inter/date/2026/html/ecb.in261101.en.html',
      'https://www.ecb.europa.eu/press/blog/date/2026/html/ecb.blog261101.en.html',
    ])
    expect(r.map((x) => x.json.link)).toEqual(['https://www.ecb.europa.eu//press/pr/date/2026/html/ecb.pr261104~caf181d7ac.en.html'])
  })
})

describe('Priorizar y limitar: reparto entre fuentes', () => {
  const CODIGO = nodo('Priorizar y limitar').parameters.jsCode as string
  const ahora = Date.now()
  const hace = (h: number) => new Date(ahora - h * 3_600_000).toISOString()
  const link = (f: string, n: number) =>
    ({ CFTC: 'https://www.cftc.gov/p/', 'Reserva Federal': 'https://www.federalreserve.gov/p/', SEC: 'https://www.sec.gov/p/', BCE: 'https://www.ecb.europa.eu/press/pr/', EIA: 'https://www.eia.gov/t/', BEA: 'https://www.bea.gov/n/' } as Record<string, string>)[f] + n

  function elegir(candidatas: { fuente: string; h: number }[], publicadas24h: Record<string, number> = {}) {
    const items = candidatas.map((c, i) => ({ json: { fuente: c.fuente, title: `${c.fuente}-${i}`, link: link(c.fuente, i), pubDate: hace(c.h) } }))
    const body = Object.entries(publicadas24h).flatMap(([f, n]) => Array.from({ length: n }, (_, k) => ({ source_url: link(f, 900 + k), created_at: hace(2) })))
    const dolar = (nombre: string) =>
      nombre === 'Normalizar Item' ? { itemMatching: (i: number) => ({ json: items[i].json }) } : { first: () => ({ json: { statusCode: 200, body } }) }
    const salida = new Function('$input', '$', CODIGO)({ all: () => items }, dolar) as { json: { title: string } }[]
    return salida.map((s) => s.json.title)
  }

  it('una fuente prolífica no se queda con todas las plazas: sale una nota por fuente', () => {
    const r = elegir([
      { fuente: 'EIA', h: 1 },
      { fuente: 'EIA', h: 2 },
      { fuente: 'EIA', h: 3 },
      { fuente: 'CFTC', h: 10 },
      { fuente: 'BCE', h: 20 },
    ])
    expect(r).toHaveLength(3)
    expect(new Set(r.map((t) => t.split('-')[0]))).toEqual(new Set(['EIA', 'CFTC', 'BCE']))
  })

  it('va primero la fuente que menos ha publicado en las últimas 24 h', () => {
    const r = elegir(
      [{ fuente: 'EIA', h: 1 }, { fuente: 'CFTC', h: 5 }, { fuente: 'BEA', h: 9 }, { fuente: 'SEC', h: 12 }],
      { EIA: 4, CFTC: 2, BEA: 0, SEC: 1 }
    )
    expect(r.map((t) => t.split('-')[0])).toEqual(['BEA', 'SEC', 'CFTC'])
  })

  it('si hay menos fuentes que plazas, se completa con las más recientes', () => {
    const r = elegir([{ fuente: 'EIA', h: 3 }, { fuente: 'EIA', h: 1 }, { fuente: 'EIA', h: 2 }, { fuente: 'EIA', h: 9 }])
    expect(r).toEqual(['EIA-1', 'EIA-2', 'EIA-0'])
  })

  it('sin candidatas no devuelve nada, y sin la lista de publicados reparte igual (por fecha)', () => {
    expect(elegir([])).toEqual([])
    const r = elegir([{ fuente: 'SEC', h: 2 }, { fuente: 'BEA', h: 1 }])
    expect(r).toEqual(['BEA-1', 'SEC-0'])
  })
})

describe('atribución estructurada (source_id)', () => {
  const migracion = readFileSync('supabase/migrations/0011_fuentes_publicas.sql', 'utf8')
  const mapaDe = (codigo: string) => {
    const m = codigo.match(/\{\s*'CFTC': \d+[^}]*\}/)!
    return Object.fromEntries([...m[0].matchAll(/'([^']+)':\s*(\d+)/g)].map((x) => [x[1], Number(x[2])]))
  }
  const esperado = { CFTC: 11, 'Reserva Federal': 9, SEC: 10, BCE: 12, EIA: 13, BEA: 14 }

  it('los tres sitios del flujo que traducen fuente -> id usan el mismo mapa', () => {
    expect(mapaDe(nodo('Parsear JSON').parameters.jsCode)).toEqual(esperado)
    expect(mapaDe(JSON.stringify(nodo('Reservar URL').parameters).replace(/\\"/g, '"'))).toEqual(esperado)
    expect(mapaDe(JSON.stringify(nodo('Guardar duplicado').parameters).replace(/\\"/g, '"'))).toEqual(esperado)
  })

  it('la migración crea exactamente los ids nuevos que usa el flujo', () => {
    for (const id of [12, 13, 14]) expect(migracion).toMatch(new RegExp(`\\(${id}, '`))
    expect(migracion).toContain('on conflict (id) do nothing')
  })
})
