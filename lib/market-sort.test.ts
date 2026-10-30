import { describe, expect, it } from 'vitest'
import { compareByChange, compareByName } from './market-sort'

const asset = (name: string, change: number | null) => ({ name, change })

describe('compareByChange', () => {
  it('orders the biggest change first', () => {
    const list = [asset('down', -1), asset('up', 5), asset('flat', 2)]
    expect([...list].sort(compareByChange).map((a) => a.name)).toEqual(['up', 'flat', 'down'])
  })

  it('pushes NaN and null changes to the end, keeping their relative order', () => {
    const list = [asset('nan', NaN), asset('up', 3), asset('null', null), asset('down', -2)]
    expect([...list].sort(compareByChange).map((a) => a.name)).toEqual(['up', 'down', 'nan', 'null'])
  })

  it('still orders the finite values when a broken one is in the middle', () => {
    const list = [asset('up', 4), asset('broken', NaN), asset('more', 9), asset('down', -1)]
    expect([...list].sort(compareByChange).map((a) => a.name)).toEqual(['more', 'up', 'down', 'broken'])
  })
})

describe('compareByName', () => {
  it('collates with the requested locale', () => {
    const nino = asset('niño', 0)
    const nandu = asset('ñandú', 0)

    expect(compareByName(nino, nandu, 'es')).toBeLessThan(0)
    expect(compareByName(nino, nandu, 'en')).toBeGreaterThan(0)
  })

  it('puts blank names last', () => {
    const list = [asset('', 0), asset('Zeta', 0), asset('Alfa', 0)]
    expect([...list].sort((a, b) => compareByName(a, b, 'es')).map((a) => a.name)).toEqual(['Alfa', 'Zeta', ''])
  })
})
