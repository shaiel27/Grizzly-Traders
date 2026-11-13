import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Resiliencia del pipeline ante fallos de lectura (nov-2026): cupo por vuelta, lectura directa cuando Firecrawl falla,
// ahorro de créditos y fallos de infraestructura que no gastan intentos de la nota. Ver docs/fuentes.md.

interface Nodo {
  name: string
  type: string
  onError?: string
  parameters: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}
const flujo = JSON.parse(readFileSync('n8n/pipeline-noticias.json', 'utf8')) as { nodes: Nodo[]; connections: Record<string, { main: ({ node: string }[] | null)[] }> }
const nodo = (n: string) => flujo.nodes.find((x) => x.name === n)!
const codigo = (n: string) => nodo(n).parameters.jsCode as string
const destinos = (origen: string) => flujo.connections[origen].main.map((s) => (s ?? []).map((c) => c.node))

type Estatico = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

describe('cableado', () => {
  it('cada noticia pasa por el Control de cupo antes de procesarse, y al publicarse se cuenta', () => {
    expect(destinos('Loop Over Items')).toEqual([[], ['Control de cupo']])
    expect(destinos('Control de cupo')).toEqual([['Titulares recientes']])
    expect(destinos('Log ejecucion')).toEqual([['Contar publicado']])
    expect(destinos('Contar publicado')).toEqual([['Loop Over Items']])
  })

  it('la lectura de la página: primero la directa (gratuita); Firecrawl solo si esa no basta y hay saldo', () => {
    expect(destinos('Es EDGAR?')[1]).toEqual(['Decidir lectura'])
    expect(destinos('Decidir lectura')).toEqual([['¿Basta el resumen?']])
    expect(destinos('¿Basta el resumen?')).toEqual([['Extraer contenido completo'], ['Lectura directa']])
    expect(destinos('Lectura directa')).toEqual([['Texto de lectura directa']])
    expect(destinos('Texto de lectura directa')).toEqual([['¿La lectura directa bastó?']])
    expect(destinos('¿La lectura directa bastó?')).toEqual([['Extraer contenido completo'], ['¿Hay saldo en Firecrawl?']])
    expect(destinos('¿Hay saldo en Firecrawl?')).toEqual([['Obtener articulo completo'], ['Extraer contenido completo']])
    expect(destinos('Obtener articulo completo')).toEqual([['Evaluar Firecrawl']])
    expect(destinos('Evaluar Firecrawl')).toEqual([['Extraer contenido completo']])
  })

  it('Firecrawl solo se alcanza por la rama «la lectura directa NO bastó» y «hay saldo»: ninguna otra ruta gasta créditos', () => {
    const entradas = (destino: string) => Object.entries(flujo.connections).flatMap(([o, v]) => v.main.flatMap((s, i) => (s ?? []).filter((c) => c.node === destino).map(() => o + ':' + i)))
    expect(entradas('Obtener articulo completo')).toEqual(['¿Hay saldo en Firecrawl?:0'])
    expect(entradas('¿Hay saldo en Firecrawl?')).toEqual(['¿La lectura directa bastó?:1'])
    expect(nodo('¿La lectura directa bastó?').parameters.conditions.conditions[0].leftValue).toContain('>= 600')
    expect(nodo('¿Hay saldo en Firecrawl?').parameters.conditions.conditions[0].leftValue).toContain('sinSaldo !== true')
    expect(flujo.nodes.some((n) => n.name === '¿Usar Firecrawl?' || n.name === '¿Firecrawl leyó la página?')).toBe(false)
  })

  it('la lectura directa y la liberación de reserva no detienen la vuelta si fallan', () => {
    expect(nodo('Lectura directa').onError).toBe('continueRegularOutput')
    expect(nodo('Lectura directa').parameters.options.response.response.neverError).toBe(true)
    expect(nodo('Liberar reserva').onError).toBe('continueRegularOutput')
  })

  it('la lectura directa se identifica con su propio User-Agent: no se hace pasar por un navegador ni intenta saltarse protecciones', () => {
    const ua = nodo('Lectura directa').parameters.headerParameters.parameters.find((h: { name: string }) => h.name === 'User-Agent').value as string
    expect(ua).toContain('GrizzlyTradersBot')
    expect(ua).toContain('grizzlytraders.com')
    expect(ua).not.toMatch(/Mozilla|Chrome|Safari|Windows/i)
  })

  it('«Liberar reserva» solo puede borrar una RESERVA a medias (borrador rss con slug pendiente-), nunca un artículo', () => {
    const url = nodo('Liberar reserva').parameters.url as string
    expect(nodo('Liberar reserva').parameters.method).toBe('DELETE')
    for (const filtro of ['id=eq.', 'status=eq.draft', 'origen=eq.rss', 'slug=like.pendiente-']) expect(url).toContain(filtro)
  })
})

