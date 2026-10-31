import sanitizeHtml from 'sanitize-html'

// Las imágenes del texto solo pueden venir del bucket público de la propia web: una URL de otro sitio quedaría rota
// por la CSP y sería un rastreador. El editor del CMS las sube a este bucket (app/api/posts/upload-image).
export function isOwnStorageImage(src: string | undefined, supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  if (!src || !supabaseUrl) return false
  const prefix = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/post-images/`
  return src.startsWith(prefix) && !src.slice(prefix.length).includes('..')
}

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'div', 'span',
    'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  exclusiveFilter: (frame) => frame.tag === 'img' && !isOwnStorageImage(frame.attribs.src),
  transformTags: {
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: 'noopener noreferrer nofollow' },
    }),
  },
}

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS)
}

// Solo al RENDERIZAR el artículo (nunca al guardarlo: la base conserva la URL original del bucket). Cada imagen del
// bucket propio se sirve por el optimizador de Next con tres anchos, así el móvil no baja la de 1600 px.
const ARTICLE_WIDTHS = [640, 828, 1200]
export function optimizeArticleImages(html: string, supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string {
  return html.replace(/<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/gi, (tag, before: string, src: string, after: string) => {
    if (!isOwnStorageImage(src.replace(/&amp;/g, '&'), supabaseUrl)) return tag
    const url = encodeURIComponent(src.replace(/&amp;/g, '&'))
    const variant = (width: number) => `/_next/image?url=${url}&amp;w=${width}&amp;q=75`
    const srcset = ARTICLE_WIDTHS.map((width) => `${variant(width)} ${width}w`).join(', ')
    return `<img${before}src="${variant(828)}" srcset="${srcset}" sizes="(min-width: 800px) 760px, 100vw"${after}>`
  })
}

export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim()
}
