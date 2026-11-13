import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Prueba el nodo "Armar mensaje comunidades" del flujo de noticias tal como está versionado en n8n/pipeline-noticias.json:
// se extrae su código y se ejecuta con los datos que n8n le daría ($vars, $env, $('Parsear JSON')).
// Cada artículo publicado sale en Discord como SOLO titular + enlace a nuestro artículo (el cliente no abre comunidad de Telegram).

interface Nodo {
  name: string
  disabled?: boolean
  onError?: string
  parameters: { jsCode?: string; url?: string; jsonBody?: string }
}
const texto = readFileSync('n8n/pipeline-noticias.json', 'utf8')
const flujo = JSON.parse(texto) as { nodes: Nodo[]; connections: Record<string, { main: { node: string }[][] }> }
const nodo = (name: string) => flujo.nodes.find((n) => n.name === name)!

const CODIGO = nodo('Armar mensaje comunidades').parameters.jsCode!

interface Mensaje {
  url: string
  titulo: string
  discord: { username: string; avatar_url: string; content: string; allowed_mentions: { parse: string[] } }
}

function ejecutar(post: Record<string, unknown>, vars: Record<string, string> = {}, entorno: Record<string, string> = {}) {
  const fn = new Function('$vars', '$', '$env', CODIGO)
  const salida = fn(vars, (name: string) => (name === 'Parsear JSON' ? { item: { json: post } } : undefined), entorno)
  if (Array.isArray(salida)) throw new Error('El nodo debe devolver { json }, no una lista')
  return salida.json as Mensaje
}

const post = { slug: 'estancamiento-economico-canada', title: 'El crecimiento de Canadá se estanca en agosto', fuente: 'Investing.com' }

describe('mensaje para las comunidades: titular + enlace', () => {
  it('enlaza a NUESTRO artículo en el dominio configurado, no a la fuente original', () => {
    const m = ejecutar(post, { SITE_URL: 'https://grizzlytraders.com/' })
    expect(m.url).toBe('https://grizzlytraders.com/articulos/estancamiento-economico-canada')
    expect(m.discord.content).toContain(m.url)
    expect(JSON.stringify(m)).not.toContain('investing.com')
  })

  it('Discord: titular en negrita y el enlace, con el nombre y el logo del sitio', () => {
    const m = ejecutar(post)
    expect(m.discord.content).toBe('**El crecimiento de Canadá se estanca en agosto**\nhttps://grizzlytraders.com/articulos/estancamiento-economico-canada')
    expect(m.discord.username).toBe('Grizzly Traders')
    expect(m.discord.avatar_url).toBe('https://grizzlytraders.com/logo.png')
  })

  it('Discord: un titular nunca puede mencionar a nadie ni cambiar el formato con Markdown', () => {
    const m = ejecutar({ ...post, title: '@everyone **oferta** _ya_ ~~hoy~~ `x` | > #canal' })
    expect(m.discord.allowed_mentions).toEqual({ parse: [] })
    expect(m.discord.content).toContain('\\*\\*oferta\\*\\* \\_ya\\_ \\~\\~hoy\\~\\~ \\`x\\` \\| \\> \\#canal')
  })

  it('respeta los límites: un titular larguísimo se recorta (Discord ≤ 2000 caracteres)', () => {
    const m = ejecutar({ ...post, title: 'T'.repeat(5000) })
    expect(m.titulo.length).toBe(300)
    expect(m.discord.content.length).toBeLessThanOrEqual(2000)
  })

  it('toma SITE_URL del entorno del VPS, y si el acceso a $env está bloqueado usa $vars o el dominio', () => {
    expect(ejecutar(post, {}, { SITE_URL: 'https://otro.example/' }).url).toBe('https://otro.example/articulos/estancamiento-economico-canada')
    const bloqueado = new Proxy({}, { get() { throw new Error('access to env vars denied') } })
    const fn = new Function('$vars', '$', '$env', CODIGO)
    const dolar = () => ({ item: { json: post } })
    expect(fn({ SITE_URL: 'https://vars.example' }, dolar, bloqueado).json.url).toBe('https://vars.example/articulos/estancamiento-economico-canada')
    expect(fn({}, dolar, bloqueado).json.url).toBe('https://grizzlytraders.com/articulos/estancamiento-economico-canada')
  })
})

describe('flujo de noticias: cableado de las comunidades', () => {
  it('Discord está ENCENDIDO y Telegram no existe en el flujo', () => {
    expect(nodo('Discord - Difundir').disabled).toBeFalsy()
    expect(flujo.nodes.some((n) => /telegram/i.test(n.name))).toBe(false)
    expect(texto).not.toMatch(/telegram/i)
  })

  it('se avisa a la comunidad después de revalidar el sitio, no antes', () => {
    expect(flujo.connections['Revalidar sitio'].main[0].map((c) => c.node)).toEqual(['Armar mensaje comunidades'])
    expect(flujo.connections['Armar mensaje comunidades'].main[0].map((c) => c.node)).toEqual(['Discord - Difundir'])
    // Log ejecucion -> Contar publicado (cupo de la vuelta) -> siguiente noticia
    expect(flujo.connections['Log ejecucion'].main[0].map((c) => c.node)).toEqual(['Contar publicado'])
    expect(flujo.connections['Contar publicado'].main[0].map((c) => c.node)).toEqual(['Loop Over Items'])
  })

  it('un fallo de Discord no detiene el pipeline', () => {
    expect(nodo('Discord - Difundir').onError).toBe('continueRegularOutput')
  })

  it('las llaves salen de variables de entorno de n8n, nunca escritas en el flujo', () => {
    expect(texto).toContain('$env.DISCORD_WEBHOOK_URL')
    expect(texto).not.toMatch(/discord\.com\/api\/webhooks\/\d/)
  })
})
