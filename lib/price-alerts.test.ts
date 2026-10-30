import { describe, expect, it } from 'vitest'
import { evaluateAlerts, MAX_ALERTS, parseStoredAlerts, removeFired, upsert, type PriceAlert } from './price-alerts'

function alert(overrides: Partial<PriceAlert> = {}): PriceAlert {
  return { id: 'a1', symbol: 'BTCUSD', above: true, price: 70_000, createdAt: 1_000, ...overrides }
}

describe('parseStoredAlerts', () => {
  it('keeps the valid alerts, in order, when the payload is already an array', () => {
    const first = alert()
    const second = alert({ id: 'a2', symbol: 'ETHUSD', above: false, price: 3_500, createdAt: 2_000 })
    expect(parseStoredAlerts([first, second])).toEqual([first, second])
  })

  it('parses the JSON string as it comes from localStorage', () => {
    expect(parseStoredAlerts(JSON.stringify([alert()]))).toEqual([alert()])
  })

  it('returns [] when the payload is corrupt or not an array', () => {
    expect(parseStoredAlerts('{corrupt')).toEqual([])
    expect(parseStoredAlerts('{"a":1}')).toEqual([])
    expect(parseStoredAlerts('null')).toEqual([])
    expect(parseStoredAlerts(null)).toEqual([])
    expect(parseStoredAlerts(undefined)).toEqual([])
    expect(parseStoredAlerts(42)).toEqual([])
    expect(parseStoredAlerts({})).toEqual([])
  })

  it('drops entries that are not objects or miss required fields', () => {
    const kept = alert()
    const stored = ['junk', null, 42, { id: 'a2', symbol: 'ETHUSD', above: false, createdAt: 3 }, kept]
    expect(parseStoredAlerts(stored)).toEqual([kept])
  })

  it('drops entries whose fields have the wrong type or a price that is not positive', () => {
    const kept = alert()
    const stored = [
      alert({ id: 7 as unknown as string }),
      alert({ symbol: '' }),
      alert({ symbol: 42 as unknown as string }),
      alert({ above: 'up' as unknown as boolean }),
      alert({ price: 0 }),
      alert({ price: -5 }),
      alert({ price: Number.NaN }),
      alert({ price: Number.POSITIVE_INFINITY }),
      alert({ price: '70000' as unknown as number }),
      alert({ createdAt: 'yesterday' as unknown as number }),
      kept,
    ]
    expect(parseStoredAlerts(stored)).toEqual([kept])
  })

  it(`caps the list at ${MAX_ALERTS} alerts, dropping the oldest by createdAt`, () => {
    const many = Array.from({ length: MAX_ALERTS + 10 }, (_, index) => alert({ id: `a${index}`, createdAt: index }))
    const parsed = parseStoredAlerts(many)
    expect(parsed).toHaveLength(MAX_ALERTS)
    expect(parsed[0]?.createdAt).toBe(10)
    expect(parsed[parsed.length - 1]?.createdAt).toBe(MAX_ALERTS + 9)
  })
})

describe('evaluateAlerts', () => {
  it('returns the above alerts whose threshold the close has reached (equality included)', () => {
    const crossed = alert({ price: 70_000 })
    expect(evaluateAlerts([crossed], { BTCUSD: 70_000 })).toEqual([crossed])
    expect(evaluateAlerts([crossed], { BTCUSD: 71_500 })).toEqual([crossed])
  })

  it('leaves above alerts alone while the close stays under the threshold', () => {
    expect(evaluateAlerts([alert({ above: true, price: 70_000 })], { BTCUSD: 69_999 })).toEqual([])
  })

  it('returns the below alerts whose threshold the close has reached (equality included)', () => {
    const crossed = alert({ above: false, price: 65_000 })
    expect(evaluateAlerts([crossed], { BTCUSD: 65_000 })).toEqual([crossed])
    expect(evaluateAlerts([crossed], { BTCUSD: 64_200 })).toEqual([crossed])
  })

  it('leaves below alerts alone while the close stays over the threshold', () => {
    expect(evaluateAlerts([alert({ above: false, price: 65_000 })], { BTCUSD: 65_001 })).toEqual([])
  })

  it('ignores symbols that have no quote in this batch', () => {
    expect(evaluateAlerts([alert({ symbol: 'ETHUSD' })], { BTCUSD: 99_999 })).toEqual([])
    expect(evaluateAlerts([alert()], {})).toEqual([])
  })

  it('never fires against a quote that is not a finite number', () => {
    expect(evaluateAlerts([alert({ above: false, price: 70_000 })], { BTCUSD: Number.NaN })).toEqual([])
    expect(evaluateAlerts([alert({ above: true, price: 70_000 })], { BTCUSD: Number.POSITIVE_INFINITY })).toEqual([])
  })

  it('evaluates each alert only against its own symbol', () => {
    const btc = alert({ id: 'a1', symbol: 'BTCUSD', price: 70_000 })
    const eth = alert({ id: 'a2', symbol: 'ETHUSD', above: false, price: 3_500 })
    expect(evaluateAlerts([btc, eth], { BTCUSD: 70_500 })).toEqual([btc])
    expect(evaluateAlerts([btc, eth], { BTCUSD: 70_500, ETHUSD: 3_400 })).toEqual([btc, eth])
  })

  it('returns [] when there is nothing to evaluate', () => {
    expect(evaluateAlerts([], { BTCUSD: 70_000 })).toEqual([])
  })
})

