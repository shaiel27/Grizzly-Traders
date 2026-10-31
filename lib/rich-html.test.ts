import { describe, expect, it } from 'vitest'
import { copyFigures, countImagesWithoutAlt, figuresOf, needsSourceMode, normalizeEditorHtml } from './rich-html'

const fig = (n: number, alt = 'x') => `<figure><img src="https://p.supabase.co/storage/v1/object/public/post-images/inline/${n}.webp" alt="${alt}"><figcaption>c${n}</figcaption></figure>`

describe('needsSourceMode', () => {
  it('detecta lo que el editor visual perdería', () => {
    expect(needsSourceMode('<table><tr><td>1</td></tr></table>')).toBe(true)
    expect(needsSourceMode('<p>a</p><h4>x</h4>')).toBe(true)
    expect(needsSourceMode('<div class="x">a</div>')).toBe(true)
  })
  it('acepta el HTML que el editor sí maneja', () => {
    expect(needsSourceMode('<h2>t</h2><p>a <strong>b</strong> <a href="https://x.com">c</a></p><ul><li>1</li></ul><blockquote><p>q</p></blockquote>' + fig(1))).toBe(false)
  })
})

describe('normalizeEditorHtml', () => {
  it('trata el documento vacío de TipTap como vacío', () => {
    expect(normalizeEditorHtml('<p></p>')).toBe('')
    expect(normalizeEditorHtml(' <p></p> \n')).toBe('')
    expect(normalizeEditorHtml('<p>hola</p>')).toBe('<p>hola</p>')
  })
  it('quita los párrafos vacíos del final pero no los del medio', () => {
    expect(normalizeEditorHtml('<h2>T</h2><p></p>')).toBe('<h2>T</h2>')
    expect(normalizeEditorHtml('<p>a</p><p></p><p></p>')).toBe('<p>a</p>')
    expect(normalizeEditorHtml('<p>a</p><p></p><p>b</p>')).toBe('<p>a</p><p></p><p>b</p>')
  })
})

describe('copyFigures', () => {
  it('copia solo las imágenes que faltan, al final', () => {
    const out = copyFigures(`<p>es</p>${fig(1)}<p>m</p>${fig(2)}`, `<p>en</p>${fig(1)}`)
    expect(out.added).toBe(1)
    expect(out.html).toBe(`<p>en</p>${fig(1)}${fig(2)}`)
  })
  it('no cambia nada si ya están todas', () => {
    expect(copyFigures(fig(1), `<p>a</p>${fig(1)}`)).toEqual({ html: `<p>a</p>${fig(1)}`, added: 0 })
  })
  it('lee la URL de cada figura', () => {
    expect(figuresOf(fig(3)).map((f) => f.src)).toEqual(['https://p.supabase.co/storage/v1/object/public/post-images/inline/3.webp'])
  })
})

describe('countImagesWithoutAlt', () => {
  it('cuenta las imágenes sin texto alternativo o con él vacío', () => {
    expect(countImagesWithoutAlt(`${fig(1)}${fig(2, '')}<img src="a">`)).toBe(2)
    expect(countImagesWithoutAlt('<p>sin imágenes</p>')).toBe(0)
  })

  it('un alt vacío seguido de más atributos sigue contando como ausente', () => {
    expect(countImagesWithoutAlt('<img src="https://x/a.webp" alt="" width="10" height="5">')).toBe(1)
    expect(countImagesWithoutAlt('<img src="https://x/a.webp" alt="   " width="10">')).toBe(1)
    expect(countImagesWithoutAlt('<img src="https://x/a.webp" alt="Gráfico" width="10">')).toBe(0)
  })
})
