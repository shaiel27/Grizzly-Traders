import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: <T,>(fn: T) => fn }))

import { loadBatches, parseDelayMinutes } from './markets'

interface Batch {
  symbol: string
}

interface Item {
  symbol: string
  price: number
}

const batches: Batch[][] = [
  [{ symbol: 'A' }, { symbol: 'B' }],
  [{ symbol: 'C' }],
]

const answer = (batch: Batch[]): Item[] => batch.map((asset, index) => ({ symbol: asset.symbol, price: index }))
const symbols = (items: Item[]) => items.map((item) => item.symbol)

describe('loadBatches', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns every batch in catalog order when the scanner answers in full', async () => {
    const fetchBatch = vi.fn(async (batch: Batch[]) => answer(batch))

    const result = await loadBatches(batches, fetchBatch, 0)

    expect(symbols(result)).toEqual(['A', 'B', 'C'])
    expect(fetchBatch).toHaveBeenCalledTimes(2)
    expect(console.error).not.toHaveBeenCalled()
  })

  it('retries a rejected batch once and succeeds', async () => {
    let failures = 0
    const fetchBatch = vi.fn(async (batch: Batch[]) => {
      if (batch[0].symbol === 'C' && failures++ < 1) throw new Error('scanner down')
      return answer(batch)
    })

    const result = await loadBatches(batches, fetchBatch, 0)

    expect(symbols(result)).toEqual(['A', 'B', 'C'])
    expect(fetchBatch).toHaveBeenCalledTimes(3)
  })

  it('throws instead of returning a partial table when the batch keeps failing', async () => {
    const fetchBatch = vi.fn(async (batch: Batch[]) => {
      if (batch[0].symbol === 'C') throw new Error('scanner down')
      return answer(batch)
    })

    await expect(loadBatches(batches, fetchBatch, 0)).rejects.toThrow(/1\/3/)
    expect(fetchBatch).toHaveBeenCalledTimes(3)
    expect(console.error).toHaveBeenCalled()
  })

  it('counts rows the scanner dropped as missing coverage and throws', async () => {
    const fetchBatch = vi.fn(async (batch: Batch[]) => answer(batch.filter((asset) => asset.symbol !== 'B')))

    await expect(loadBatches(batches, fetchBatch, 0)).rejects.toThrow(/1\/3/)
    expect(fetchBatch).toHaveBeenCalledTimes(3)
  })

  it('recovers a batch the scanner answered only partially', async () => {
    let calls = 0
    const fetchBatch = vi.fn(async (batch: Batch[]) => {
      calls += 1
      return answer(calls === 1 ? batch.filter((asset) => asset.symbol !== 'B') : batch)
    })

    const result = await loadBatches(batches, fetchBatch, 0)

    expect(symbols(result)).toEqual(['A', 'B', 'C'])
  })

  it('keeps a successful batch while another one is retried', async () => {
    const seen: string[][] = []
    const fetchBatch = vi.fn(async (batch: Batch[]) => {
      seen.push(batch.map((asset) => asset.symbol))
      if (batch[0].symbol === 'C' && seen.length < 3) throw new Error('scanner down')
      return answer(batch)
    })

    const result = await loadBatches(batches, fetchBatch, 0)

    expect(symbols(result)).toEqual(['A', 'B', 'C'])
    expect(seen).toEqual([
      ['A', 'B'],
      ['C'],
      ['C'],
    ])
  })
})

describe('parseDelayMinutes', () => {
  it('convierte delayed_streaming_N (segundos) a minutos', () => {
    expect(parseDelayMinutes('delayed_streaming_600')).toBe(10)
    expect(parseDelayMinutes('delayed_streaming_900')).toBe(15)
  })

  it('devuelve null para tiempo real y valores desconocidos', () => {
    expect(parseDelayMinutes('streaming')).toBeNull()
    expect(parseDelayMinutes('delayed_streaming_0')).toBeNull()
    expect(parseDelayMinutes('delayed_streaming_abc')).toBeNull()
    expect(parseDelayMinutes('')).toBeNull()
    expect(parseDelayMinutes(undefined)).toBeNull()
    expect(parseDelayMinutes(600)).toBeNull()
  })
})
