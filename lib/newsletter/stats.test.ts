import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { getSubscriberStats } from './stats'

// Cliente falso: cada consulta de conteo anota sus filtros y responde con el número que le toque a esa combinación
function fakeClient(counts: Record<string, number>, digests: { digest_date: string; locale: string }[] = [], failOn?: string) {
  const calls: string[] = []
  const client = {
    from(table: string) {
      if (table === 'newsletter_digests') {
        const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: async () => ({ data: digests, error: null }) }
        return chain
      }
      return {
        select() {
          const filters: string[] = []
          const query = {
            eq(column: string, value: string) {
              filters.push(`${column}=${value}`)
              return query
            },
            gte(column: string) {
              filters.push(`${column}>=`)
              return query
            },
            then(resolve: (value: unknown) => unknown) {
              const key = filters.join('&')
              calls.push(key)
              return Promise.resolve(failOn === key ? { count: null, error: { message: 'boom', code: 'X' } } : { count: counts[key] ?? 0, error: null }).then(resolve)
            },
          }
          return query
        },
      }
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

describe('getSubscriberStats', () => {
  it('cuenta verificados, por idioma, pendientes, bajas y altas recientes', async () => {
    const { client, calls } = fakeClient(
      { 'status=confirmed': 12, 'status=confirmed&locale=es': 9, 'status=confirmed&locale=en': 3, 'status=pending': 4, 'status=unsubscribed': 2, 'status=confirmed&confirmed_at>=': 5 },
      [
        { digest_date: '2026-10-30', locale: 'es' },
        { digest_date: '2026-10-30', locale: 'en' },
      ]
    )
    const stats = await getSubscriberStats(client, new Date('2026-10-31T12:00:00Z'))
    expect(stats.verified).toBe(12)
    expect(stats.verifiedByLocale).toEqual({ es: 9, en: 3 })
    expect(stats.pending).toBe(4)
    expect(stats.unsubscribed).toBe(2)
    expect(stats.verifiedLast7Days).toBe(5)
    expect(stats.verifiedLast30Days).toBe(5)
    expect(stats.lastDigest).toEqual({ date: '2026-10-30', locales: ['es', 'en'] })
    expect(stats.generatedAt).toBe('2026-10-31T12:00:00.000Z')
    expect(calls).toHaveLength(7)
  })

  it('sin envíos todavía no hay último resumen', async () => {
    const { client } = fakeClient({})
    expect((await getSubscriberStats(client)).lastDigest).toBeNull()
  })

  it('un error de la base de datos se propaga', async () => {
    const { client } = fakeClient({}, [], 'status=pending')
    await expect(getSubscriberStats(client)).rejects.toThrow('boom')
  })
})
