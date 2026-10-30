import type { Locale } from '@/lib/i18n/get-dictionary'

// Plantillas de correo (diseño oscuro del portal). Reglas del correo HTML: tablas y estilos en línea,
// 600 px de ancho, sin JavaScript. Las fuentes web (Source Serif 4, Inter, IBM Plex Mono) solo las cargan
// Apple Mail, iOS y parte de Outlook; el resto muestra el respaldo (Georgia, sistema, Courier New).

const SERIF = "'Source Serif 4',Georgia,'Times New Roman',Times,serif"
const SANS = "Inter,-apple-system,'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif"
const MONO = "'IBM Plex Mono','SFMono-Regular',Menlo,Consolas,'Courier New',monospace"
const FONT_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Source+Serif+4:wght@700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">'

// Marcador que Resend sustituye por el enlace de baja de cada destinatario en las difusiones
export const UNSUBSCRIBE_PLACEHOLDER = '{{{RESEND_UNSUBSCRIBE_URL}}}'

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Solo http(s): un enlace con otro esquema (javascript:, data:) se reemplaza por un ancla vacía
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : '#'
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).trimEnd()}…`
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))
}

const COPY = {
  es: {
    statusBar: 'Resumen diario',
    digestTitle: 'Las noticias del mercado de hoy',
    digestSubtitle: '{n} noticias seleccionadas, con el enlace al artículo completo.',
    leadLabel: 'Noticia del día',
    moreLabel: 'Más noticias',
    minutes: '{n} min',
    sourceLabel: 'Fuente: {name}',
    readCta: 'Leer artículo',
    allCta: 'Ver todas las noticias',
    subjectPrefix: 'Resumen del día',
    disclaimer:
      'Este resumen es informativo y no constituye asesoría financiera ni una recomendación de compra o venta. Parte del contenido se elabora con ayuda de inteligencia artificial a partir de fuentes públicas, que se citan en cada artículo.',
    whyReceive: 'Recibes este correo porque te suscribiste en Grizzly Traders.',
    unsubscribe: 'Darte de baja',
    privacy: 'Privacidad',
    confirm: {
      subject: 'Confirma tu suscripción a Grizzly Traders',
      preheader: 'Un clic para empezar a recibir el resumen diario.',
      statusBar: 'Confirmar suscripción',
      title: 'Confirma tu correo',
      body: 'Para empezar a recibir el resumen diario de noticias, confirma tu suscripción. El enlace vence en 48 horas.',
      cta: 'Confirmar suscripción',
      ignore: 'Si no fuiste tú, ignora este mensaje: no recibirás nada más.',
      fallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
    },
    unsubscribeEmail: {
      subject: 'Confirma tu baja del resumen diario',
      preheader: 'Un clic para dejar de recibir el resumen diario.',
      statusBar: 'Confirmar baja',
      title: 'Confirma tu baja',
      body: 'Recibimos una solicitud para dejar de enviarte el resumen diario. Confírmala con este enlace, que vence en 48 horas.',
      cta: 'Confirmar baja',
      ignore: 'Si no la pediste tú, ignora este mensaje: seguirás suscrito.',
      fallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
    },
  },
  en: {
    statusBar: 'Daily brief',
    digestTitle: "Today's market news",
    digestSubtitle: '{n} selected stories, each linking to the full article.',
    leadLabel: 'Top story',
    moreLabel: 'More news',
    minutes: '{n} min',
    sourceLabel: 'Source: {name}',
    readCta: 'Read article',
    allCta: 'See all news',
    subjectPrefix: 'Daily brief',
    disclaimer:
      'This brief is for information only and is not financial advice or a recommendation to buy or sell. Part of the content is produced with the help of artificial intelligence from public sources, which are cited in each article.',
    whyReceive: 'You are receiving this email because you subscribed to Grizzly Traders.',
    unsubscribe: 'Unsubscribe',
    privacy: 'Privacy',
    confirm: {
      subject: 'Confirm your Grizzly Traders subscription',
      preheader: 'One click to start receiving the daily brief.',
      statusBar: 'Confirm subscription',
      title: 'Confirm your email',
      body: 'To start receiving the daily news brief, confirm your subscription. The link expires in 48 hours.',
      cta: 'Confirm subscription',
      ignore: 'If this was not you, ignore this message: you will not receive anything else.',
      fallback: 'If the button does not work, copy this link into your browser:',
    },
    unsubscribeEmail: {
      subject: 'Confirm that you want to stop the daily brief',
      preheader: 'One click to stop receiving the daily brief.',
      statusBar: 'Confirm unsubscribe',
      title: 'Confirm your unsubscribe',
      body: 'We received a request to stop sending you the daily brief. Confirm it with this link, which expires in 48 hours.',
      cta: 'Confirm unsubscribe',
      ignore: 'If this was not you, ignore this message: you will stay subscribed.',
      fallback: 'If the button does not work, copy this link into your browser:',
    },
  },
} as const

function dateLabel(date: Date, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  })
    .format(date)
    .replace(/\./g, '')
}

interface Frame {
  locale: Locale
  siteUrl: string
  logoUrl?: string
  statusBar: string
  statusRight?: string
  preheader: string
  title: string
  rows: string
  footer: string
}

// Marco común: barra de estado, logo y pie. Todo el contenido que llega aquí ya va escapado.
// Diseño claro por defecto con variante oscura. Gmail para iPhone (que no entiende prefers-color-scheme) invierte
// él solo los colores del correo y un diseño claro se convierte en uno oscuro coherente; un diseño oscuro con
// fondos protegidos acababa con el texto invertido sobre fondo sin invertir. Apple Mail y Outlook sí aplican las
// clases `d-*` de la hoja de estilos: cada etiqueta recibe la clase según los colores en línea que lleva.
const THEME_CLASSES: Array<[RegExp, string]> = [
  [/background-color:#ffffff/, 'd-bg'],
  [/background-color:#f4f6f8/, 'd-bg2'],
  [/background-color:#e5e7eb/, 'd-rl'],
  [/(?<![-\w])color:#0e0e0e/, 'd-t1'],
  [/(?<![-\w])color:#(?:4b5563|374151)/, 'd-t2'],
  [/(?<![-\w])color:#6b7280/, 'd-t3'],
  [/(?<![-\w])color:#b45309/, 'd-ac'],
  [/(?<![-\w])color:#0a6bbf/, 'd-lk'],
]

function themeClasses(html: string): string {
  const start = html.indexOf('<body')
  const body = html.slice(start).replace(/<([a-z0-9]+)((?:\s[^>]*?)?)\sstyle="([^"]*)"([^>]*)>/gi, (tag, name: string, before: string, style: string, after: string) => {
    const found = THEME_CLASSES.filter(([pattern]) => pattern.test(style)).map(([, cls]) => cls)
    if (found.length === 0) return tag
    const existing = /\sclass="([^"]*)"/.exec(`${before}${after}`)
    if (existing) {
      const merged = `${before}${after}`.replace(existing[0], ` class="${existing[1]} ${found.join(' ')}"`)
      return `<${name}${merged} style="${style}">`
    }
    return `<${name}${before} class="${found.join(' ')}" style="${style}"${after}>`
  })
  return html.slice(0, start) + body
}

function frame({ locale, siteUrl, logoUrl, statusBar, statusRight, preheader, title, rows, footer }: Frame): string {
  return themeClasses(`<!doctype html>
