import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Prueba el nodo "Armar mensaje comunidades" del flujo de noticias tal como está versionado en n8n/pipeline-noticias.json:
// se extrae su código y se ejecuta con los datos que n8n le daría ($vars, $('Parsear JSON'), $('Reservar URL')).

interface Node {
  name: string
  disabled?: boolean
  parameters: { jsCode?: string }
}
const flujo = JSON.parse(readFileSync('n8n/pipeline-noticias.json', 'utf8')) as { nodes: Node[]; connections: Record<string, { main: { node: string }[][] }> }
const nodo = (name: string) => flujo.nodes.find((n) => n.name === name)!

const CODIGO = nodo('Armar mensaje comunidades').parameters.jsCode!

function ejecutar(post: Record<string, unknown>, vars: Record<string, string> = {}, entorno: Record<string, string> = {}) {
  const fn = new Function('$vars', '$', '$env', CODIGO)
  const salidas: Record<string, unknown> = {
    'Parsear JSON': { item: { json: post } },
    'Reservar URL': { item: { json: { body: [{ id: '908db814-6cfb-4f50-8528-742626c5f8f3' }] } } },
  }
  // En modo "una vez por elemento" n8n exige devolver UN objeto { json }, no una lista
  const salida = fn(vars, (name: string) => salidas[name], entorno)
  if (Array.isArray(salida)) throw new Error('El nodo debe devolver { json }, no una lista')
  return salida.json as {
    url: string
    portada: string
    portadaJpeg: string
    caption: string
    telegram: { photo: string; caption: string; parse_mode: string; reply_markup: { inline_keyboard: { text: string; url: string }[][] } }
    telegramTexto: { text: string; link_preview_options: { url: string } }
    discord: { username: string; embeds: { title: string; url: string; description: string; color: number; image: { url: string }; footer: { text: string } }[] }
  }
}

const post = {
  slug: 'estancamiento-economico-canada',
  title: 'El crecimiento de Canadá se estanca en agosto',
  content_html: '<p>La economía canadiense no creció en agosto y septiembre apunta a una cifra similar, según los datos preliminares.</p>',
  category_id: 2,
  sentiment: 'bearish',
  fuente: 'Investing.com',
}

