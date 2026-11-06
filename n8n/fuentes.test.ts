import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// El pipeline lee fuentes oficiales (dominio público o reutilización libre con atribución) e Investing.com (se mantiene por decisión
// informada del usuario) y reparte las notas entre todas. Ver docs/fuentes.md para el análisis de términos de cada fuente.

interface Nodo {
  name: string
  type: string
  parameters: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}
const texto = readFileSync('n8n/pipeline-noticias.json', 'utf8')
const flujo = JSON.parse(texto) as { nodes: Nodo[]; connections: Record<string, { main: { node: string; index: number }[][] }> }
const nodo = (name: string) => flujo.nodes.find((n) => n.name === name)!
const rss = flujo.nodes.filter((n) => n.type.endsWith('rssFeedRead'))

const DOMINIOS = ['cftc.gov', 'cftc.gov', 'investing.com', 'federalreserve.gov', 'sec.gov', 'ecb.europa.eu', 'eia.gov', 'bea.gov', 'occ.gov', 'fdic.gov']
const OFICIALES = ['CFTC', 'Reserva Federal', 'SEC', 'BCE', 'EIA', 'BEA', 'OCC', 'FDIC', 'EDGAR']

describe('fuentes del pipeline', () => {
  it('los feeds RSS son los esperados: organismos oficiales e Investing.com (EDGAR y Massive entran por su propia cadena)', () => {
    expect(rss.map((n) => new URL(n.parameters.url).hostname.replace(/^www\./, '')).sort()).toEqual([...DOMINIOS].sort())
  })

  it('siguen fuera las demás fuentes comerciales cuyos términos prohíben copiar, raspar o reescribir su contenido', () => {
    expect(texto).not.toMatch(/cointelegraph|coindesk|fxstreet|cnbc|seekingalpha|oilprice/i)
  })

  it('todas las fuentes entran al Merge, cada una en su propia entrada, y el Merge tiene exactamente esas entradas', () => {
    const origenes = [...rss.map((n) => n.name), 'EDGAR - Items', 'Massive - Items']
    expect(nodo('Fuentes Combinadas').parameters.numberInputs).toBe(origenes.length)
    const entradas = origenes.map((o) => flujo.connections[o].main[0].find((c) => c.node === 'Fuentes Combinadas')!.index).sort((a, b) => a - b)
    expect(entradas).toEqual(origenes.map((_, i) => i))
    expect(flujo.connections['Publicados recientes'].main[0].map((c) => c.node).sort()).toEqual([...rss.map((n) => n.name), 'EDGAR 8-K', 'Massive activo?'].sort())
  })

  it('las fuentes oficiales tienen ventana de 7 días e Investing.com, la de 24 h', () => {
    const cond = nodo('Filtro Calidad').parameters.conditions.conditions.find((c: { id: string }) => c.id === 'reciente').leftValue as string
    for (const f of OFICIALES) expect(cond).toContain(`'${f}'`)
    expect(cond).not.toContain('Investing')
    expect(cond).not.toContain('GlobeNewswire')
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
      'https://www.occ.gov/news-issuances/news-releases/2026/nr-occ-2026-1.html',
      'https://www.fdic.gov/news/press-releases/2026/pr26001.html',
      'https://www.sec.gov/Archives/edgar/data/1336917/000133691726000160/0001336917-26-000160-index.htm',
    ])
    expect(r.map((x) => x.json.fuente)).toEqual(OFICIALES)
    expect(correr(['https://www.investing.com/news/stock-market-news/x-123'])[0].json.fuente).toBe('Investing.com')
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
    ({ 'Investing.com': 'https://www.investing.com/n/', CFTC: 'https://www.cftc.gov/p/', 'Reserva Federal': 'https://www.federalreserve.gov/p/', SEC: 'https://www.sec.gov/p/', BCE: 'https://www.ecb.europa.eu/press/pr/', EIA: 'https://www.eia.gov/t/', BEA: 'https://www.bea.gov/n/' } as Record<string, string>)[f] + n

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

  it('Investing.com no desplaza a las oficiales: con muchas notas suyas y una oficial, entran las dos', () => {
    const r = elegir(
      [{ fuente: 'Investing.com', h: 0.1 }, { fuente: 'Investing.com', h: 0.2 }, { fuente: 'Investing.com', h: 0.3 }, { fuente: 'Investing.com', h: 0.4 }, { fuente: 'CFTC', h: 30 }],
      { 'Investing.com': 20 }
    )
    expect(r).toHaveLength(3)
    expect(r[0]).toBe('CFTC-4')
    expect(r.filter((t) => t.startsWith('Investing.com')).length).toBe(2)
  })

  it('cuando las oficiales no tienen nada, Investing.com llena las plazas (el volumen no se hunde)', () => {
    expect(elegir([{ fuente: 'Investing.com', h: 1 }, { fuente: 'Investing.com', h: 2 }, { fuente: 'Investing.com', h: 3 }, { fuente: 'Investing.com', h: 4 }])).toHaveLength(3)
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
  const migracion = readFileSync('supabase/migrations/0011_fuentes_publicas.sql', 'utf8') + readFileSync('supabase/migrations/0012_fuentes_edgar_y_otras.sql', 'utf8')
  const mapaDe = (codigo: string) => {
    const m = codigo.match(/\{\s*'CFTC': \d+[^}]*\}/)!
    return Object.fromEntries([...m[0].matchAll(/'([^']+)':\s*(\d+)/g)].map((x) => [x[1], Number(x[2])]))
  }
  const esperado = { CFTC: 11, 'Investing.com': 4, 'Reserva Federal': 9, SEC: 10, BCE: 12, EIA: 13, BEA: 14, EDGAR: 15, OCC: 16, FDIC: 17, GlobeNewswire: 18 }

  it('los tres sitios del flujo que traducen fuente -> id usan el mismo mapa', () => {
    expect(mapaDe(nodo('Parsear JSON').parameters.jsCode)).toEqual(esperado)
    expect(mapaDe(JSON.stringify(nodo('Reservar URL').parameters).replace(/\\"/g, '"'))).toEqual(esperado)
    expect(mapaDe(JSON.stringify(nodo('Guardar duplicado').parameters).replace(/\\"/g, '"'))).toEqual(esperado)
  })

  it('la migración crea exactamente los ids nuevos que usa el flujo', () => {
    for (const id of [12, 13, 14, 15, 16, 17, 18]) expect(migracion).toMatch(new RegExp(`\\(${id}, '`))
    expect(migracion).toContain('on conflict (id) do nothing')
  })
})

describe('EDGAR (filings 8-K)', () => {
  const correr = (nombre: string, json: unknown) => new Function('$json', '$', '$env', nodo(nombre).parameters.jsCode)(json, () => ({}), {}) as { json: Record<string, string> }[]
  const entrada = (titulo: string, items: string, enlace = 'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm') =>
    `<entry><title>${titulo}</title><link rel="alternate" type="text/html" href="${enlace}"/><summary type="html">&lt;b&gt;Filed:&lt;/b&gt; 2026-11-06 &lt;br&gt;${items}</summary><updated>2026-11-06T07:43:14-05:00</updated></entry>`

  it('convierte los filings 8-K con apartados que son noticia en items normalizados', () => {
    const atom = entrada('8-K - TechTarget, Inc. (0002018064) (Filer)', 'Item 2.02: Results of Operations and Financial Condition &lt;br&gt;Item 9.01: Financial Statements and Exhibits')
    const [i] = correr('EDGAR - Items', { data: atom })
    expect(i.json.title).toBe('TechTarget, Inc. - Form 8-K: Results of Operations and Financial Condition')
    expect(i.json.fuente).toBe('EDGAR')
    expect(i.json.pubDate).toBe('2026-11-06T07:43:14-05:00')
    expect(i.json.contentSnippet.length).toBeGreaterThanOrEqual(30)
    expect(i.json.link).toContain('-index.htm')
  })

  it('descarta los apartados sin interés (9.01 solo, 7.01…), las enmiendas 8-K/A y los repetidos', () => {
    const atom = [
      entrada('8-K - Solo Anexos Inc (0000000001) (Filer)', 'Item 9.01: Financial Statements and Exhibits', 'https://www.sec.gov/a-index.htm'),
      entrada('8-K/A - Enmienda Inc (0000000002) (Filer)', 'Item 2.02: Results of Operations', 'https://www.sec.gov/b-index.htm'),
      entrada('8-K - Buena Inc (0000000003) (Filer)', 'Item 5.02: Departure of Directors or Certain Officers', 'https://www.sec.gov/c-index.htm'),
      entrada('8-K - Buena Inc (0000000003) (Subject)', 'Item 5.02: Departure of Directors or Certain Officers', 'https://www.sec.gov/c-index.htm'),
    ].join('')
    expect(correr('EDGAR - Items', { data: atom }).map((x) => x.json.title)).toEqual(['Buena Inc - Form 8-K: Departure of Directors or Certain Officers'])
  })

  it('si el feed falla (sin cuerpo), no devuelve nada en vez de romper el pipeline', () => {
    expect(correr('EDGAR - Items', { error: 'timeout' })).toEqual([])
  })

  it('elige el comunicado de prensa (EX-99.1) y, si no hay, el documento principal; los enlaces del visor se limpian', () => {
    const fila = (n: number, href: string, tipo: string) => `<tr><td>${n}</td><td>desc</td><td><a href="${href}">x.htm</a></td><td>${tipo}</td><td>1</td></tr>`
    const con = correr('EDGAR - Elegir documento', { data: '<table>' + fila(1, '/ix?doc=/Archives/edgar/data/1/a8k.htm', '8-K') + fila(2, '/Archives/edgar/data/1/ex991.htm', 'EX-99.1') + '</table>' })[0].json
    expect(con).toEqual({ url: 'https://www.sec.gov/Archives/edgar/data/1/ex991.htm', tipo: 'EX-99.1' })
    const sin = correr('EDGAR - Elegir documento', { data: '<table>' + fila(1, '/ix?doc=/Archives/edgar/data/1/a8k.htm', '8-K') + fila(2, '/Archives/edgar/data/1/img.jpg', 'GRAPHIC') + '</table>' })[0].json
    expect(sin).toEqual({ url: 'https://www.sec.gov/Archives/edgar/data/1/a8k.htm', tipo: '8-K' })
    expect(correr('EDGAR - Elegir documento', { data: '<html>vacío</html>' })[0].json.url).toBe('')
  })

  it('el texto sale limpio (sin etiquetas, scripts ni entidades) con la misma forma que Firecrawl', () => {
    const html = '<html><style>p{}</style><script>x()</script><body><p>Under&nbsp;Armour reports &amp; grows</p><div>Revenue: $1.2&nbsp;billion</div></body></html>'
    const markdown = (correr('EDGAR - Texto', { data: html })[0].json as unknown as { data: { markdown: string } }).data.markdown
    expect(markdown).toBe('Under Armour reports & grows\nRevenue: $1.2 billion')
  })

  it('los filings no pasan por Firecrawl: la SEC exige identificarse y no admite bots sin clasificar', () => {
    expect(flujo.connections['Es EDGAR?'].main[0].map((c) => c.node)).toEqual(['EDGAR - Indice'])
    expect(flujo.connections['Es EDGAR?'].main[1].map((c) => c.node)).toEqual(['Obtener articulo completo'])
    expect(flujo.connections['EDGAR - Texto'].main[0].map((c) => c.node)).toEqual(['Extraer contenido completo'])
    for (const n of ['EDGAR 8-K', 'EDGAR - Indice', 'EDGAR - Documento']) {
      const ua = nodo(n).parameters.headerParameters.parameters.find((h: { name: string }) => h.name === 'User-Agent')
      expect(ua.value).toContain('SEC_USER_AGENT')
      expect(ua.value).toMatch(/@/)
    }
  })
})

describe('Massive (noticias): interruptor y solo GlobeNewswire', () => {
  const correr = (json: unknown) => new Function('$json', '$', '$env', nodo('Massive - Items').parameters.jsCode)(json, () => ({}), {}) as { json: Record<string, string> }[]
  const articulo = (editor: string, descripcion = 'x'.repeat(250)) => ({ title: ' Titular  de prueba ', article_url: 'https://www.globenewswire.com/news-release/2026/11/06/1/0/x.html', description: descripcion, published_utc: '2026-11-06T10:00:00Z', publisher: { name: editor } })

  it('queda apagado salvo que MASSIVE_NEWS_ACTIVO sea "true", y la llave sale de una credencial de n8n', () => {
    expect(String(nodo('Massive activo?').parameters.conditions.conditions[0].leftValue)).toContain("MASSIVE_NEWS_ACTIVO === 'true'")
    expect(nodo('Massive - Noticias').parameters.genericAuthType).toBe('httpHeaderAuth')
    expect(texto).not.toMatch(/NVKFQ|Bearer [A-Za-z0-9_-]{20,}/)
  })

  it('solo pasan los comunicados de GlobeNewswire; los medios (Motley Fool, Zacks) y los resúmenes cortos quedan fuera', () => {
    const r = correr({ results: [articulo('GlobeNewswire Inc.'), articulo('The Motley Fool'), articulo('Zacks Investment Research'), articulo('GlobeNewswire Inc.', 'corto')] })
    expect(r).toHaveLength(1)
    expect(r[0].json).toMatchObject({ title: 'Titular de prueba', fuente: 'GlobeNewswire', pubDate: '2026-11-06T10:00:00Z' })
    expect(r[0].json.link).toContain('globenewswire.com')
  })

  it('si la API falla no devuelve nada', () => {
    expect(correr({ error: { message: 'NOT_AUTHORIZED' } })).toEqual([])
  })
})
