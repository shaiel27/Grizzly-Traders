import { describe, expect, it } from 'vitest'
import { briefImageCount, briefTextLength, briefToPayload, briefWordCount, MAX_BRIEF_IMAGES } from './brief'

const url = (n: number) => `https://p.supabase.co/storage/v1/object/public/post-images/inline/2026/${n}.webp`
const fig = (n: number, alt = `alt ${n}`, caption = '') =>
  `<figure><img src="${url(n)}" alt="${alt}" width="1600" height="800">${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`

describe('briefToPayload', () => {
  it('sustituye cada figura por un marcador en su sitio y devuelve sus datos aparte', () => {
    const html = `<p>Antes</p>${fig(1, 'Gráfico MNQ', 'Fuente: TradingView')}<p>Entre</p>${fig(2)}<p>Después</p>`
    const out = briefToPayload(html)
    expect(out.cuerpo).toBe('<p>Antes</p><p>[[IMG:1]]</p><p>Entre</p><p>[[IMG:2]]</p><p>Después</p>')
    expect(out.imagenes).toEqual([
      { n: 1, url: url(1), alt: 'Gráfico MNQ', caption: 'Fuente: TradingView', width: 1600, height: 800 },
      { n: 2, url: url(2), alt: 'alt 2', caption: '', width: 1600, height: 800 },
    ])
  })

  it('sin imágenes deja el cuerpo igual', () => {
    expect(briefToPayload('<p>solo texto</p>')).toEqual({ cuerpo: '<p>solo texto</p>', imagenes: [] })
  })

  it('decodifica las entidades de alt y pie de foto', () => {
    const out = briefToPayload(fig(1, 'S&amp;P &quot;500&quot;', 'A &amp; B'))
    expect(out.imagenes[0]).toMatchObject({ alt: 'S&P "500"', caption: 'A & B' })
  })

  it('con más imágenes del tope, las sobrantes se quitan', () => {
    const html = Array.from({ length: MAX_BRIEF_IMAGES + 2 }, (_, i) => fig(i + 1)).join('')
    const out = briefToPayload(html)
    expect(out.imagenes).toHaveLength(MAX_BRIEF_IMAGES)
    expect(out.cuerpo).not.toContain('<figure')
    expect(out.cuerpo.match(/\[\[IMG:\d+\]\]/g)).toHaveLength(MAX_BRIEF_IMAGES)
  })
})

describe('briefTextLength', () => {
  it('cuenta solo el texto: sin etiquetas, marcadores ni figuras', () => {
    expect(briefTextLength('<p>Hola&nbsp;mundo</p><p>[[IMG:1]]</p>')).toBe(10)
    expect(briefTextLength(`<p>abc</p>${fig(1, 'texto alternativo largo', 'pie largo')}`)).toBe(3)
    expect(briefTextLength('<p>  </p>')).toBe(0)
  })
  it('cuenta las imágenes', () => {
    expect(briefImageCount(`${fig(1)}<p>x</p>${fig(2)}`)).toBe(2)
  })
})

describe('briefWordCount', () => {
  it('cuenta palabras del texto visible, separando párrafos', () => {
    expect(briefWordCount('<p>uno dos</p><p>tres</p>')).toBe(3)
    expect(briefWordCount(`<p>a b</p>${fig(1, 'alt largo aquí', 'pie largo')}<p>[[IMG:1]]</p>`)).toBe(2)
    expect(briefWordCount('')).toBe(0)
  })
})