describe('mensaje para las comunidades', () => {
  it('enlaza a NUESTRO artículo en el dominio configurado, no a la fuente original', () => {
    const m = ejecutar(post, { SITE_URL: 'https://grizzlytraders.com/' })
    expect(m.url).toBe('https://grizzlytraders.com/articulos/estancamiento-economico-canada')
    expect(m.telegram.reply_markup.inline_keyboard[0][0]).toEqual({ text: 'Leer artículo', url: m.url })
    expect(m.discord.embeds[0].url).toBe(m.url)
    expect(JSON.stringify(m)).not.toContain('investing.com')
  })

  it('toma SITE_URL de la variable de entorno del VPS, y si el acceso a $env está bloqueado usa $vars o el dominio', () => {
    expect(ejecutar(post, {}, { SITE_URL: 'https://otro.example/' }).url).toBe('https://otro.example/articulos/estancamiento-economico-canada')
    const bloqueado = new Proxy({}, { get() { throw new Error('access to env vars denied') } })
    const fn = new Function('$vars', '$', '$env', CODIGO)
    const salidas: Record<string, unknown> = { 'Parsear JSON': { item: { json: post } }, 'Reservar URL': { item: { json: { body: [{ id: '908db814-6cfb-4f50-8528-742626c5f8f3' }] } } } }
    expect(fn({ SITE_URL: 'https://vars.example' }, (n: string) => salidas[n], bloqueado).json.url).toBe('https://vars.example/articulos/estancamiento-economico-canada')
    expect(fn({}, (n: string) => salidas[n], bloqueado).json.url).toBe('https://grizzlytraders.com/articulos/estancamiento-economico-canada')
  })

  it('usa grizzlytraders.com si no hay SITE_URL', () => {
    expect(ejecutar(post).url).toBe('https://grizzlytraders.com/articulos/estancamiento-economico-canada')
  })

  it('lleva la misma portada: WebP del bucket para Discord y su versión JPEG para Telegram', () => {
    const m = ejecutar(post)
    expect(m.portada).toBe('https://pudzvatuubywmwdmboiq.supabase.co/storage/v1/object/public/post-images/estancamiento-economico-canada-908db814.webp')
    expect(m.discord.embeds[0].image.url).toBe(m.portada)
    expect(m.telegram.photo).toBe(`https://grizzlytraders.com/api/cover/jpeg?u=${encodeURIComponent(m.portada)}`)
  })

  it('muestra titular, extracto, categoría, sentimiento y fuente', () => {
    const m = ejecutar(post)
    expect(m.caption).toContain('<b>El crecimiento de Canadá se estanca en agosto</b>')
    expect(m.caption).toContain('La economía canadiense no creció')
    expect(m.caption).toContain('Forex · Bajista · Fuente: Investing.com')
    expect(m.discord.embeds[0].color).toBe(0xef4444)
    expect(m.discord.username).toBe('Grizzly Traders')
  })

  it('escapa el HTML de Telegram: un titular con < > & no lo rompe', () => {
    const m = ejecutar({ ...post, title: 'Fed <sube> tasas & el mercado "reacciona"' })
    expect(m.caption).toContain('<b>Fed &lt;sube&gt; tasas &amp; el mercado "reacciona"</b>')
    expect(m.caption.replace(/<\/?b>/g, '')).not.toMatch(/<[a-z]/i)
  })

  it('respeta los límites: pie de foto de Telegram ≤ 1024 y título de Discord ≤ 256', () => {
    const largo = ejecutar({ ...post, title: 'T'.repeat(300), content_html: `<p>${'palabra '.repeat(400)}</p>` })
    expect(largo.caption.length).toBeLessThanOrEqual(1024)
    expect(largo.discord.embeds[0].title.length).toBeLessThanOrEqual(256)
    expect(largo.discord.embeds[0].description.length).toBeLessThanOrEqual(4096)
    expect(largo.discord.embeds[0].description.endsWith('…')).toBe(true)
  })

  it('sin categoría ni sentimiento conocidos usa valores neutros y sin fuente genérica "RSS"', () => {
    const m = ejecutar({ ...post, category_id: 99, sentiment: 'raro', fuente: 'RSS' })
    expect(m.caption).toContain('Mercados · Neutral')
    expect(m.caption).not.toContain('Fuente: RSS')
  })

  it('el respaldo en texto enlaza el artículo con vista previa grande', () => {
    const m = ejecutar(post)
    expect(m.telegramTexto.text.endsWith(m.url)).toBe(true)
    expect(m.telegramTexto.link_preview_options.url).toBe(m.url)
  })
})

describe('flujo de noticias: cableado de las comunidades', () => {
  it('Telegram y Discord siguen APAGADOS hasta el despliegue', () => {
    for (const name of ['Telegram - Difundir', 'Telegram - Respaldo texto', 'Discord - Difundir']) expect(nodo(name).disabled).toBe(true)
  })

  it('se avisa a las comunidades después de revalidar el sitio, no antes', () => {
    expect(flujo.connections['Revalidar sitio'].main[0].map((c) => c.node)).toEqual(['Armar mensaje comunidades'])
    expect(flujo.connections['Armar mensaje comunidades'].main[0].map((c) => c.node)).toEqual(['Telegram - Difundir'])
    expect(flujo.connections['Log ejecucion'].main[0].map((c) => c.node)).toEqual(['Loop Over Items'])
  })

  it('si falla la foto, Telegram cae al mensaje de texto y Discord se envía igual', () => {
    const telegram = flujo.connections['Telegram - Difundir'].main
    expect(telegram[0].map((c) => c.node)).toEqual(['Discord - Difundir'])
    expect(telegram[1].map((c) => c.node)).toEqual(['Telegram - Respaldo texto'])
    expect(flujo.connections['Telegram - Respaldo texto'].main[0].map((c) => c.node)).toEqual(['Discord - Difundir'])
  })

  it('las llaves salen de variables de n8n, nunca escritas en el flujo', () => {
    const texto = readFileSync('n8n/pipeline-noticias.json', 'utf8')
    expect(texto).toContain('$env.TELEGRAM_BOT_TOKEN')
    expect(texto).toContain('$env.DISCORD_WEBHOOK_URL')
    expect(texto).not.toMatch(/discord\.com\/api\/webhooks\/\d/)
    expect(texto).not.toMatch(/bot\d{6,}:/)
  })
})