<html lang="${locale}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<!--[if mso]><xml><o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office"><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<title>${escapeHtml(title)}</title>
${FONT_LINK}
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; }
  u + .body a { color: inherit; }
  @media (prefers-color-scheme: dark) {
    .d-bg { background-color: #0e0e0e !important; }
    .d-bg2 { background-color: #141414 !important; }
    .d-rl { background-color: #1f1f1f !important; }
    .d-t1, .d-t1 a { color: #ffffff !important; }
    .d-t2 { color: #a3a3a3 !important; }
    .d-t3 { color: #8f8f8f !important; }
    .d-ac { color: #f7b955 !important; }
    .d-lk, .d-lk a { color: #4fc3ff !important; }
    .wrap { border-color: #262626 !important; }
  }
  @media only screen and (max-width: 620px) {
    .wrap { width: 100% !important; }
    .pad { padding-left: 20px !important; padding-right: 20px !important; }
    .lead { font-size: 26px !important; line-height: 32px !important; }
    .title { font-size: 28px !important; line-height: 34px !important; }
    .card { padding: 22px 20px 24px 20px !important; }
  }
</style>
</head>
<body class="body" style="margin:0;padding:0;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#ffffff;font-size:1px;line-height:1px;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="600" bgcolor="#ffffff"><![endif]-->
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:16px;">
<tr><td class="pad" bgcolor="#ffffff" style="background-color:#ffffff;padding:22px 32px 20px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;"><tr>
<td width="48" valign="middle" bgcolor="#0e0e0e" style="width:48px;background-color:#0e0e0e;background-image:linear-gradient(#0e0e0e,#0e0e0e);border-radius:12px;"><img src="${safeUrl(logoUrl ?? `${siteUrl}/logo.png`)}" alt="Grizzly Traders" width="48" height="48" style="display:block;width:48px;height:48px;border:0;outline:none;text-decoration:none;background-color:#0e0e0e;background-image:linear-gradient(#0e0e0e,#0e0e0e);border-radius:12px;color:#ffffff;font-family:${SANS};font-size:14px;line-height:48px;font-weight:700;"></td>
<td valign="middle" bgcolor="#ffffff" style="background-color:#ffffff;padding-left:14px;"><p style="margin:0;font-family:${SERIF};font-size:20px;line-height:24px;font-weight:700;color:#0e0e0e;letter-spacing:-0.2px;">Grizzly Traders</p><p style="margin:3px 0 0 0;font-family:${MONO};font-size:12px;line-height:16px;color:#4b5563;"><span style="color:#16a34a;">&#9679;</span>&nbsp; ${escapeHtml(statusBar)}</p></td>
${statusRight ? `<td class="date" align="right" valign="middle" bgcolor="#ffffff" style="background-color:#ffffff;font-family:${MONO};font-size:12px;line-height:16px;color:#4b5563;white-space:nowrap;">${escapeHtml(statusRight)}</td>` : ''}
</tr></table></td></tr>
<tr><td height="1" bgcolor="#e5e7eb" style="height:1px;font-size:0;line-height:0;background-color:#e5e7eb;">&nbsp;</td></tr>
${rows}
<tr><td height="1" bgcolor="#e5e7eb" style="height:1px;font-size:0;line-height:0;background-color:#e5e7eb;">&nbsp;</td></tr>
<tr><td class="pad" bgcolor="#ffffff" style="background-color:#ffffff;padding:24px 32px 28px 32px;font-family:${SANS};font-size:12px;line-height:19px;color:#6b7280;">${footer}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</div>
</body>
</html>`)
}

const RULE_ROW = `<tr><td height="1" bgcolor="#e5e7eb" style="height:1px;font-size:0;line-height:0;background-color:#e5e7eb;">&nbsp;</td></tr>`

function postalRow(postalAddress: string | undefined): string {
  return postalAddress
    ? `<p style="margin:0;color:#6b7280;">Grizzly Traders &nbsp;·&nbsp; ${escapeHtml(postalAddress)}</p>`
    : '<p style="margin:0;color:#6b7280;">Grizzly Traders</p>'
}

function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#0a6bbf" style="background-color:#0a6bbf;border-radius:999px;"><a href="${safeUrl(url)}" style="display:inline-block;padding:12px 24px;font-family:${SANS};font-size:14px;line-height:18px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(label)}&nbsp;&rarr;</a></td></tr></table>`
}

interface ActionEmailInput {
  locale: Locale
  url: string
  siteUrl: string
  /** URL completa (https) del logo, accesible desde internet (cuadrado, se muestra a 48x48). Si falta, se usa `${siteUrl}/logo.png`. */
  logoUrl?: string
  postalAddress?: string
}

// Correo del sistema con un solo botón (confirmar alta, confirmar baja)
function renderActionEmail(kind: 'confirm' | 'unsubscribeEmail', { locale, url, siteUrl, logoUrl, postalAddress }: ActionEmailInput): RenderedEmail {
  const c = COPY[locale][kind]
  const rows = `<tr><td class="pad" bgcolor="#ffffff" style="background-color:#ffffff;padding:22px 32px 4px 32px;"><h1 style="margin:0;font-family:${SERIF};font-size:30px;line-height:36px;font-weight:700;color:#0e0e0e;letter-spacing:-0.3px;">${escapeHtml(c.title)}</h1><p style="margin:12px 0 22px 0;font-family:${SANS};font-size:15px;line-height:24px;color:#4b5563;">${escapeHtml(c.body)}</p>${button(url, c.cta)}<p style="margin:22px 0 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:#6b7280;">${escapeHtml(c.fallback)}<br><a href="${safeUrl(url)}" style="color:#0a6bbf;word-break:break-all;">${escapeHtml(url)}</a></p></td></tr>
<tr><td class="pad" bgcolor="#ffffff" style="background-color:#ffffff;padding:20px 32px 30px 32px;"></td></tr>`
  const footer = `<p style="margin:0 0 10px 0;">${escapeHtml(c.ignore)}</p>${postalRow(postalAddress)}`
  return {
    subject: c.subject,
    html: frame({ locale, siteUrl, logoUrl, statusBar: c.statusBar, preheader: c.preheader, title: c.title, rows, footer }),
    text: `${c.title}\n\n${c.body}\n\n${c.cta}: ${url}\n\n${c.ignore}\n`,
  }
}

export function renderConfirmationEmail(input: ActionEmailInput): RenderedEmail {
  return renderActionEmail('confirm', input)
}

export function renderUnsubscribeRequestEmail(input: ActionEmailInput): RenderedEmail {
  return renderActionEmail('unsubscribeEmail', input)
}

export interface DigestEmailPost {
  title: string
  url: string
  description: string
  category: string | null
  readingMinutes: number | null
  sourceName: string | null
}

export interface DigestEmailInput {
  locale: Locale
  posts: DigestEmailPost[]
  siteUrl: string
  /** URL completa (https) del logo, accesible desde internet (cuadrado, se muestra a 48x48). Si falta, se usa `${siteUrl}/logo.png`. Los enlaces a artículos siguen usando siteUrl. */
  logoUrl?: string
  postalAddress?: string
  date: Date
  timeZone?: string
}

function metaLine(post: DigestEmailPost, locale: Locale, leadLabel?: string): string {
  const c = COPY[locale]
  // La etiqueta destacada (noticia del día o categoría) va en ámbar; lo demás, en gris y separado por espacio
  const accent = leadLabel ?? post.category
  const rest = [
    leadLabel ? post.category : null,
    post.readingMinutes ? fill(c.minutes, { n: post.readingMinutes }) : null,
    post.sourceName ? fill(c.sourceLabel, { name: post.sourceName }) : null,
  ].filter((part): part is string => Boolean(part))
  const accentHtml = accent ? `<span style="color:#b45309;">${escapeHtml(accent)}</span>` : ''
  const restHtml = rest.map((part) => `<span style="color:#6b7280;">${escapeHtml(part)}</span>`).join('&ensp;&ensp;')
  return [accentHtml, restHtml].filter(Boolean).join('&ensp;&ensp;')
}

export function renderDigestEmail({ locale, posts, siteUrl, logoUrl, postalAddress, date, timeZone = 'UTC' }: DigestEmailInput): RenderedEmail {
  if (posts.length === 0) throw new Error('renderDigestEmail: se necesita al menos un artículo')
  const c = COPY[locale]
  const [lead, ...rest] = posts

  const leadRow = `<tr><td class="pad" bgcolor="#ffffff" style="background-color:#ffffff;padding:30px 32px 2px 32px;"><h1 class="title" style="margin:0;font-family:${SERIF};font-size:34px;line-height:40px;font-weight:700;color:#0e0e0e;letter-spacing:-0.4px;">${escapeHtml(c.digestTitle)}</h1><p style="margin:10px 0 0 0;font-family:${SANS};font-size:15px;line-height:23px;color:#4b5563;">${escapeHtml(fill(c.digestSubtitle, { n: posts.length }))}</p></td></tr>
<tr><td class="pad" bgcolor="#ffffff" style="background-color:#ffffff;padding:24px 32px 4px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f6f8" style="background-color:#f4f6f8;border-left:3px solid #0a6bbf;border-radius:12px;"><tr><td class="card" bgcolor="#f4f6f8" style="padding:26px 26px 28px 26px;background-color:#f4f6f8;"><p style="margin:0 0 14px 0;font-family:${MONO};font-size:12px;line-height:18px;color:#6b7280;">${metaLine(lead, locale, c.leadLabel)}</p><h2 class="lead" style="margin:0;font-family:${SERIF};font-size:29px;line-height:36px;font-weight:700;color:#0e0e0e;letter-spacing:-0.3px;"><a href="${safeUrl(lead.url)}" style="color:#0e0e0e;text-decoration:none;">${escapeHtml(lead.title)}</a></h2><p style="margin:14px 0 22px 0;font-family:${SANS};font-size:15px;line-height:24px;color:#374151;">${escapeHtml(lead.description)}</p>${button(lead.url, c.readCta)}</td></tr></table></td></tr>`

  const restRows = rest
    .map((post, index) => {
      const divider = index === rest.length - 1 ? '' : RULE_ROW
      return `<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:22px 0;"><p style="margin:0 0 8px 0;font-family:${MONO};font-size:12px;line-height:18px;color:#6b7280;">${metaLine(post, locale)}</p><h3 style="margin:0;font-family:${SERIF};font-size:21px;line-height:28px;font-weight:700;letter-spacing:-0.2px;"><a href="${safeUrl(post.url)}" style="color:#0e0e0e;text-decoration:none;">${escapeHtml(post.title)}</a></h3><p style="margin:8px 0 0 0;font-family:${SANS};font-size:14px;line-height:22px;color:#4b5563;">${escapeHtml(post.description)}</p><p style="margin:10px 0 0 0;"><a href="${safeUrl(post.url)}" style="font-family:${SANS};font-size:13px;line-height:18px;font-weight:600;color:#0a6bbf;text-decoration:none;">${escapeHtml(c.readCta)}&nbsp;&rarr;</a></p></td></tr>${divider}`
    })
    .join('\n')

  const moreRows = rest.length
    ? `<tr><td class="pad" bgcolor="#ffffff" style="background-color:#ffffff;padding:30px 32px 0 32px;"><p style="margin:0;padding-bottom:4px;font-family:${SANS};font-size:13px;line-height:18px;font-weight:600;color:#4b5563;">${escapeHtml(c.moreLabel)}</p></td></tr>
<tr><td class="pad" bgcolor="#ffffff" style="background-color:#ffffff;padding:0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;">${restRows}</table></td></tr>`
    : ''

  const allRow = `<tr><td class="pad" align="center" bgcolor="#ffffff" style="background-color:#ffffff;padding:8px 32px 30px 32px;"><a href="${safeUrl(`${siteUrl}/articulos`)}" style="font-family:${SANS};font-size:14px;line-height:20px;font-weight:600;color:#0a6bbf;text-decoration:none;">${escapeHtml(c.allCta)}&nbsp;&rarr;</a></td></tr>`

  const footer = `<p style="margin:0 0 10px 0;">${escapeHtml(c.disclaimer)}</p><p style="margin:0 0 10px 0;">${escapeHtml(c.whyReceive)} <a href="${UNSUBSCRIBE_PLACEHOLDER}" style="color:#0a6bbf;">${escapeHtml(c.unsubscribe)}</a> &nbsp;·&nbsp; <a href="${safeUrl(`${siteUrl}/legal/privacidad`)}" style="color:#0a6bbf;">${escapeHtml(c.privacy)}</a></p>${postalRow(postalAddress)}`

  const subject = `${c.subjectPrefix}: ${truncate(lead.title, 70)}`
  const text = [
    c.digestTitle,
    '',
    ...posts.map((post) => `${post.title}\n${post.description}\n${post.url}\n`),
    `${c.allCta}: ${siteUrl}/articulos`,
    '',
    c.disclaimer,
    `${c.whyReceive} ${c.unsubscribe}: ${UNSUBSCRIBE_PLACEHOLDER}`,
    postalAddress ? `Grizzly Traders · ${postalAddress}` : 'Grizzly Traders',
  ].join('\n')

  return {
    subject,
    html: frame({
      locale,
      siteUrl,
      logoUrl,
      statusBar: c.statusBar,
      statusRight: dateLabel(date, locale, timeZone),
      preheader: truncate(posts.map((post) => post.title).join(' · '), 110),
      title: subject,
      rows: `${leadRow}\n${moreRows}\n${allRow}`,
      footer,
    }),
    text,
  }
}
