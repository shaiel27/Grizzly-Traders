import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Flujo "CMS Completar articulo" (n8n/cms-completar.json): dado el id de un artículo, genera SOLO lo que le falta (portada,
// categoría, traducción) sin tocar el texto del editor. Se prueba el cableado y el código de sus nodos tal como está versionado.

interface Nodo {
  name: string
  type: string
  onError?: string
  credentials?: Record<string, { id: string }>
  parameters: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}
const texto = readFileSync('n8n/cms-completar.json', 'utf8')
const flujo = JSON.parse(texto) as { nodes: Nodo[]; connections: Record<string, { main: { node: string }[][] }>; id: string }
const nodo = (name: string) => flujo.nodes.find((n) => n.name === name)!
const destinos = (origen: string, salida = 0) => (flujo.connections[origen]?.main[salida] ?? []).map((c) => c.node)

type Ctx = Record<string, unknown>
// Ejecuta el código de un nodo con $json y $('Otro nodo').first().json simulados
function correr(nombre: string, json: unknown, otros: Record<string, unknown> = {}) {
  const dolar = (n: string) => {
    if (!(n in otros)) throw new Error(`Node '${n}' hasn't been executed`)
    return { first: () => ({ json: otros[n] }) }
  }
  const fn = new Function('$json', '$', '$input', '$now', '$env', '$vars', nodo(nombre).parameters.jsCode)
  const salida = fn(json, dolar, { first: () => ({ json }) }, { toFormat: () => '20260101000000' }, {}, {})
  return (Array.isArray(salida) ? salida[0] : salida).json as Ctx
}

const ID = 'be1f67f1-5e1a-4fa4-ad12-ad727059cca2'
const postEscritoAMano = {
  id: ID,
  status: 'published',
  cover_image_url: null,
  category_id: null,
  original_locale: 'es',
  posts_translations: [{ locale: 'es', title: 'Ueno Bank', slug: 'ueno-bank-el-riesgo', content_html: '<p>Hola <b>mundo</b></p>', meta_title: null, meta_description: null }],
}

describe('flujo CMS Completar articulo: cableado', () => {
  it('tiene un webhook propio, distinto al del flujo asistido', () => {
    expect(nodo('Webhook Completar').parameters.path).toBe('cms-completar')
    expect(flujo.id).toBe('cmsCompletar0001')
    const editorial = JSON.parse(readFileSync('n8n/cms-editorial.json', 'utf8')) as { nodes: Nodo[] }
    expect(editorial.nodes.find((n) => n.type.endsWith('webhook'))!.parameters.path).toBe('cms-editorial')
  })

  it('una entrada inválida se rechaza con 400 antes de leer nada', () => {
    expect(destinos('Entrada valida', 1)).toEqual(['Responder 400'])
    expect(nodo('Responder 400').parameters.options.responseCode).toBe(400)
  })

  it('cada etapa se puede saltar: portada, categoría y traducción son opcionales e independientes', () => {
    expect(destinos('Falta portada o categoria', 1)).toEqual(['Falta portada'])
    expect(destinos('Falta portada', 1)).toEqual(['Falta categoria'])
    expect(destinos('Falta categoria', 1)).toEqual(['Falta traduccion'])
    expect(destinos('Falta traduccion', 1)).toEqual(['Armar resultado'])
  })

  it('un fallo de portada o de traducción no tumba el resto: se anota y se sigue', () => {
    for (const n of ['Optimizar imagen', 'Subir a Storage', 'Guardar portada']) expect(destinos(n, 1)).toEqual(['Marcar fallo portada'])
    expect(destinos('Marcar fallo portada')).toEqual(['Falta categoria'])
    for (const n of ['GPT · Traducir', 'Parsear traduccion', 'Resolver slug traducido', 'Insertar traduccion']) expect(destinos(n, 1)).toEqual(['Marcar fallo traduccion'])
    expect(destinos('Marcar fallo traduccion')).toEqual(['Armar resultado'])
  })

  it('si Higgsfield falla, la portada sale con el respaldo de OpenAI en calidad baja', () => {
    expect(destinos('Higgsfield - Enviar', 1)).toEqual(['OpenAI - Imagen respaldo'])
    expect(destinos('Higgsfield - Resultado', 2)).toEqual(['OpenAI - Imagen respaldo'])
    expect(nodo('OpenAI - Imagen respaldo').parameters.options.quality).toBe('low')
  })

  it('no pisa lo que el editor ponga mientras tanto: portada y categoría solo si siguen vacías, traducción sin sobrescribir', () => {
    expect(nodo('Guardar portada').parameters.url).toContain('cover_image_url=is.null')
    expect(nodo('Guardar categoria').parameters.url).toContain('category_id=is.null')
    expect(nodo('Insertar traduccion').parameters.headerParameters.parameters.find((h: { name: string }) => h.name === 'Prefer').value).toContain('ignore-duplicates')
  })

  it('la imagen se sube con caché largo y un nombre que no choca con otros artículos', () => {
    const cache = nodo('Subir a Storage').parameters.headerParameters.parameters.find((h: { name: string }) => h.name === 'cache-control')
    expect(cache.value).toBe('max-age=31536000')
    expect(correr('Decidir', { body: [postEscritoAMano] }, { 'Validar entrada': { solicitado_por: '' } }).archivo_portada).toBe('ueno-bank-el-riesgo-be1f67f1.webp')
  })

  it('las llaves salen de credenciales de n8n, nunca escritas en el flujo', () => {
    expect(texto).not.toMatch(/sk-[A-Za-z0-9]{20}/)
    expect(texto).not.toMatch(/Authorization.*Key [0-9a-f]{8}/)
    expect(nodo('Higgsfield - Enviar').credentials!.httpHeaderAuth.id).toBe('higgsfieldCred0001')
  })
})

describe('flujo CMS Completar articulo: lógica de los nodos', () => {
  const previo = { 'Validar entrada': { solicitado_por: 'moises@x.com' } }

  it('Validar entrada: solo acepta un UUID', () => {
    expect(correr('Validar entrada', { body: { post_id: ID, solicitado_por: ' moises ' } }).valido).toBe(true)
    expect(correr('Validar entrada', { body: { post_id: 'no-es-uuid' } }).valido).toBe(false)
    expect(correr('Validar entrada', { body: {} }).valido).toBe(false)
  })

  it('Decidir: un artículo escrito a mano necesita las tres cosas', () => {
    const d = correr('Decidir', { body: [postEscritoAMano] }, previo)
    expect(d).toMatchObject({ falta_portada: true, falta_categoria: true, falta_traduccion: true, original_locale: 'es', opuesto: 'en' })
    expect(d.texto).toBe('Hola mundo')
  })

  it('Decidir: un artículo completo no necesita nada', () => {
    const d = correr('Decidir', { body: [{ ...postEscritoAMano, cover_image_url: 'https://x/y.webp', category_id: 4, posts_translations: [...postEscritoAMano.posts_translations, { locale: 'en', title: 'T', slug: 't', content_html: '<p>x</p>' }] }] }, previo)
    expect(d).toMatchObject({ falta_portada: false, falta_categoria: false, falta_traduccion: false })
  })

  it('Decidir: si el original está en inglés, lo que falta es el español', () => {
    const d = correr('Decidir', { body: [{ ...postEscritoAMano, original_locale: 'en', posts_translations: [{ ...postEscritoAMano.posts_translations[0], locale: 'en' }] }] }, previo)
    expect(d).toMatchObject({ original_locale: 'en', opuesto: 'es', falta_traduccion: true })
  })

  it('Decidir: un artículo inexistente o sin texto falla con un mensaje claro (sale por la salida de error)', () => {
    expect(() => correr('Decidir', { body: [] }, previo)).toThrow(/No existe el articulo/)
    expect(() => correr('Decidir', { body: [{ ...postEscritoAMano, posts_translations: [] }] }, previo)).toThrow(/ninguna version/)
  })

  it('Parsear clasificacion: lee categoría y escena; nunca falla aunque GPT no responda', () => {
    const ok = correr('Parsear clasificacion', { output: [{ content: [{ text: '{"category":"Acciones","prompt_imagen":"A stone bank facade at dusk, empty steps"}' }] }] })
    expect(ok).toMatchObject({ analisis_ok: true, category_id: 4, prompt_imagen: 'A stone bank facade at dusk, empty steps' })
    const envuelto = correr('Parsear clasificacion', { output: [{ content: [{ text: '```json\n{"category":"materias-primas","prompt_imagen":"Gold bars stacked in a vault"}\n```' }] }] })
    expect(envuelto).toMatchObject({ category_id: 3 })
    const caido = correr('Parsear clasificacion', { error: { message: 'rate limit' } })
    expect(caido).toMatchObject({ analisis_ok: false, category_id: null })
    expect(String(caido.prompt_imagen).length).toBeGreaterThan(10)
    expect(correr('Parsear clasificacion', { output: [{ content: [{ text: '{"category":"inventada","prompt_imagen":"x"}' }] }] }).category_id).toBeNull()
  })

  it('Armar resultado: informa qué se hizo y qué quedó pendiente', () => {
    const decidir = { post_id: ID, titulo: 'Ueno', slug_es: null, origen: { slug: 'ueno', title: 'Ueno' }, original_locale: 'es', falta_portada: true, falta_categoria: true, falta_traduccion: true, solicitado_por: 'm' }
    const todo = correr('Armar resultado', {}, { Decidir: decidir, 'Guardar portada': {}, 'Guardar categoria': {}, 'Parsear clasificacion': { category_id: 4 }, 'Insertar traduccion': {} })
    expect(todo).toMatchObject({ ok: true, pendientes: [], hecho: { portada: true, categoria: true, traduccion: true } })
    const sinPortada = correr('Armar resultado', {}, { Decidir: decidir, 'Marcar fallo portada': { error: 'sin saldo' }, 'Parsear clasificacion': { category_id: 4 }, 'Guardar categoria': {}, 'Insertar traduccion': {} })
    expect(sinPortada).toMatchObject({ ok: false, pendientes: ['portada'], errores: { portada: 'sin saldo' } })
    const nada = correr('Armar resultado', {}, { Decidir: { ...decidir, falta_portada: false, falta_categoria: false, falta_traduccion: false } })
    expect(nada).toMatchObject({ ok: true, pendientes: [] })
  })
})

describe('flujo CMS Completar articulo: anuncio en Discord', () => {
  const dec = { post_id: ID, titulo: 'Ueno Bank', slug_es: 'ueno-bank-es', titulo_es: 'Ueno Bank: el riesgo', origen: { slug: 'ueno-bank-es', title: 'Ueno Bank: el riesgo' }, original_locale: 'es', falta_portada: false, falta_categoria: false, falta_traduccion: false, solicitado_por: 'm' }

  it('se anuncia después de la portada y de revalidar el sitio, no antes', () => {
    expect(destinos('Revalidar sitio')).toEqual(['Reclamar anuncio'])
    expect(destinos('Reclamar anuncio')).toEqual(['Hay que anunciar'])
    expect(destinos('Hay que anunciar', 0)).toEqual(['Armar mensaje Discord'])
    expect(destinos('Hay que anunciar', 1)).toEqual(['Log ejecucion'])
    expect(destinos('Discord - Difundir')).toEqual(['Log ejecucion'])
  })

  it('el candado: solo anuncia si el UPDATE condicionado cambió una fila (una vez por artículo, solo del CMS y publicado)', () => {
    const url = String(nodo('Reclamar anuncio').parameters.url)
    expect(url).toContain('anunciado_discord_at=is.null')
    expect(url).toContain('origen=eq.cms')
    expect(url).toContain('status=eq.published')
    expect(nodo('Reclamar anuncio').parameters.headerParameters.parameters.find((h: { name: string }) => h.name === 'Prefer').value).toBe('return=representation')
    expect(String(nodo('Hay que anunciar').parameters.conditions.conditions[0].leftValue)).toContain('body.length > 0')
  })

  it('el mensaje es solo el titular y el enlace a nuestro artículo, sin menciones y con el Markdown escapado', () => {
    const armar = (titulo: string, extra: Ctx = {}) =>
      correr('Armar mensaje Discord', {}, { 'Armar resultado': { slug_publico: 'ueno-bank-es', titulo_publico: titulo, ...extra } }) as { discord: { content: string; allowed_mentions: unknown; username: string }; url: string }
    const m = armar('El *riesgo* @everyone')
    expect(m.url).toBe('https://grizzlytraders.com/articulos/ueno-bank-es')
    expect(m.discord.content).toBe('**El \\*riesgo\\* @everyone**\nhttps://grizzlytraders.com/articulos/ueno-bank-es')
    expect(m.discord.allowed_mentions).toEqual({ parse: [] })
    expect(m.discord.username).toBe('Grizzly Traders')
  })

  it('el webhook sale de la variable de entorno de n8n, nunca escrito en el flujo', () => {
    expect(String(nodo('Discord - Difundir').parameters.url)).toContain('$env.DISCORD_WEBHOOK_URL')
    expect(texto).not.toMatch(/discord\.com\/api\/webhooks\/\d/)
    expect(nodo('Discord - Difundir').onError).toBe('continueRegularOutput')
  })

  it('Armar resultado elige qué anunciar: la versión en español, o la recién traducida si el original es inglés', () => {
    expect(correr('Armar resultado', {}, { Decidir: dec })).toMatchObject({ slug_publico: 'ueno-bank-es', titulo_publico: 'Ueno Bank: el riesgo' })
    const enOriginal = { ...dec, original_locale: 'en', slug_es: null, titulo_es: null, falta_traduccion: true, origen: { slug: 'ueno-en', title: 'Ueno EN' } }
    const traducida = { 'Resolver slug traducido': { locale_opuesto: 'es', traducida: { slug: 'ueno-es-nueva', title: 'Ueno ES nueva' } }, 'Insertar traduccion': {} }
    expect(correr('Armar resultado', {}, { Decidir: enOriginal, ...traducida })).toMatchObject({ slug_publico: 'ueno-es-nueva', titulo_publico: 'Ueno ES nueva' })
    expect(correr('Armar resultado', {}, { Decidir: enOriginal })).toMatchObject({ slug_publico: 'ueno-en' })
  })
})
