import { describe, expect, it } from 'vitest'
import {
  aggregateCandles,
  collapsePhantomTail,
  isTimeframe,
  mergePartialTail,
  normalizeCandles,
  parseYahooCandles,
  TIMEFRAMES,
  TIMEFRAME_KEYS,
  type Candle,
} from './candles'
import { ema, macd, rsi, sma, toLinePoints } from './indicators'

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

describe('rsi', () => {
  it('averages gains and losses with Wilder smoothing and leaves the warm-up empty', () => {
    // changes: +1, -1, +1, -1. Seed (i=1..2): gains=1, losses=1 → avgGain=0.5, avgLoss=0.5 → RS=1 → 50
    // i=3 (+1): avgGain=0.75, avgLoss=0.25 → RS=3 → 75
    // i=4 (-1): avgGain=0.375, avgLoss=0.625 → RS=0.6 → 37.5 (Wilder, not SMA of the window)
    expect(rsi([1, 2, 1, 2, 1], 2)).toEqual([null, null, 50, 75, 37.5])
  })

  it('returns only nulls when there is not enough data', () => {
    expect(rsi([1, 2], 14)).toEqual([null, null])
    expect(rsi([], 14)).toEqual([])
  })

  it('pins to 100 without losses (rising or flat) and 0 without gains (falling)', () => {
    expect(rsi([1, 2, 3, 4, 5, 6], 2)).toEqual([null, null, 100, 100, 100, 100])
    expect(rsi([6, 5, 4, 3, 2, 1], 2)).toEqual([null, null, 0, 0, 0, 0])
    expect(rsi([5, 5, 5, 5], 2)).toEqual([null, null, 100, 100])
  })

  it('defaults to a 14-period lookback', () => {
    const values = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i) * 5)
    const result = rsi(values)
    expect(result.slice(0, 14)).toEqual(new Array(14).fill(null))
    expect(result[14]).not.toBeNull()
  })
})

