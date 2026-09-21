import { describe, expect, it } from 'vitest'
import { htmlToText, sanitizeArticleHtml } from './sanitize'

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

describe('htmlToText', () => {
  it('strips tags and collapses whitespace', () => {
    expect(htmlToText('<p>Hola&nbsp;<b>mundo</b></p>\n<p>fin</p>')).toBe('Hola mundo fin')
  })
})