describe('removeFired', () => {
  it('removes the fired alerts by identity and keeps the rest, without mutating the input', () => {
    const keep = alert({ id: 'a1' })
    const fired = alert({ id: 'a2', symbol: 'ETHUSD', createdAt: 2_000 })
    const alerts = [keep, fired]

    const next = removeFired(alerts, [fired])

    expect(next).toEqual([keep])
    expect(next).not.toBe(alerts)
    expect(alerts).toHaveLength(2)
  })

  it('ignores fired ids that are not in the list', () => {
    const keep = alert({ id: 'a1' })
    const stranger = alert({ id: 'ghost' })
    expect(removeFired([keep], [stranger])).toEqual([keep])
    expect(removeFired([keep], [])).toEqual([keep])
  })

  it('can empty the list when every alert fired', () => {
    const fired = alert()
    expect(removeFired([fired], [fired])).toEqual([])
  })
})

describe('upsert', () => {
  it('appends a new alert without mutating the input', () => {
    const existing = alert({ id: 'a1' })
    const created = alert({ id: 'a2', symbol: 'ETHUSD', above: false, price: 3_500, createdAt: 2_000 })
    const input = [existing]

    const next = upsert(input, created)

    expect(next).toEqual([existing, created])
    expect(next).not.toBe(input)
    expect(input).toEqual([existing])
  })

  it('replaces the alert with the same id, in place, keeping the rest untouched', () => {
    const first = alert({ id: 'a1' })
    const middle = alert({ id: 'a2', symbol: 'ETHUSD', price: 3_500, createdAt: 1_000 })
    const last = alert({ id: 'a3', symbol: 'SOLUSD', price: 150, createdAt: 1_000 })
    const edited = { ...middle, price: 3_250 }
    const input = [first, middle, last]

    const next = upsert(input, edited)

    expect(next).toEqual([first, edited, last])
    expect(next).toHaveLength(3)
    expect(input).toEqual([first, middle, last])
  })

  it(`never grows past ${MAX_ALERTS} alerts, dropping the oldest by createdAt`, () => {
    const full = Array.from({ length: MAX_ALERTS }, (_, index) => alert({ id: `a${index}`, createdAt: index }))
    const created = alert({ id: 'newest', createdAt: MAX_ALERTS })

    const next = upsert(full, created)

    expect(next).toHaveLength(MAX_ALERTS)
    expect(next[next.length - 1]).toEqual(created)
    expect(next.some((candidate) => candidate.id === 'a0')).toBe(false)
    expect(next.some((candidate) => candidate.id === 'a1')).toBe(true)
  })

  it('keeps the cap when the id being upserted already exists in a full list', () => {
    const full = Array.from({ length: MAX_ALERTS }, (_, index) => alert({ id: `a${index}`, createdAt: index }))
    const edited = { ...full[0], price: 1 }

    const next = upsert(full, edited)

    expect(next).toHaveLength(MAX_ALERTS)
    expect(next.filter((candidate) => candidate.id === 'a0')).toEqual([edited])
  })
})
