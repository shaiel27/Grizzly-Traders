import { createHmac } from 'node:crypto'
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
    expect(destinos('¿Publicar en X?')).toEqual([['X - Descargar portada'], ['X - Registrar prueba']])
    expect(destinos('X - Descargar portada')).toEqual([['X - Firmar subida']])
    expect(destinos('X - Firmar subida')).toEqual([['X - Subir portada']])
    expect(destinos('X - Subir portada')).toEqual([['X - Media id']])
    expect(destinos('X - Media id')).toEqual([['X - Publicar']])
    expect(destinos('X - Publicar')).toEqual([['X - Resultado']])
    expect(destinos('X - Resultado')).toEqual([['¿X publicó?']])
    expect(destinos('¿X publicó?')).toEqual([['X - Guardar id'], ['X - Log']])
    expect(destinos('X - Guardar id')).toEqual([['X - Log']])
  })

  it('nada de la rama de X puede detener el pipeline: todo lo que llama a la red continúa si falla', () => {
    for (const n of ['X - Descargar portada', 'X - Subir portada', 'X - Publicar', 'X - Registrar prueba', 'X - Guardar id', 'X - Log']) expect(nodo(n).onError).toBe('continueRegularOutput')
  })

  it('«X - Publicar» no reintenta (podría publicar dos veces), responde sin lanzar y usa la credencial OAuth2 de X', () => {
    const p = nodo('X - Publicar').parameters
    expect(p.url).toBe('https://api.x.com/2/tweets')
    expect(p.options.response.response).toMatchObject({ fullResponse: true, neverError: true })
    expect(nodo('X - Publicar')).not.toHaveProperty('retryOnFail')
    expect(nodo('X - Publicar').credentials!.oAuth2Api.id).toBe('XcredGrizzly0001')
    // con id de imagen lleva la portada; sin él, solo el texto (respaldo)
    expect(p.jsonBody).toBe('={{ JSON.stringify($json.mediaId ? { text: $json.texto, media: { media_ids: [$json.mediaId] } } : { text: $json.texto }) }}')
  })

  it('en modo de prueba no se llama a X: el texto queda en pipeline_logs con la fuente «X (prueba)»', () => {
    expect(nodo('X - Registrar prueba').parameters.url).toContain('/pipeline_logs')
    expect(nodo('X - Registrar prueba').parameters.jsonBody).toContain('X (prueba)')
  })
})