describe('macd', () => {
  it('returns only nulls when there is not enough data for the slow EMA', () => {
    const result = macd([1, 2, 3])
    expect(result.macd).toEqual([null, null, null])
    expect(result.signal).toEqual([null, null, null])
    expect(result.histogram).toEqual([null, null, null])
    expect(macd([]).macd).toEqual([])
  })

  it('subtracts the 26 EMA from the 12 EMA and starts where the slow EMA starts', () => {
    const values = Array.from({ length: 40 }, (_, i) => 50 + Math.sin(i / 3) * 4 + i * 0.05)
    const fast = ema(values, 12)
    const slow = ema(values, 26)
    const { macd: line } = macd(values)
    expect(line.slice(0, 25)).toEqual(new Array(25).fill(null))
    for (let i = 25; i < values.length; i++) {
      expect(line[i]).toBeCloseTo((fast[i] as number) - (slow[i] as number), 10)
    }
  })

  it('smooths the signal line with a 9 EMA of the macd line', () => {
    const values = Array.from({ length: 50 }, (_, i) => 100 + Math.cos(i / 4) * 3)
    const { macd: line, signal } = macd(values)
    const compact = line.filter((value): value is number => value !== null)
    const compactSignal = ema(compact, 9)
    expect(signal.slice(0, 33)).toEqual(new Array(33).fill(null))
    expect(signal[33]).toBeCloseTo(compactSignal[8] as number, 10)
    expect(signal[49]).toBeCloseTo(compactSignal[24] as number, 10)
  })

  it('mirrors macd minus signal in the histogram', () => {
    const values = Array.from({ length: 45 }, (_, i) => 20 + Math.sin(i / 2) * 2)
    const { macd: line, signal, histogram } = macd(values)
    for (let i = 0; i < values.length; i++) {
      if (line[i] === null || signal[i] === null) expect(histogram[i]).toBeNull()
      else expect(histogram[i]).toBeCloseTo((line[i] as number) - (signal[i] as number), 10)
    }
  })

  it('stays flat at zero on a constant series', () => {
    const { macd: line, signal, histogram } = macd(new Array(40).fill(10))
    expect(line.slice(25).every((value) => value === 0)).toBe(true)
    expect(signal.slice(33).every((value) => value === 0)).toBe(true)
    expect(histogram.slice(33).every((value) => value === 0)).toBe(true)
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

  it('keeps UTC-midnight buckets when the offset is 0', () => {
    const atHalfPast = [candle(1_800, 10, 12, 9, 11, 100), candle(5_400, 11, 15, 10, 14, 50)]
    expect(aggregateCandles(atHalfPast, 14_400, 0)).toEqual([candle(0, 10, 15, 9, 14, 150)])
  })

  it('aligns buckets to a session offset so bars keep the series stamp', () => {
    // Hourly session bars stamped at :30 (US stocks open at 9:30 local)
    const hourly = [
      candle(1_800, 10, 12, 9, 11, 100),
      candle(5_400, 11, 15, 10, 14, 50),
      candle(9_000, 14, 14, 8, 9, 25),
      candle(12_600, 9, 10, 9, 10, 5),
      candle(16_200, 10, 11, 10, 11, 10),
    ]
    const result = aggregateCandles(hourly, 14_400, 1_800)
    // 4h buckets start at :30 (1800, 16200...), never at UTC midnight (0, 14400...)
    expect(result).toEqual([candle(1_800, 10, 15, 8, 10, 180), candle(16_200, 10, 11, 10, 11, 10)])
    expect(result.every((item) => item.time % 3_600 === 1_800)).toBe(true)
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
  const utc = (year: number, month: number, day: number) => Math.floor(Date.UTC(year, month, day) / 1000)

  it('folds the "now" bar Yahoo adds to monthly data into the real month', () => {
    const september = candle(0, 78_540, 82_262, 74_945, 81_234, 536)
    const nowBar = candle(20 * DAY, 81_162, 87_281, 80_933, 86_608, 54)
    const result = mergePartialTail([candle(-31 * DAY, 1, 2, 1, 2), september, nowBar], 27 * DAY, 'month')
    expect(result).toHaveLength(2)
    expect(result[1]).toEqual({ time: 0, open: 78_540, high: 87_281, low: 74_945, close: 86_608, volume: 536 })
  })

  it('keeps the in-progress month when the previous bar is a closed month stamped at its end', () => {
    const september = candle(utc(2026, 8, 30), 1.1327, 1.1339, 1.1162, 1.1201)
    const octoberSoFar = candle(utc(2026, 9, 9), 1.1217, 1.1246, 1.1193, 1.1197)
    const result = mergePartialTail([candle(utc(2026, 7, 30), 1, 2, 1, 2), september, octoberSoFar], 27 * DAY, 'month')
    expect(result).toHaveLength(3)
    expect(result[2].time).toBe(utc(2026, 9, 9))
    expect(result[2].close).toBe(1.1197)
  })

  it('keeps the in-progress week when the previous bar is the closed week it follows', () => {
    const closedWeek = candle(utc(2026, 9, 4), 1.1255, 1.1276, 1.1162, 1.1201)
    const weekSoFar = candle(utc(2026, 9, 9), 1.1217, 1.1246, 1.1193, 1.1197)
    const result = mergePartialTail([candle(utc(2026, 8, 27), 1, 2, 1, 2), closedWeek, weekSoFar], 6 * DAY, 'week')
    expect(result).toHaveLength(3)
    expect(result[2].time).toBe(utc(2026, 9, 9))
  })

  it('folds the duplicate "now" bar into the bar of the same week', () => {
    const weekStart = candle(utc(2026, 9, 5), 51199, 51672, 50862, 51231, 1_688_880_000)
    const nowBar = candle(utc(2026, 9, 9), 51258, 51562, 51258, 51536, 145_156_557)
    const result = mergePartialTail([candle(utc(2026, 8, 28), 1, 2, 1, 2), weekStart, nowBar], 6 * DAY, 'week')
    expect(result).toHaveLength(2)
    expect(result[1]).toEqual({ time: utc(2026, 9, 5), open: 51199, high: 51672, low: 50862, close: 51536, volume: 1_688_880_000 })
  })

  it('leaves a properly spaced last candle alone', () => {
    const candles = [candle(0, 1, 2, 1, 2), candle(30 * DAY, 2, 3, 2, 3)]
    expect(mergePartialTail(candles, 27 * DAY, 'month')).toEqual(candles)
  })

  it('handles too few candles', () => {
    expect(mergePartialTail([], DAY, 'month')).toEqual([])
    expect(mergePartialTail([candle(0, 1, 1, 1, 1)], DAY, 'month')).toHaveLength(1)
  })

  it('is enabled only for weekly and monthly timeframes', () => {
    expect(TIMEFRAMES['1w'].minGapSeconds).toBeGreaterThan(0)
    expect(TIMEFRAMES['1mo'].minGapSeconds).toBeGreaterThan(0)
    expect('minGapSeconds' in TIMEFRAMES['1d']).toBe(false)
  })
})

describe('collapsePhantomTail', () => {
  const HOUR = 3600
  const utc = (year: number, month: number, day: number, hour = 0) => Math.floor(Date.UTC(year, month, day, hour) / 1000)

  it('re-stamps an unaligned doji tail into the current bucket when that bucket has no bar', () => {
    const real = candle(utc(2026, 9, 9, 9), 51200, 51300, 51100, 51250, 1000)
    const phantom = candle(utc(2026, 9, 9, 10) + 23 * 60, 51250, 51250, 51250, 51250)
    const result = collapsePhantomTail([real, phantom], HOUR)
    expect(result).toHaveLength(2)
    expect(result[1]).toEqual({ time: utc(2026, 9, 9, 10), open: 51250, high: 51250, low: 51250, close: 51250 })
  })

  it('drops the doji tail when the current bucket already has a real bar', () => {
    const real = candle(utc(2026, 9, 9, 10), 51200, 51300, 51100, 51250, 1000)
    const phantom = candle(utc(2026, 9, 9, 10) + 23 * 60, 51250, 51250, 51250, 51250)
    expect(collapsePhantomTail([real, phantom], HOUR)).toEqual([real])
  })

  it('follows the session offset of the series instead of the UTC hour', () => {
    const sessionBar = candle(utc(2026, 9, 9, 9) + 30 * 60, 333, 335, 332, 334, 1000)
    const phantom = candle(utc(2026, 9, 9, 10) + 18 * 60, 334.5, 334.5, 334.5, 334.5)
    expect(collapsePhantomTail([sessionBar, phantom], HOUR)).toEqual([sessionBar])
  })

  it('leaves an aligned doji tail alone', () => {
    const doji = candle(utc(2026, 9, 9, 10), 51250, 51250, 51250, 51250)
    expect(collapsePhantomTail([candle(utc(2026, 9, 9, 9), 1, 2, 1, 2), doji], HOUR)[1]).toBe(doji)
  })

  it('leaves a tail with real range or volume alone', () => {
    const withRange = candle(utc(2026, 9, 9, 10) + 600, 51200, 51300, 51100, 51250)
    const withVolume = candle(utc(2026, 9, 9, 10) + 600, 51250, 51250, 51250, 51250, 10)
    expect(collapsePhantomTail([withRange], HOUR)).toEqual([withRange])
    expect(collapsePhantomTail([withVolume], HOUR)).toEqual([withVolume])
  })

  it('never touches dojis that are not the last bar', () => {
    const midDoji = candle(utc(2026, 9, 9, 8) + 900, 51250, 51250, 51250, 51250)
    const last = candle(utc(2026, 9, 9, 10), 51200, 51300, 51100, 51250, 1000)
    expect(collapsePhantomTail([midDoji, last], HOUR)).toEqual([midDoji, last])
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
