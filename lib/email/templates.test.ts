import { describe, expect, it } from 'vitest'
import { escapeHtml, renderConfirmationEmail, renderDigestEmail, renderUnsubscribeRequestEmail, UNSUBSCRIBE_PLACEHOLDER, type DigestEmailPost } from './templates'

const siteUrl = 'https://grizzlytraders.example'
const date = new Date('2026-10-27T12:00:00Z')

function post(n: number, extra: Partial<DigestEmailPost> = {}): DigestEmailPost {
  return {
    title: `Titular ${n}`,
    url: `${siteUrl}/articulos/titular-${n}`,
    description: `Descripción ${n}`,
    category: 'Equities',
    readingMinutes: 3,
    sourceName: null,
    ...extra,
  }
}

describe('escapeHtml', () => {
  it('escapa los caracteres que permitirían inyectar HTML', () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;')
  })
})

describe('correos de confirmación y de baja', () => {
  it('el correo de confirmación lleva el enlace y no pide nada más', () => {
    const email = renderConfirmationEmail({ locale: 'es', url: `${siteUrl}/newsletter/confirmar?token=abc`, siteUrl })
    expect(email.subject).toContain('Confirma')
    expect(email.html).toContain('/newsletter/confirmar?token=abc')
    expect(email.text).toContain('/newsletter/confirmar?token=abc')
    expect(email.html).not.toContain(UNSUBSCRIBE_PLACEHOLDER)
  })

  it('tiene versión en inglés', () => {
    const email = renderConfirmationEmail({ locale: 'en', url: `${siteUrl}/newsletter/confirmar?token=abc`, siteUrl })
    expect(email.subject).toBe('Confirm your Grizzly Traders subscription')
    expect(email.html).toContain('lang="en"')
  })

  it('el correo de baja tiene su propio texto', () => {
    const email = renderUnsubscribeRequestEmail({ locale: 'es', url: `${siteUrl}/newsletter/baja?token=abc`, siteUrl })
    expect(email.subject).toContain('baja')
    expect(email.text).toContain('/newsletter/baja?token=abc')
  })
})

describe('resumen diario', () => {
  it('rechaza un resumen sin artículos', () => {
    expect(() => renderDigestEmail({ locale: 'es', posts: [], siteUrl, date })).toThrow()
  })

  it('el primer artículo es la noticia del día y el resto va sin numerar', () => {
    const email = renderDigestEmail({ locale: 'es', posts: [post(1), post(2), post(3)], siteUrl, date })
    expect(email.html).toContain('Noticia del día')
    expect(email.html).not.toContain('>02<')
    expect(email.html).toContain('Más noticias')
    expect(email.subject).toBe('Resumen del día: Titular 1')
  })

  it('cada envío lleva el enlace de baja del proveedor, el aviso legal y la dirección postal', () => {
    const email = renderDigestEmail({ locale: 'es', posts: [post(1)], siteUrl, date, postalAddress: 'Calle 1, Miami, FL 33101, EE. UU.' })
    expect(email.html).toContain(UNSUBSCRIBE_PLACEHOLDER)
    expect(email.text).toContain(UNSUBSCRIBE_PLACEHOLDER)
    expect(email.html).toContain('no constituye asesoría financiera')
    expect(email.html).toContain('Calle 1, Miami, FL 33101, EE. UU.')
  })

  it('muestra la fuente cuando es un organismo oficial', () => {
    const email = renderDigestEmail({ locale: 'es', posts: [post(1), post(2, { sourceName: 'SEC' })], siteUrl, date })
    expect(email.html).toContain('Fuente: SEC')
  })

  it('escapa el contenido de los artículos', () => {
    const email = renderDigestEmail({ locale: 'es', posts: [post(1, { title: '<img src=x onerror=alert(1)>', description: 'a & b' })], siteUrl, date })
    expect(email.html).not.toContain('<img src=x')
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(email.html).toContain('a &amp; b')
  })

  it('descarta enlaces con esquemas peligrosos', () => {
    const email = renderDigestEmail({ locale: 'es', posts: [post(1, { url: 'javascript:alert(1)' })], siteUrl, date })
    expect(email.html).not.toContain('javascript:')
  })

  it('recorta los asuntos largos', () => {
    const email = renderDigestEmail({ locale: 'es', posts: [post(1, { title: 'palabra '.repeat(30) })], siteUrl, date })
    expect(email.subject.length).toBeLessThan(100)
    expect(email.subject.endsWith('…')).toBe(true)
  })

  it('tiene versión en inglés con su propio asunto y textos', () => {
    const email = renderDigestEmail({ locale: 'en', posts: [post(1), post(2)], siteUrl, date })
    expect(email.subject).toBe('Daily brief: Titular 1')
    expect(email.html).toContain('Top story')
    expect(email.html).toContain('Unsubscribe')
  })

  it('usa la zona horaria pedida para la fecha', () => {
    const lateUtc = new Date('2026-10-28T02:00:00Z')
    expect(renderDigestEmail({ locale: 'en', posts: [post(1)], siteUrl, date: lateUtc, timeZone: 'America/New_York' }).html).toContain('Oct 27, 2026')
    expect(renderDigestEmail({ locale: 'en', posts: [post(1)], siteUrl, date: lateUtc, timeZone: 'UTC' }).html).toContain('Oct 28, 2026')
  })
})