describe('portada en la publicación', () => {
  it('descarga la portada de la dirección del candidato, sin lanzar si falla', () => {
    const p = nodo('X - Descargar portada').parameters
    expect(p.url).toBe('={{ $json.portada }}')
    expect(p.options.response.response).toMatchObject({ neverError: true, responseFormat: 'file', outputPropertyName: 'data' })
  })

  it('la sube con la API de medios de X, como imagen de publicación, sin reintentos y con la cabecera OAuth 1.0a ya firmada (sin credencial OAuth2)', () => {
    const p = nodo('X - Subir portada').parameters
    expect(p.url).toBe('https://api.x.com/2/media/upload')
    expect(p.contentType).toBe('multipart-form-data')
    expect(p.bodyParameters.parameters).toEqual([
      { parameterType: 'formBinaryData', name: 'media', inputDataFieldName: 'data' },
      { name: 'media_category', value: 'tweet_image' },
    ])
    expect(p.options.response.response).toMatchObject({ fullResponse: true, neverError: true })
    expect(nodo('X - Subir portada')).not.toHaveProperty('retryOnFail')
    expect(p.authentication).toBe('none')
    expect(p.headerParameters.parameters).toEqual([{ name: 'Authorization', value: '={{ $json.authX }}' }])
    expect(nodo('X - Subir portada').credentials).toBeUndefined()
  })

  const media = (r: unknown) =>
    (new Function('$json', '$', codigo('X - Media id'))(r, () => ({ item: { json: { texto: 'texto', postId: 'p1', portada: 'https://e.com/p.webp' } } })) as { json: { mediaId: string; conImagen: boolean; errorImagen: string; texto: string; postId: string; portada: string } }).json

  it('con id de imagen, la publicación lleva portada y conserva los datos del artículo', () => {
    expect(media({ statusCode: 200, body: { data: { id: '1234567890' } } })).toEqual({ texto: 'texto', postId: 'p1', portada: 'https://e.com/p.webp', mediaId: '1234567890', conImagen: true, errorImagen: '' })
  })

  it('RESPALDO A SOLO TEXTO: cualquier fallo de la subida deja mediaId vacío y explica el motivo, sin romper nada', () => {
    for (const r of [
      { statusCode: 403, body: { detail: 'Forbidden' } },
      { statusCode: 400, body: { title: 'Invalid Request' } },
      { statusCode: 402, body: {} },
      { statusCode: 200, body: {} },
      { error: { message: 'no binary data' } },
      { error: 'timeout' },
      {},
    ]) {
      const m = media(r)
      expect(m.mediaId).toBe('')
      expect(m.conImagen).toBe(false)
      expect(m.errorImagen).toContain('portada no subida')
      expect(m.texto).toBe('texto') // el texto sigue ahí: se publicará igual
    }
  })

  it('si la credencial no está conectada, la portada lo dice con claridad y se publica solo el texto', () => {
    const m = media({ error: {}, details: { message: 'Unable to sign without access token' } })
    expect(m.mediaId).toBe('')
    expect(m.errorImagen).toContain('credencial de X sin conectar')
    expect(m.errorImagen).not.toContain('[object Object]')
    expect(m.texto).toBe('texto')
  })

  it('«X - Resultado» recuerda si salió con portada, para el registro', () => {
    const resultado = (r: unknown, previo: Record<string, unknown>) =>
      (new Function('$json', '$', codigo('X - Resultado'))(r, () => ({ item: { json: previo } })) as { json: { ok: boolean; conImagen: boolean; errorImagen: string } }).json
    expect(resultado({ statusCode: 201, body: { data: { id: '5' } } }, { texto: 't', postId: 'p', conImagen: true })).toMatchObject({ ok: true, conImagen: true, errorImagen: '' })
    expect(resultado({ statusCode: 201, body: { data: { id: '5' } } }, { texto: 't', postId: 'p', conImagen: false, errorImagen: 'portada no subida (X respondio 403)' })).toMatchObject({ ok: true, conImagen: false, errorImagen: 'portada no subida (X respondio 403)' })
  })

  it('los registros dicen si salió solo con texto, y la prueba muestra la portada que se habría subido', () => {
    expect(nodo('X - Log').parameters.jsonBody).toContain("'solo texto: '")
    expect(nodo('X - Registrar prueba').parameters.jsonBody).toContain("'portada: '")
  })
})

