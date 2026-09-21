import { describe, expect, it } from 'vitest'
import { jsonLdString } from './json-ld'

describe('jsonLdString', () => {
  it('never emits a raw < that could close the script tag', () => {
    const out = jsonLdString({ name: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('<')
    expect(JSON.parse(out).name).toBe('</script><script>alert(1)</script>')
  })
})