describe('robustez en clientes de correo', () => {
  const logoUrl = 'https://pudzvatuubywmwdmboiq.supabase.co/storage/v1/object/public/post-images/brand/email-logo.png'
  const local = 'http://localhost:3100'

  it('usa logoUrl solo para el logo y mantiene siteUrl en los enlaces', () => {
    const email = renderDigestEmail({ locale: 'es', posts: [post(1), post(2)], siteUrl: local, logoUrl, date })
    expect(email.html).toContain(`<img src="${logoUrl}"`)
    expect(email.html).not.toContain('/logo.png')
    expect(email.html).toContain(`${local}/articulos`)
    expect(email.html.match(/<img /g)).toHaveLength(1)
  })

  it('sin logoUrl cae a siteUrl/logo.png', () => {
    expect(renderDigestEmail({ locale: 'es', posts: [post(1)], siteUrl, date }).html).toContain(`src="${siteUrl}/logo.png"`)
  })

  it('no filtra localhost cuando hay logoUrl publica en ninguna imagen', () => {
    const email = renderDigestEmail({ locale: 'es', posts: [post(1)], siteUrl: local, logoUrl, date })
    expect(email.html.match(/<img [^>]*>/)?.[0]).not.toContain('localhost')
  })

  it('un logoUrl con esquema peligroso se descarta', () => {
    expect(renderDigestEmail({ locale: 'es', posts: [post(1)], siteUrl, logoUrl: 'javascript:alert(1)', date }).html).not.toContain('javascript:')
  })

  it('el logo tiene alt, tamaño explícito y texto alternativo claro sobre su ficha oscura', () => {
    const img = renderDigestEmail({ locale: 'es', posts: [post(1)], siteUrl, logoUrl, date }).html.match(/<img [^>]*>/)?.[0] ?? ''
    expect(img).toContain('alt="Grizzly Traders"')
    expect(img).toContain('width="48"')
    expect(img).toContain('height="48"')
    expect(img).toContain('color:#ffffff')
    expect(img).toContain('linear-gradient(#0e0e0e,#0e0e0e)')
    expect(img).toContain('background-color:#0e0e0e')
  })

  it('los correos de sistema también aceptan logoUrl', () => {
    expect(renderConfirmationEmail({ locale: 'es', url: `${siteUrl}/x`, siteUrl: local, logoUrl }).html).toContain(`src="${logoUrl}"`)
  })

  it('el diseño es claro por defecto (lo invierte bien Gmail iOS) y declara también esquema oscuro', () => {
    const { html } = renderDigestEmail({ locale: 'es', posts: [post(1), post(2)], siteUrl, logoUrl, date })
    expect(html).toContain('<body class="body" style="margin:0;padding:0;">')
    expect(html).toContain('bgcolor="#ffffff"')
    expect(html).toContain('bgcolor="#f4f6f8"')
    expect(html).toContain('content="light dark"')
    expect(html).toContain('@media (prefers-color-scheme: dark)')
    expect(html).toContain('<html lang="es"')
    // el ancho no depende de la hoja de estilos
    expect(html).toContain('max-width:600px')
    // todo enlace del cuerpo lleva color en línea
    for (const a of html.match(/<a [^>]*>/g) ?? []) expect(a).toContain('color:')
  })

  it('no mezcla fondos protegidos con texto sin proteger: solo la ficha del logo lleva degradado', () => {
    const emails = [
      renderDigestEmail({ locale: 'es', posts: [post(1), post(2), post(3)], siteUrl, date }),
      renderConfirmationEmail({ locale: 'es', url: `${siteUrl}/x`, siteUrl }),
      renderUnsubscribeRequestEmail({ locale: 'en', url: `${siteUrl}/x`, siteUrl }),
    ]
    for (const { html } of emails) {
      const body = html.slice(html.indexOf('<body'))
      expect(body.match(/background-image:linear-gradient/g)).toHaveLength(2)
      expect(body).not.toContain('#090909')
    }
  })

  it('cada color en línea tiene su clase para la variante oscura', () => {
    const { html } = renderDigestEmail({ locale: 'es', posts: [post(1), post(2)], siteUrl, logoUrl, date })
    for (const cls of ['d-bg', 'd-bg2', 'd-rl', 'd-t1', 'd-t2', 'd-t3', 'd-ac', 'd-lk']) expect(html).toContain(cls)
    // el título lleva los dos: clase y color en línea
    expect(html).toMatch(/<h1 class="title d-t1" style="[^"]*color:#0e0e0e/)
  })

  it('no incluye scripts ni controladores de eventos', () => {
    const { html } = renderDigestEmail({ locale: 'en', posts: [post(1), post(2)], siteUrl, logoUrl, date })
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/sonw+=/i)
  })
})
