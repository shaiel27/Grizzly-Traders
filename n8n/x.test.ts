import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Publicación en X (@grizzlytraders): al final de cada tanda, UN artículo, sin enlaces, con la frase final fija. Ver docs/publicar-en-x.md.

interface Nodo {
  name: string
  type: string
  onError?: string
  credentials?: Record<string, { id: string }>
  parameters: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}
const flujo = JSON.parse(readFileSync('n8n/pipeline-noticias.json', 'utf8')) as { nodes: Nodo[]; connections: Record<string, { main: ({ node: string }[] | null)[] }> }
const nodo = (n: string) => flujo.nodes.find((x) => x.name === n)!
const codigo = (n: string) => nodo(n).parameters.jsCode as string
const destinos = (origen: string) => flujo.connections[origen].main.map((s) => (s ?? []).map((c) => c.node))
type Estatico = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const FRASE_FINAL = 'Para más noticias, visita el enlace de la bio.'
const peso = (t: string) => [...t].reduce((n, ch) => n + (ch.codePointAt(0)! > 0x2e7f ? 2 : 1), 0)

describe('cableado de la publicación en X', () => {
  it('fin de tanda -> elegir -> armar texto -> (publicar | prueba); publicar -> resultado -> guardar id -> log', () => {
    expect(destinos('Elegir artículo para X')).toEqual([['Armar texto X']])
    expect(destinos('Armar texto X')).toEqual([['¿Publicar en X?']])
    expect(destinos('¿Publicar en X?')).toEqual([['X - Publicar'], ['X - Registrar prueba']])
    expect(destinos('X - Publicar')).toEqual([['X - Resultado']])
    expect(destinos('X - Resultado')).toEqual([['¿X publicó?']])
    expect(destinos('¿X publicó?')).toEqual([['X - Guardar id'], ['X - Log']])
    expect(destinos('X - Guardar id')).toEqual([['X - Log']])
  })

  it('nada de la rama de X puede detener el pipeline: todo lo que llama a la red continúa si falla', () => {
    for (const n of ['X - Publicar', 'X - Registrar prueba', 'X - Guardar id', 'X - Log']) expect(nodo(n).onError).toBe('continueRegularOutput')
  })

  it('«X - Publicar» no reintenta (podría publicar dos veces), responde sin lanzar y usa la credencial OAuth2 de X', () => {
    const p = nodo('X - Publicar').parameters
    expect(p.url).toBe('https://api.x.com/2/tweets')
    expect(p.options.response.response).toMatchObject({ fullResponse: true, neverError: true })
    expect(nodo('X - Publicar')).not.toHaveProperty('retryOnFail')
    expect(nodo('X - Publicar').credentials!.oAuth2Api.id).toBe('XcredGrizzly0001')
    expect(p.jsonBody).toBe('={{ JSON.stringify({ text: $json.texto }) }}')
  })

  it('en modo de prueba no se llama a X: el texto queda en pipeline_logs con la fuente «X (prueba)»', () => {
    expect(nodo('X - Registrar prueba').parameters.url).toContain('/pipeline_logs')
    expect(nodo('X - Registrar prueba').parameters.jsonBody).toContain('X (prueba)')
  })
})

describe('Elegir artículo para X', () => {
  const elegir = (id: string, est: Estatico) => new Function('$execution', '$getWorkflowStaticData', codigo('Elegir artículo para X'))({ id }, () => est) as { json: { postId: string } }[]
  const art = (postId: string, relevancia: number, prioridad = 0) => ({ postId, relevancia, prioridad })

  it('elige el de mayor relevancia y deja la lista vacía', () => {
    const est: Estatico = { ejec: '7', articulosX: [art('a', 5), art('b', 9), art('c', 7)] }
    expect(elegir('7', est).map((x) => x.json.postId)).toEqual(['b'])
    expect(est.articulosX).toEqual([])
  })
  it('a igualdad de relevancia gana la fuente de más prioridad (oficiales primero)', () => {
    const est: Estatico = { ejec: '7', articulosX: [art('a', 8, 0), art('b', 8, 2), art('c', 8, 1)] }
    expect(elegir('7', est)[0].json.postId).toBe('b')
  })
  it('sin candidatos, o de otra vuelta, no publica nada', () => {
    expect(elegir('7', { ejec: '7', articulosX: [] })).toEqual([])
    expect(elegir('7', { ejec: '6', articulosX: [art('a', 9)] })).toEqual([])
  })
  it('máximo una por tanda y al menos 30 minutos entre publicaciones', () => {
    const est: Estatico = { ejec: '7', articulosX: [art('a', 9)], ultimoX: Date.now() - 10 * 60 * 1000 }
    expect(elegir('7', est)).toEqual([])
    est.articulosX = [art('b', 9)]
    est.ultimoX = Date.now() - 31 * 60 * 1000
    expect(elegir('7', est)).toHaveLength(1)
    expect(Date.now() - est.ultimoX).toBeLessThan(5000)
  })
})

