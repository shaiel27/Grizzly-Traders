import { describe, expect, it } from 'vitest'
import {
  aggregateCandles,
  isTimeframe,
  mergePartialTail,
  normalizeCandles,
  parseYahooCandles,
  TIMEFRAMES,
  TIMEFRAME_KEYS,
  type Candle,
} from './candles'
import { ema, sma, toLinePoints } from './indicators'

describe('sma', () => {
  it('averages the last N values and leaves the warm-up empty', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4])
  })

  it('returns only nulls when there is not enough data', () => {
    expect(sma([1, 2], 3)).toEqual([null, null])
    expect(sma([], 3)).toEqual([])
  })

  it('handles a period of 1 as the values themselves', () => {
    expect(sma([4, 5, 6], 1)).toEqual([4, 5, 6])
  })
})

describe('ema', () => {
  it('seeds with the simple average and then weights recent values more', () => {
    const result = ema([1, 2, 3, 4, 5], 3)
    expect(result.slice(0, 2)).toEqual([null, null])
    expect(result[2]).toBe(2)
    // k = 0.5: 4 * 0.5 + 2 * 0.5 = 3, then 5 * 0.5 + 3 * 0.5 = 4
    expect(result[3]).toBe(3)
    expect(result[4]).toBe(4)
  })

  it('returns only nulls when there is not enough data', () => {
    expect(ema([1, 2], 5)).toEqual([null, null])
  })
})

describe('toLinePoints', () => {
  it('pairs values with candle times and skips the warm-up', () => {
    const candles = [10, 20, 30].map((time) => ({ time, open: 1, high: 1, low: 1, close: 1 }))
    expect(toLinePoints(candles, [null, 5, 6])).toEqual([
      { time: 20, value: 5 },
      { time: 30, value: 6 },
    ])
  })
})

const candle = (time: number, open: number, high: number, low: number, close: number, volume?: number): Candle => ({
  time,
  open,
  high,
  low,
  close,
  ...(volume === undefined ? {} : { volume }),
})

describe('aggregateCandles', () => {
  it('merges candles that fall in the same bucket', () => {
    const hourly = [candle(0, 10, 12, 9, 11, 100), candle(3600, 11, 15, 10, 14, 50), candle(7200, 14, 14, 8, 9, 25), candle(14400, 9, 10, 9, 10, 5)]
    const result = aggregateCandles(hourly, 14400)
    expect(result).toEqual([candle(0, 10, 15, 8, 9, 175), candle(14400, 9, 10, 9, 10, 5)])
  })

  it('does not mutate the input and keeps candles without volume', () => {
    const input = [candle(0, 1, 2, 1, 2), candle(60, 2, 3, 2, 3)]
    const snapshot = JSON.stringify(input)
    expect(aggregateCandles(input, 3600)).toEqual([candle(0, 1, 3, 1, 3)])
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

describe('normalizeCandles', () => {
  it('sorts by time and keeps the last candle of a repeated timestamp', () => {
    const result = normalizeCandles([candle(30, 3, 3, 3, 3), candle(10, 1, 1, 1, 1), candle(20, 2, 2, 2, 2), candle(20, 9, 9, 9, 9)])
    expect(result.map((item) => item.time)).toEqual([10, 20, 30])
    expect(result[1].open).toBe(9)
  })
})

describe('mergePartialTail', () => {
  const DAY = 86_400

  it('folds the "now" bar Yahoo adds to monthly data into the real month', () => {
    const september = candle(0, 78_540, 82_262, 74_945, 81_234, 536)
    const nowBar = candle(20 * DAY, 81_162, 87_281, 80_933, 86_608, 54)
    const result = mergePartialTail([candle(-31 * DAY, 1, 2, 1, 2), september, nowBar], 27 * DAY)
    expect(result).toHaveLength(2)
    expect(result[1]).toEqual({ time: 0, open: 78_540, high: 87_281, low: 74_945, close: 86_608, volume: 536 })
  })

  it('leaves a properly spaced last candle alone', () => {
    const candles = [candle(0, 1, 2, 1, 2), candle(30 * DAY, 2, 3, 2, 3)]
    expect(mergePartialTail(candles, 27 * DAY)).toEqual(candles)
  })

  it('handles too few candles', () => {
    expect(mergePartialTail([], DAY)).toEqual([])
    expect(mergePartialTail([candle(0, 1, 1, 1, 1)], DAY)).toHaveLength(1)
  })

  it('is enabled only for weekly and monthly timeframes', () => {
    expect(TIMEFRAMES['1w'].minGapSeconds).toBeGreaterThan(0)
    expect(TIMEFRAMES['1mo'].minGapSeconds).toBeGreaterThan(0)
    expect('minGapSeconds' in TIMEFRAMES['1d']).toBe(false)
  })
})

describe('parseYahooCandles', () => {
  it('keeps volume only when it is positive and rebuilds candles with a missing open', () => {
    const payload = {
      chart: {
        result: [
          {
            timestamp: [1, 2, 3],
            indicators: {
              quote: [
                {
                  open: [1, 0, 3],
                  high: [2, 0, 4],
                  low: [1, 0, 3],
                  close: [2, 5, 4],
                  volume: [10, 5, 0],
                },
              ],
            },
          },
        ],
      },
    }
    // The middle candle arrives with open, high and low at 0 (a live index bar): they are rebuilt from the close
    expect(parseYahooCandles(payload)).toEqual([candle(1, 1, 2, 1, 2, 10), candle(2, 5, 5, 5, 5, 5), candle(3, 3, 4, 3, 4)])
  })

  it('skips candles without a usable close', () => {
    const payload = { chart: { result: [{ timestamp: [1, 2], indicators: { quote: [{ open: [1, 1], high: [1, 1], low: [1, 1], close: [null, 0] }] } }] } }
    expect(parseYahooCandles(payload)).toEqual([])
  })
})

describe('timeframes', () => {
  it('has a spec for every key and recognises only those keys', () => {
    expect(TIMEFRAME_KEYS).toEqual(['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1mo'])
    expect(TIMEFRAME_KEYS.every(isTimeframe)).toBe(true)
    expect(isTimeframe('1M')).toBe(false)
    expect(isTimeframe('toString')).toBe(false)
  })

  it('builds 4-hour candles from hourly ones', () => {
    expect(TIMEFRAMES['4h'].interval).toBe('60m')
    expect(TIMEFRAMES['4h'].aggregateSeconds).toBe(14400)
  })

  it('stays inside the history Yahoo serves for each candle size', () => {
    // 1m: 7 days, 5m/15m: 60 days, hourly: 730 days
    expect(TIMEFRAMES['1m'].range).toBe('1d')
    expect(['1d', '5d']).toContain(TIMEFRAMES['5m'].range)
    expect(TIMEFRAMES['15m'].range).toBe('1mo')
    expect(['1mo', '3mo', '6mo', '1y', '2y']).toContain(TIMEFRAMES['1h'].range)
  })
})
