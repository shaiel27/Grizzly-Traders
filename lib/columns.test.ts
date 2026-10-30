import { describe, expect, it } from 'vitest'
import { sanitizeStoredColumns } from './columns'

const VALID = ['name', 'close', 'change', 'volume'] as const
const DEFAULTS = ['name', 'close', 'change', 'volume'] as const

describe('sanitizeStoredColumns', () => {
  it('keeps the stored columns that exist, in canonical order', () => {
    expect(sanitizeStoredColumns(['volume', 'name'], VALID, DEFAULTS)).toEqual(['name', 'volume'])
  })

  it('drops unknown keys, repeated keys and entries that are not strings', () => {
    expect(sanitizeStoredColumns(['name', 'ghost', 'name', 7, null, 'close'], VALID, DEFAULTS)).toEqual(['name', 'close'])
  })

  it('falls back to the defaults when the raw value is not an array', () => {
    expect(sanitizeStoredColumns(null, VALID, DEFAULTS)).toEqual(['name', 'close', 'change', 'volume'])
    expect(sanitizeStoredColumns('"name"', VALID, DEFAULTS)).toEqual(['name', 'close', 'change', 'volume'])
    expect(sanitizeStoredColumns(42, VALID, DEFAULTS)).toEqual(['name', 'close', 'change', 'volume'])
  })

  it('falls back to the defaults when no column survives the filter', () => {
    expect(sanitizeStoredColumns([], VALID, DEFAULTS)).toEqual(['name', 'close', 'change', 'volume'])
    expect(sanitizeStoredColumns(['ghost', 3], VALID, DEFAULTS)).toEqual(['name', 'close', 'change', 'volume'])
  })

  it('ignores fallback keys that are not valid columns', () => {
    expect(sanitizeStoredColumns(null, VALID, ['close', 'ghost'])).toEqual(['close'])
  })
})
