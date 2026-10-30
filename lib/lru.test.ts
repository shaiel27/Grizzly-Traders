import { describe, expect, it } from 'vitest'
import { createLruCache } from './lru'

describe('createLruCache', () => {
  it('stores values and returns undefined for a missing key', () => {
    const cache = createLruCache<string, number>(3)
    expect(cache.get('a')).toBeUndefined()

    cache.set('a', 1)
    expect(cache.get('a')).toBe(1)
  })

  it('reports the number of stored entries', () => {
    const cache = createLruCache<string, number>(3)
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.size).toBe(2)

    cache.get('missing')
    expect(cache.size).toBe(2)
  })

  it('evicts the least recently used entry when the cap is exceeded', () => {
    const cache = createLruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
    expect(cache.size).toBe(2)
  })

  it('keeps an entry alive by reading it', () => {
    const cache = createLruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)

    // Reading `a` makes `b` the least recently used one
    expect(cache.get('a')).toBe(1)
    cache.set('c', 3)

    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBe(3)
  })

  it('refreshes recency and replaces the value when overwriting a key', () => {
    const cache = createLruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)

    cache.set('a', 10)
    expect(cache.get('a')).toBe(10)
    expect(cache.size).toBe(2)

    // `b` is now the oldest entry and gets evicted instead of `a`
    cache.set('c', 3)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe(10)
    expect(cache.get('c')).toBe(3)
  })

  it('drops an entry on delete and leaves the rest untouched', () => {
    const cache = createLruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)

    expect(cache.delete('a')).toBe(true)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.size).toBe(1)

    // Deleting a key that is not there changes nothing
    expect(cache.delete('a')).toBe(false)
    expect(cache.size).toBe(1)
    expect(cache.get('b')).toBe(2)
  })

  it('caches nothing when the cap is zero or negative', () => {
    for (const maxEntries of [0, -1]) {
      const cache = createLruCache<string, number>(maxEntries)
      cache.set('a', 1)

      expect(cache.get('a')).toBeUndefined()
      expect(cache.size).toBe(0)
    }
  })
})