describe('Control de cupo y Contar publicado', () => {
  const control = (id: string, est: Estatico) => new Function('$input', '$execution', '$getWorkflowStaticData', codigo('Control de cupo'))({ all: () => [{ json: { n: 1 } }] }, { id }, () => est) as unknown[]
  const contar = (id: string, est: Estatico) => new Function('$input', '$execution', '$getWorkflowStaticData', codigo('Contar publicado'))({ all: () => [{ json: {} }] }, { id }, () => est) as unknown[]

  it('una vuelta nueva reinicia el contador y deja pasar la noticia', () => {
    const est: Estatico = { ejec: 'vieja', publicados: 3, sinSaldo: true, inicio: 1 }
    expect(control('1001', est)).toHaveLength(1)
    expect(est).toMatchObject({ ejec: '1001', publicados: 0, sinSaldo: false })
  })

  it('con 3 publicadas en esta vuelta no se lanza ninguna más', () => {
    const est: Estatico = {}
    control('1001', est)
    for (let i = 0; i < 3; i++) contar('1001', est)
    expect(est.publicados).toBe(3)
    expect(control('1001', est)).toEqual([])
  })

  it('con 2 publicadas y otras candidatas, sigue probando hasta completar las 3', () => {
    const est: Estatico = {}
    control('1001', est)
    contar('1001', est)
    contar('1001', est)
    expect(control('1001', est)).toHaveLength(1)
    contar('1001', est)
    expect(control('1001', est)).toEqual([])
  })

  it('pasados 9 minutos no se lanza ninguna más, aunque falte cupo (el flujo se corta a los 14)', () => {
    const est: Estatico = {}
    control('1001', est)
    est.inicio = Date.now() - 9 * 60 * 1000 - 1000
    expect(control('1001', est)).toEqual([])
  })

  it('una publicación de otra vuelta no cuenta para esta', () => {
    const est: Estatico = { ejec: '1001', publicados: 1 }
    contar('2002', est)
    expect(est.publicados).toBe(1)
  })
})

describe('Decidir lectura (ahorro de créditos)', () => {
  const decidir = (snippet: string) =>
    (new Function('$json', '$', codigo('Decidir lectura'))({ reserva: 1 }, () => ({ item: { json: { contentSnippet: snippet } } })) as { json: { modo: string; reserva: number } }).json

  it('por defecto se lee la página (primero la lectura gratuita) y conserva los datos que traía', () => {
    expect(decidir('x'.repeat(300))).toEqual({ reserva: 1, modo: 'leer' })
  })
  it('si el resumen del feed ya trae 2500+ caracteres no se lee la página: ni Firecrawl ni nada', () => {
    expect(decidir('x'.repeat(2500)).modo).toBe('rss')
    expect(decidir('x'.repeat(2499)).modo).toBe('leer')
  })
})

describe('Evaluar Firecrawl', () => {
  const evaluar = (json: unknown, est: Estatico, directo = '') =>
    (new Function('$json', '$', '$getWorkflowStaticData', codigo('Evaluar Firecrawl'))(json, () => ({ item: { json: { data: { markdown: directo } } } }), () => est) as { json: { fcOk: boolean; fcError: string; data: { markdown: string } } }).json

  it('un 402 («Payment required») marca la cuenta sin saldo para el resto de la vuelta', () => {
    const est: Estatico = {}
    const r = evaluar({ error: 'Payment required - perhaps check your payment details?' }, est)
    expect(r.fcOk).toBe(false)
    expect(est.sinSaldo).toBe(true)
  })
  it('un 403 o un timeout NO marcan la cuenta sin saldo (son de esa página)', () => {
    const est: Estatico = {}
    expect(evaluar({ error: 'Request failed with status code 403' }, est).fcOk).toBe(false)
    expect(est.sinSaldo).toBeUndefined()
  })
  it('una lectura buena de Firecrawl se usa tal cual', () => {
    const r = evaluar({ data: { markdown: 'a'.repeat(400) } }, {}, 'texto corto de la lectura directa')
    expect(r.fcOk).toBe(true)
    expect(r.data.markdown).toBe('a'.repeat(400))
  })
  it('si Firecrawl falla o trae poco, se conserva lo que dio la lectura directa (aunque sea corto)', () => {
    expect(evaluar({ error: 'Payment required' }, {}, 'texto de la lectura directa').data.markdown).toBe('texto de la lectura directa')
    expect(evaluar({ data: { markdown: 'a'.repeat(50) } }, {}, 'texto de la lectura directa').data.markdown).toBe('texto de la lectura directa')
  })
})

