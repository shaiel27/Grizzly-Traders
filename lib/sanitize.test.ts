import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { htmlToText, isOwnStorageImage, optimizeArticleImages, sanitizeArticleHtml } from './sanitize'

describe('sanitizeArticleHtml', () => {
  it('removes scripts and inline event handlers', () => {
    const out = sanitizeArticleHtml('<h2 onclick="x()">Hola</h2><script>alert(1)</script>')
    expect(out).toBe('<h2>Hola</h2>')
  })

  it('drops javascript: links but keeps safe ones with a hardened rel', () => {
    const out = sanitizeArticleHtml('<a href="javascript:alert(1)">x</a><a href="https://ok.com">ok</a>')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('href="https://ok.com"')
    expect(out).toContain('rel="noopener noreferrer nofollow"')
  })

  it('removes iframes, inline styles and onerror attributes', () => {
    const out = sanitizeArticleHtml('<iframe src="https://evil"></iframe><p style="color:red">t</p><img src="x" onerror="alert(1)">')
    expect(out).not.toMatch(/iframe|style|onerror/)
    expect(out).toContain('<p>t</p>')
  })

  it('keeps article structure such as tables and lists', () => {
    const html = '<ul><li>a</li></ul><table><tr><td colspan="2">c</td></tr></table>'
    expect(sanitizeArticleHtml(html)).toBe(html)
  })
})

describe('imágenes del texto', () => {
  const base = 'https://proj.supabase.co/storage/v1/object/public/post-images'

  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co'))
  afterEach(() => vi.unstubAllEnvs())

  it('conserva las imágenes del propio bucket con su figura y pie de foto, y las carga en diferido', () => {
    const out = sanitizeArticleHtml(`<figure><img src="${base}/inline/2026/ab12.webp" alt="MNQ 1h" width="1600" height="800"><figcaption>Gráfico: MNQ</figcaption></figure>`)
    expect(out).toContain(`src="${base}/inline/2026/ab12.webp"`)
    expect(out).toContain('alt="MNQ 1h"')
    expect(out).toContain('loading="lazy"')
    expect(out).toContain('<figcaption>Gráfico: MNQ</figcaption>')
  })

  it('elimina las imágenes de otros sitios, de otros buckets, con data: o con recorrido de ruta', () => {
    for (const src of ['https://evil.example/pixel.png', 'https://proj.supabase.co/storage/v1/object/public/otro/x.png', 'data:image/png;base64,AAAA', `${base}/../private/x.png`, 'javascript:alert(1)']) {
      expect(sanitizeArticleHtml(`<p>a</p><img src="${src}" alt="x">`)).toBe('<p>a</p>')
    }
  })

  it('sin la URL de Supabase configurada no deja pasar ninguna imagen', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(sanitizeArticleHtml(`<img src="${base}/inline/a.webp" alt="x">`)).toBe('')
    expect(isOwnStorageImage(`${base}/a.webp`, undefined)).toBe(false)
  })
})

describe('optimizeArticleImages', () => {
  const base = 'https://proj.supabase.co'
  const own = `${base}/storage/v1/object/public/post-images/inline/2026/ab.webp`

  it('sirve las imágenes del bucket por el optimizador con tres anchos y sizes', () => {
    const out = optimizeArticleImages(`<figure><img src="${own}" alt="x" width="1600" height="800"></figure>`, base)
    expect(out).toContain('src="/_next/image?url=' + encodeURIComponent(own) + '&amp;w=828&amp;q=75"')
    expect(out).toContain('640w')
    expect(out).toContain('1200w')
    expect(out).toContain('sizes="(min-width: 800px) 760px, 100vw"')
    expect(out).toContain('alt="x"')
    expect(out).toContain('width="1600"')
  })

  it('no toca otras imágenes ni el HTML sin imágenes', () => {
    const external = '<img src="https://evil.example/a.png" alt="">'
    expect(optimizeArticleImages(external, base)).toBe(external)
    expect(optimizeArticleImages('<p>solo texto</p>', base)).toBe('<p>solo texto</p>')
    expect(optimizeArticleImages(`<img src="${own}">`, undefined)).toBe(`<img src="${own}">`)
  })

  it('es el último paso: el HTML que se guarda sigue con la URL original del bucket', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', base)
    const stored = sanitizeArticleHtml(`<img src="${own}" alt="x">`)
    expect(stored).toContain(own)
    expect(stored).not.toContain('_next/image')
    vi.unstubAllEnvs()
  })
})

describe('htmlToText', () => {
  it('strips tags and collapses whitespace', () => {
    expect(htmlToText('<p>Hola&nbsp;<b>mundo</b></p>\n<p>fin</p>')).toBe('Hola mundo fin')
  })
})
