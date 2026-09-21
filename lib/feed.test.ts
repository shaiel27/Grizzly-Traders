import { afterEach, describe, expect, it, vi } from 'vitest'
import { excerpt, localizedPost, timeAgo } from './feed'
import type { PostTranslation } from './types'

const translation = (locale: 'es' | 'en', title: string, slug: string) =>
  ({ locale, title, slug }) as PostTranslation

describe('localizedPost', () => {
  const base = { title: 'Post title', slug: 'post-slug' }

  it('prefers the Spanish translation', () => {
    const post = { ...base, translations: [translation('en', 'EN', 'en-slug'), translation('es', 'ES', 'es-slug')] }
    expect(localizedPost(post)).toEqual({ title: 'ES', slug: 'es-slug' })
  })

  it('falls back to the first translation, then to the post itself', () => {
    expect(localizedPost({ ...base, translations: [translation('en', 'EN', 'en-slug')] })).toEqual({
      title: 'EN',
      slug: 'en-slug',
    })
    expect(localizedPost({ ...base, translations: [] })).toEqual(base)
    expect(localizedPost(base)).toEqual(base)
  })
})

describe('excerpt', () => {
  it('strips tags and collapses whitespace', () => {
    expect(excerpt('<p>Hello&nbsp;<strong>world</strong></p>\n<p>again</p>')).toBe('Hello world again')
  })

  it('cuts long text at a word boundary and adds an ellipsis', () => {
    const result = excerpt('alpha beta gamma delta epsilon', 14)
    expect(result).toBe('alpha beta…')
  })
})

describe('timeAgo', () => {
  afterEach(() => vi.useRealTimers())

  it('describes elapsed time in Spanish', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-10T12:00:00Z'))
    expect(timeAgo(null)).toBe('recientemente')
    expect(timeAgo('2026-01-10T11:59:50Z')).toBe('hace 1 min')
    expect(timeAgo('2026-01-10T11:30:00Z')).toBe('hace 30 min')
    expect(timeAgo('2026-01-10T09:00:00Z')).toBe('hace 3 h')
    expect(timeAgo('2026-01-09T12:00:00Z')).toBe('hace 1 día')
    expect(timeAgo('2026-01-05T12:00:00Z')).toBe('hace 5 días')
  })
})