describe('detección de avisos de bufetes (Contar publicado)', () => {
  const marca = (p: Record<string, unknown>) => {
    const est: Estatico = { ejec: '9', publicados: 0, articulosX: [] }
    new Function('$json', '$', '$execution', '$getWorkflowStaticData', codigo('Contar publicado'))(
      {},
      (n: string) => ({ item: { json: n === 'Parsear JSON' ? { slug: 's', fuente: 'GlobeNewswire', relevancia: 7, category_id: 4, cover_assets: [], ...p } : { body: [{ id: 'id-1' }], cover_image_url: 'https://e.com/p.webp' } } }),
      { id: '9' },
      () => est
    )
    return est.articulosX[0].aviso as boolean
  }
  // titulares REALES que el selector eligió en produccion el 13-nov (el modelo les dio relevancia 7)
  it.each([
    ['Advertencia para inversores de Anavex: plazo final para representación legal se aproxima', 'Inversores de Anavex deben asegurarse representación legal antes del 30 de noviembre', 'ANAVEX LIFE SCIENCES INVESTORS: Deadline Alert - Contact Law Firm'],
    ['Tigo Energy: última oportunidad para inversores', 'Los inversores afectados pueden unirse a la demanda', 'Tigo Energy Investors Encouraged to Contact the Gross Law Firm'],
    ['Demandan a Intel por supuestos engaños a inversores', 'Un despacho presentó una acción colectiva', 'Robbins Geller Rudman & Dowd LLP Files Class Action Suit Against Intel'],
    ['Rosen Law Firm recuerda el plazo a los inversores de Yiren Digital', 'Los inversores que perdieron dinero', 'Rosen Law Firm Encourages Yiren Digital Ltd. Investors to Secure Counsel'],
  ])('es aviso de bufete: %s', (title, meta, source_title) => {
    expect(marca({ title, meta_description: meta, source_title })).toBe(true)
  })
  it.each([
    ['Tempest Therapeutics presenta resultados del tercer trimestre', 'La compañía informó una pérdida neta menor', 'Tempest Therapeutics Reports Third Quarter 2026 Financial Results'],
    ['Nvidia: la estrategia de opciones antes de los resultados', 'Los inversores miran la volatilidad implícita', 'Nvidia options strategy ahead of earnings'],
    ['Windward Bio anuncia su cotización en Nasdaq', 'La biotecnológica comenzará a cotizar', 'Windward Bio announces Nasdaq listing'],
    ['La Reserva Federal mantiene las tasas sin cambios', 'Evaluará nuevos datos de inflación', 'Federal Reserve issues FOMC statement'],
  ])('NO es aviso de bufete: %s', (title, meta, source_title) => {
    expect(marca({ title, meta_description: meta, source_title })).toBe(false)
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
  it('NUNCA elige un aviso de bufete, aunque tenga la relevancia más alta; y descarta lo de relevancia menor que 5', () => {
    const est: Estatico = { ejec: '7', articulosX: [{ ...art('bufete', 10, 2), aviso: true }, art('baja', 4, 2), art('buena', 6, 0)] }
    expect(elegir('7', est).map((x) => x.json.postId)).toEqual(['buena'])
    expect(elegir('7', { ejec: '7', articulosX: [{ ...art('b1', 9), aviso: true }, art('b2', 3)] })).toEqual([])
    expect(elegir('7', { ejec: '7', articulosX: [art('justo', 5)] }).map((x) => x.json.postId)).toEqual(['justo'])
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

  it('al recortar corta por palabras completas, nunca a media palabra', () => {
    const palabras = 'Inversores de Anavex Life Sciences deben asegurarse representación legal antes del treinta de noviembre para una posible demanda colectiva contra la compañía por declaraciones engañosas sobre su fármaco'
    const r = armar({ ...base, titulo: 'Advertencia para inversores de Anavex: plazo final para representación legal se aproxima hoy mismo', resumen: palabras })
    const contexto = r.texto.split('\n\n')[1]
    if (contexto.endsWith('…')) {
      const cortado = contexto.slice(0, -1)
      expect(palabras.startsWith(cortado)).toBe(true)
      expect(/\s/.test(palabras[cortado.length])).toBe(true) // el corte cae justo en un espacio del original
    }
    expect(r.largo).toBeLessThanOrEqual(275)
  })

  it('un contexto que tras recortarse queda en menos de 40 caracteres se quita en vez de dejar un trozo', () => {
    const titulo = 'Titular largo '.repeat(9).trim()
    const r = armar({ ...base, titulo, resumen: 'Esta es una frase de contexto bastante larga que no cabe' })
    expect(r.largo).toBeLessThanOrEqual(275)
    for (const bloque of r.texto.split('\n\n')) if (bloque.endsWith('…')) expect(bloque.length).toBeGreaterThanOrEqual(40)
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

describe('X - Firmar subida (OAuth 1.0a)', () => {
  const claves = { consumerKey: 'CK', consumerSecret: 'CS', token: 'TK', tokenSecret: 'TS' }
  const env = { X_OAUTH1_API_KEY: 'CK', X_OAUTH1_API_SECRET: 'CS', X_OAUTH1_TOKEN: 'TK', X_OAUTH1_TOKEN_SECRET: 'TS' }
  const entrada = { json: { postId: 'p1' }, binary: { data: { fileName: 'p.webp' } } }
  const correr = (e: Record<string, string>) =>
    new Function('$json', '$env', '$input', codigo('X - Firmar subida'))(entrada.json, e, { item: { binary: entrada.binary } }) as { json: { postId: string; authX: string }; binary: unknown }
  // la función de firma sola (el código del nodo hasta el marcador)
  const firmar = new Function(codigo('X - Firmar subida').split('// --- nodo ---')[0] + '\nreturn firmarOAuth1;')() as (m: string, u: string, c: typeof claves, extra: Record<string, string>, ahora: number, nonce: string) => string

  it('reproduce el ejemplo oficial de firma de la documentación de X', () => {
    const h = firmar(
      'POST',
      'https://api.twitter.com/1.1/statuses/update.json',
      { consumerKey: 'xvz1evFS4wEEPTGEFPHBog', consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw', token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb', tokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE' },
      { include_entities: 'true', status: 'Hello Ladies + Gentlemen, a signed OAuth request!' },
      1318622958,
      'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
    )
    expect(h).toContain('oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"')
  })

  it('la firma coincide con la de la biblioteca crypto de Node para cualquier clave y mensaje (incluye claves largas y símbolos)', () => {
    for (const [ck, cs, tk, ts] of [['CK', 'CS', 'TK', 'TS'], ['a'.repeat(25), 'b'.repeat(50), '1234-' + 'c'.repeat(40), 'd'.repeat(45)], ['k+/=', 's&=%ñ', 't!*()', "q'~_-"], ['x'.repeat(70), 'y', 'z', 'w']]) {
      const h = firmar('POST', 'https://api.x.com/2/media/upload', { consumerKey: ck, consumerSecret: cs, token: tk, tokenSecret: ts }, {}, 1700000000, 'abc123')
      const obtenido = Object.fromEntries([...h.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], decodeURIComponent(m[2])]))
      const sinFirma = Object.entries(obtenido).filter(([k]) => k !== 'oauth_signature')
      const pct = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
      const base = 'POST&' + pct('https://api.x.com/2/media/upload') + '&' + pct(sinFirma.map(([k, v]) => k + '=' + pct(v)).sort().join('&'))
      const esperada = createHmac('sha1', pct(cs) + '&' + pct(ts)).update(base).digest('base64')
      expect(obtenido.oauth_signature).toBe(esperada)
    }
  })

  it('con las cuatro claves entrega la cabecera Authorization y conserva el binario y los datos del artículo', () => {
    const r = correr(env)
    expect(r.json.postId).toBe('p1')
    expect(r.binary).toBe(entrada.binary)
    expect(r.json.authX).toMatch(/^OAuth oauth_consumer_key="CK", oauth_nonce="[0-9a-f]{32}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="\d{10}", oauth_token="TK", oauth_version="1.0", oauth_signature="[^"]+"$/)
    expect(r.json.authX).not.toContain('CS')
    expect(r.json.authX).not.toContain('TS')
  })

  it('sin alguna de las claves no firma (la subida falla y se publica solo el texto)', () => {
    expect(correr({}).json.authX).toBe('')
    expect(correr({ ...env, X_OAUTH1_TOKEN_SECRET: '' }).json.authX).toBe('')
    expect(correr({}).binary).toBe(entrada.binary)
  })

  it('el código no contiene claves ni secretos', () => {
    const sinAlfabeto = codigo('X - Firmar subida').replace('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', '')
    expect(sinAlfabeto).not.toMatch(/[A-Za-z0-9]{35,}/)
  })
})

describe('X - Resultado', () => {
  const resultado = (r: unknown) =>
    (new Function('$json', '$', codigo('X - Resultado'))(r, () => ({ item: { json: { texto: 'texto', postId: 'p1' } } })) as { json: { ok: boolean; xId: string | null; error: string; postId: string } }).json

  it('201 con id = publicada', () => {
    expect(resultado({ statusCode: 201, body: { data: { id: '12345', text: 't' } } })).toEqual({ ok: true, xId: '12345', error: '', texto: 'texto', postId: 'p1', conImagen: false, errorImagen: '' })
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
  it('credencial sin conectar («Unable to sign without access token»): lo dice claro en vez de «[object Object]»', () => {
    const r = resultado({ error: {}, details: { message: 'Unable to sign without access token', httpCode: null, body: null } })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('credencial de X sin conectar')
    expect(r.error).toContain('pulsar Connect')
    expect(r.error).not.toContain('[object Object]')
  })
  it('cualquier otro fallo anterior a la petición muestra su mensaje, no «[object Object]»', () => {
    const r = resultado({ error: {}, details: { message: 'getaddrinfo ENOTFOUND api.x.com' } })
    expect(r.error).toContain('ENOTFOUND')
    expect(r.error).not.toContain('[object Object]')
  })
  it('un 201 sin id no se da por publicada', () => {
    expect(resultado({ statusCode: 201, body: {} }).ok).toBe(false)
  })
})

describe('relevancia en el análisis de GPT', () => {
  it('el prompt pide «relevancia» de 1 a 10 y Parsear JSON la acota (por defecto 5)', () => {
    const prompt = nodo('OpenAI - Analisis GPT').parameters.responses.values[0].content as string
    expect(prompt).toContain('relevancia (entero de 1 a 10')
    // los avisos de despachos de abogados no son noticias de mercado: 1-3
    expect(prompt).toContain('SIEMPRE los avisos de despachos de abogados')
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