describe('Texto de lectura directa', () => {
  const leer = (r: unknown) => (new Function('$json', codigo('Texto de lectura directa'))(r) as { json: { data: { markdown: string }; lecturaDirecta: string } }).json
  const parrafo = 'Shares of the company rose after it reported quarterly revenue above analyst expectations, driven by cloud demand.'
  const html = `<html><head><script>var x = 1;</script><style>p{}</style></head><body>
    <header><a href="/">Inicio</a> menu menu menu</header><nav>Markets Economy</nav>
    <article><h1>Company beats estimates</h1><p>${parrafo}</p><p>Analysts &amp; investors reacted &quot;positively&quot;.</p><aside>Related links</aside></article>
    <footer>Copyright</footer><!-- comentario -->${'<div>relleno</div>'.repeat(40)}</body></html>`

  it('saca el texto del <article> sin menús, scripts ni comentarios, y decodifica entidades', () => {
    const r = leer({ statusCode: 200, body: html })
    expect(r.lecturaDirecta).toBe('ok')
    expect(r.data.markdown).toContain(parrafo)
    expect(r.data.markdown).toContain('Analysts & investors reacted "positively".')
    for (const ruido of ['var x', 'menu', 'Markets Economy', 'Copyright', 'comentario', 'Related links', '<']) expect(r.data.markdown).not.toContain(ruido)
  })
  it('descarta las lineas cortas (menus, etiquetas) y decodifica entidades numericas como &#x27;', () => {
    const largo = 'Clear Secure&#x27;s efforts to move beyond the airport are being noticed by investors across the sector.'
    const r = leer({ statusCode: 200, body: `<html><body>${'<div>x</div>'.repeat(60)}<article><p>Skip Navigation</p><p>Markets</p><p>${largo}</p></article></body></html>` })
    expect(r.data.markdown).toBe("Clear Secure's efforts to move beyond the airport are being noticed by investors across the sector.")
  })
  it('lee la página del campo `data`, que es donde la entrega el nodo HTTP de n8n (con `body` por compatibilidad)', () => {
    expect(leer({ statusCode: 200, data: html, headers: {}, statusMessage: 'OK' }).data.markdown).toContain(parrafo)
    expect(leer({ statusCode: 200, body: html }).data.markdown).toContain(parrafo)
  })
  it('si la página bloquea (403) o viene casi vacía, devuelve vacío en vez de basura', () => {
    expect(leer({ statusCode: 403, body: '' }).data.markdown).toBe('')
    expect(leer({ statusCode: 200, body: '<p>hola</p>' }).data.markdown).toBe('')
    expect(leer({ statusCode: 200, body: '<p>hola</p>' }).lecturaDirecta).toBe('HTTP 200')
  })
})

describe('fallos de infraestructura no gastan intentos', () => {
  const extraer = (est: Estatico) =>
    new Function('$input', '$', '$getWorkflowStaticData', codigo('Extraer contenido completo'))(
      { first: () => ({ json: { data: { markdown: '' } } }) },
      () => ({ item: { json: { title: 'T', link: 'https://www.cnbc.com/x', fuente: 'CNBC', contentSnippet: 'corto' } } }),
      () => est
    )

  it('sin contenido suficiente y con Firecrawl sin saldo, el error lleva [infra]', () => {
    expect(() => extraer({ sinSaldo: true })).toThrow(/^\[infra\] Contenido fuente insuficiente/)
  })
  it('sin contenido suficiente pero con la cuenta bien, es un fallo normal de la nota (se marca)', () => {
    expect(() => extraer({})).toThrow(/^Contenido fuente insuficiente/)
  })

  it('«Registrar fallo» distingue el fallo de infraestructura', () => {
    const correr = (msg: string) =>
      (new Function('$json', '$', codigo('Registrar fallo'))({ error: msg }, (n: string) => (n === 'Reservar URL' ? { item: { json: { body: [{ id: 'abc' }] } } } : { item: { json: { link: 'https://e.com/a', title: 'T', fuente: 'CNBC' } } })) as { json: { infra: boolean; post_id: string } }).json
    expect(correr('[infra] Contenido fuente insuficiente (10 caracteres)').infra).toBe(true)
    expect(correr('Contenido fuente insuficiente (10 caracteres)').infra).toBe(false)
    expect(correr('[infra] x').post_id).toBe('abc')
  })
})