describe('Armar texto X', () => {
  const armar = (articulo: Record<string, unknown>, env: Record<string, string> = {}) =>
    (new Function('$json', '$env', codigo('Armar texto X'))({ postId: 'p1', ...articulo }, env) as { json: { texto: string; largo: number; publicar: boolean; postId: string } }).json
  const base = { titulo: 'La Fed mantiene las tasas sin cambios', resumen: 'La Reserva Federal dejó las tasas estables y evaluará nuevos datos de inflación antes de su próxima reunión.', categoria: 4, activos: ['SPX'] }

  it('estructura profesional: emoji y titular, contexto, etiquetas y la frase final, separados por líneas en blanco', () => {
    const r = armar(base)
    expect(r.texto).toBe(`📈 La Fed mantiene las tasas sin cambios\n\nLa Reserva Federal dejó las tasas estables y evaluará nuevos datos de inflación antes de su próxima reunión.\n\n#SP500 #Mercados\n\n${FRASE_FINAL}`)
    expect(r.postId).toBe('p1')
  })

  it('termina SIEMPRE con la frase final fija', () => {
    for (const categoria of [1, 2, 3, 4, 99]) expect(armar({ ...base, categoria }).texto.endsWith(FRASE_FINAL)).toBe(true)
  })

  it('emoji y etiqueta de categoría; las etiquetas de activo van primero y no pasan de 2', () => {
    expect(armar({ ...base, categoria: 1, activos: ['BTC', 'ETH', 'SOL'] }).texto).toContain('₿ ')
    expect(armar({ ...base, categoria: 1, activos: ['BTC', 'ETH', 'SOL'] }).texto).toContain('#Bitcoin #Ethereum\n')
    expect(armar({ ...base, categoria: 3, activos: ['WTI', 'BRENT'] }).texto).toContain('#Petróleo #MateriasPrimas')
    expect(armar({ ...base, categoria: 2, activos: [] }).texto).toContain('#Forex')
    expect(armar({ ...base, categoria: 2, activos: [] }).texto).toContain('💱 ')
    for (const a of [['BTC', 'ETH', 'SOL'], ['XAUUSD'], []]) expect((armar({ ...base, activos: a }).texto.match(/#\S+/g) ?? []).length).toBeLessThanOrEqual(2)
  })

  it('NUNCA lleva enlaces: ni URL ni dominios sueltos (X los cobra como enlace) ni menciones', () => {
    const r = armar({
      ...base,
      titulo: 'Nasdaq.com y Yahoo.com informan en https://example.com/nota que @elonmusk compró',
      resumen: 'Detalles en www.sitio.org/x y en investing.com, vía @alguien con #etiqueta suelta.',
    })
    expect(r.texto).not.toMatch(/https?:|www\.|@|\.(com|org|net|io)\b/i)
    expect(r.texto.replace(FRASE_FINAL, '')).not.toMatch(/\.[a-z]{2,}\b/i)
    expect(r.texto.slice(0, r.texto.indexOf('\n\n')).includes('#')).toBe(false)
  })

  it('cabe en el presupuesto de X (275 de 280, emojis como 2) aunque el titular y el contexto sean larguísimos', () => {
    const largo = 'La Reserva Federal de los Estados Unidos anunció una decisión histórica sobre la política monetaria '.repeat(8)
    const r = armar({ ...base, titulo: largo, resumen: largo, activos: ['BTC', 'ETH'] })
    expect(r.largo).toBeLessThanOrEqual(275)
    expect(peso(r.texto)).toBe(r.largo)
    expect(r.texto).toContain('…')
    expect(r.texto.endsWith(FRASE_FINAL)).toBe(true)
  })

  it('si el contexto repite el titular o es casi vacío, no lo pone', () => {
    expect(armar({ ...base, resumen: base.titulo }).texto).not.toMatch(/sin cambios\n\nLa Fed mantiene/)
    expect(armar({ ...base, resumen: '' }).texto.split('\n\n')).toHaveLength(3)
    expect(armar({ ...base, resumen: 'corto' }).texto.split('\n\n')).toHaveLength(3)
  })

  it('publica de verdad solo con X_PUBLICAR_ACTIVO=true; si no, es modo de prueba', () => {
    expect(armar(base, {}).publicar).toBe(false)
    expect(armar(base, { X_PUBLICAR_ACTIVO: 'false' }).publicar).toBe(false)
    expect(armar(base, { X_PUBLICAR_ACTIVO: 'true' }).publicar).toBe(true)
  })
})

describe('X - Resultado', () => {
  const resultado = (r: unknown) =>
    (new Function('$json', '$', codigo('X - Resultado'))(r, () => ({ item: { json: { texto: 'texto', postId: 'p1' } } })) as { json: { ok: boolean; xId: string | null; error: string; postId: string } }).json

  it('201 con id = publicada', () => {
    expect(resultado({ statusCode: 201, body: { data: { id: '12345', text: 't' } } })).toEqual({ ok: true, xId: '12345', error: '', texto: 'texto', postId: 'p1' })
  })
  it('lee el cuerpo aunque llegue como texto o en el campo data', () => {
    expect(resultado({ statusCode: 201, data: '{"data":{"id":"99"}}' }).xId).toBe('99')
  })
  it('402 explica que falta saldo; 401/403 la credencial; 429 el límite; sin respuesta, también', () => {
    expect(resultado({ statusCode: 402, body: { title: 'CreditsDepleted' } }).error).toContain('sin saldo')
    expect(resultado({ statusCode: 403, body: { detail: 'Forbidden' } }).error).toContain('credencial')
    expect(resultado({ statusCode: 401, body: {} }).error).toContain('credencial')
    expect(resultado({ statusCode: 429, body: {} }).error).toContain('frecuencia')
    const r = resultado({ error: 'timeout' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('sin respuesta')
  })
  it('un 201 sin id no se da por publicada', () => {
    expect(resultado({ statusCode: 201, body: {} }).ok).toBe(false)
  })
})

describe('relevancia en el análisis de GPT', () => {
  it('el prompt pide «relevancia» de 1 a 10 y Parsear JSON la acota (por defecto 5)', () => {
    expect(nodo('OpenAI - Analisis GPT').parameters.responses.values[0].content).toContain('relevancia (entero de 1 a 10')
    const f = new Function('$json', '$', codigo('Parsear JSON'))
    const correr = (relevancia: unknown) =>
      (f(
        { output: [{ content: [{ text: JSON.stringify({ title: 'Titular de prueba valido', slug: 'titular-de-prueba', content_html: '<p>' + 'texto '.repeat(60) + '</p>', sentiment: 'neutral', category: 'acciones', relevancia }) }] }] },
        () => ({ item: { json: { link: 'https://e.com/a', title: 'T', fuente: 'EDGAR' } } })
      ) as { json: { relevancia: number } }[])[0].json.relevancia
    expect(correr(9)).toBe(9)
    expect(correr(99)).toBe(10)
    expect(correr(0)).toBe(5)
    expect(correr('x')).toBe(5)
    expect(correr(undefined)).toBe(5)
  })
})

describe('migración 0017', () => {
  const sql = readFileSync('supabase/migrations/0017_posts_x.sql', 'utf8')
  it('añade x_post_id y x_publicado_at, es idempotente y evita dos artículos con el mismo post de X', () => {
    expect(sql).toContain('add column if not exists x_post_id text')
    expect(sql).toContain('add column if not exists x_publicado_at timestamptz')
    expect(sql).toContain('create unique index if not exists posts_x_post_id_uidx')
  })
})
