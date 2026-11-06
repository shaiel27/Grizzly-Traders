// Chequeo externo del sitio. Lo ejecuta GitHub Actions cada 5 minutos desde FUERA del servidor (.github/workflows/monitoreo.yml):
// una caída que el propio servidor no puede ver (como la de nov-2026, causada por la red del proveedor) se detecta igual.
//
// Comprueba, con 2 reintentos cada una para no alertar por un fallo puntual de la red del ejecutor:
//   1. La portada responde 200 y es la nuestra.
//   2. El último artículo del feed abre (200).
//   3. El feed publica: la nota más reciente no tiene más de MAX_HORAS_SIN_PUBLICAR horas (pipeline parado).
//   4. El certificado TLS no caduca en menos de MIN_DIAS_CERTIFICADO días.
// Si algo falla sale con código 1, y GitHub avisa por correo de la ejecución fallida. Opcional: ALERT_WEBHOOK (Discord o compatible).
import tls from 'node:tls'
import { pathToFileURL } from 'node:url'

export const MAX_HORAS_SIN_PUBLICAR = 4
export const MIN_DIAS_CERTIFICADO = 10

// Fecha de la nota más reciente de un feed RSS (ms), o null si no hay ninguna
export function ultimaPublicacion(xml) {
  const fechas = [...String(xml).matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map((m) => Date.parse(m[1])).filter(Number.isFinite)
  return fechas.length ? Math.max(...fechas) : null
}

// Enlace del primer artículo del feed
export function primerArticulo(xml) {
  const item = String(xml).match(/<item>[\s\S]*?<\/item>/)
  return item ? ((item[0].match(/<link>([^<]+)<\/link>/) || [])[1] || null) : null
}

export function evaluarFrescura(xml, ahora = Date.now(), maxHoras = MAX_HORAS_SIN_PUBLICAR) {
  const ultima = ultimaPublicacion(xml)
  if (ultima === null) return { ok: false, detalle: 'el feed no tiene ninguna nota con fecha' }
  const horas = (ahora - ultima) / 3_600_000
  const redondeado = Math.round(horas * 10) / 10
  return horas <= maxHoras ? { ok: true, detalle: `última nota hace ${redondeado} h` } : { ok: false, detalle: `sin notas nuevas desde hace ${redondeado} h (máximo ${maxHoras} h): el pipeline puede estar parado` }
}

export function evaluarCertificado(validoHasta, ahora = Date.now(), minDias = MIN_DIAS_CERTIFICADO) {
  const hasta = Date.parse(validoHasta)
  if (!Number.isFinite(hasta)) return { ok: false, detalle: 'no se pudo leer la fecha del certificado' }
  const dias = Math.floor((hasta - ahora) / 86_400_000)
  return dias >= minDias ? { ok: true, detalle: `caduca en ${dias} días` } : { ok: false, detalle: `el certificado caduca en ${dias} días (mínimo ${minDias})` }
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function conReintentos(nombre, fn, intentos = 3, pausaMs = 10_000) {
  let ultimo = 'sin intentos'
  for (let i = 1; i <= intentos; i++) {
    try {
      const r = await fn()
      if (r.ok) return { nombre, ...r }
      ultimo = r.detalle
    } catch (e) {
      ultimo = e instanceof Error ? e.message : String(e)
    }
    if (i < intentos) await esperar(pausaMs)
  }
  return { nombre, ok: false, detalle: ultimo }
}

async function pedir(url, ms = 15_000) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(ms), headers: { 'User-Agent': 'GrizzlyTraders-Monitor/1.0 (+https://grizzlytraders.com)' } })
  return { status: res.status, texto: await res.text() }
}

function certificado(host) {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 10_000 }, () => {
      const c = s.getPeerCertificate()
      s.end()
      resolve(c.valid_to)
    })
    s.on('timeout', () => { s.destroy(); reject(new Error('el TLS no respondió a tiempo')) })
    s.on('error', reject)
  })
}

export async function chequear(sitio, { intentos = 3, pausaMs = 10_000 } = {}) {
  const base = sitio.replace(/\/+$/, '')
  const host = new URL(base).hostname
  const resultados = []
  resultados.push(
    await conReintentos('portada', async () => {
      const r = await pedir(base + '/')
      return r.status === 200 && /Grizzly/i.test(r.texto) ? { ok: true, detalle: 'HTTP 200' } : { ok: false, detalle: `HTTP ${r.status}${r.status === 200 ? ' pero no parece nuestra portada' : ''}` }
    }, intentos, pausaMs)
  )
  let feed = ''
  resultados.push(
    await conReintentos('feed y frescura', async () => {
      const r = await pedir(base + '/feed.xml')
      if (r.status !== 200) return { ok: false, detalle: `feed HTTP ${r.status}` }
      feed = r.texto
      return evaluarFrescura(r.texto)
    }, intentos, pausaMs)
  )
  resultados.push(
    await conReintentos('artículo reciente', async () => {
      const enlace = primerArticulo(feed)
      if (!enlace) return { ok: false, detalle: 'el feed no trae ningún artículo' }
      const r = await pedir(enlace)
      return r.status === 200 ? { ok: true, detalle: 'HTTP 200' } : { ok: false, detalle: `${enlace} -> HTTP ${r.status}` }
    }, intentos, pausaMs)
  )
  resultados.push(await conReintentos('certificado TLS', async () => evaluarCertificado(await certificado(host)), intentos, pausaMs))
  return resultados
}

async function avisar(webhook, fallos, sitio) {
  if (!webhook) return
  const texto = `🚨 **${sitio}** no pasa el chequeo externo:\n` + fallos.map((f) => `• ${f.nombre}: ${f.detalle}`).join('\n')
  try {
    await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: texto, username: 'Monitoreo', allowed_mentions: { parse: [] } }), signal: AbortSignal.timeout(10_000) })
  } catch (e) {
    console.error('No se pudo enviar el aviso por webhook:', e instanceof Error ? e.message : e)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const sitio = process.env.SITE_URL || 'https://grizzlytraders.com'
  const rapido = process.env.CHEQUEO_RAPIDO === '1'
  const resultados = await chequear(sitio, rapido ? { intentos: 1, pausaMs: 0 } : undefined)
  for (const r of resultados) console.log(`${r.ok ? '✅' : '❌'} ${r.nombre}: ${r.detalle}`)
  const fallos = resultados.filter((r) => !r.ok)
  if (fallos.length) {
    await avisar(process.env.ALERT_WEBHOOK, fallos, sitio)
    console.error(`\n${fallos.length} comprobación(es) fallida(s)`)
    process.exit(1)
  }
  console.log('\nTodo bien')
}
