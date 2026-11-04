import type { SupabaseClient } from '@supabase/supabase-js'
import { RepoError } from './repo'

// Cifras de la lista de correo para el panel del CMS. Una "persona verificada" es una fila `confirmed`: confirmó su
// correo con el enlace (doble confirmación) y es la única que recibe el resumen diario.

export interface SubscriberStats {
  verified: number
  verifiedByLocale: { es: number; en: number }
  pending: number
  unsubscribed: number
  verifiedLast7Days: number
  verifiedLast30Days: number
  // Último resumen enviado (día y idiomas enviados ese día), o null si aún no hubo ninguno
  lastDigest: { date: string; locales: string[] } | null
  generatedAt: string
}

const DAY_MS = 86_400_000

// Lo mínimo del constructor de consultas de Supabase que se usa aquí
interface Filterable extends PromiseLike<{ count: number | null; error: { message: string; code?: string } | null }> {
  eq(column: string, value: string): Filterable
  gte(column: string, value: string): Filterable
}

async function count(client: SupabaseClient, filter: (query: Filterable) => Filterable): Promise<number> {
  const query = client.from('subscribers').select('id', { count: 'exact', head: true }) as unknown as Filterable
  const { count: total, error } = await filter(query)
  if (error) throw new RepoError(error.message, error.code)
  return total ?? 0
}

export async function getSubscriberStats(client: SupabaseClient, now: Date = new Date()): Promise<SubscriberStats> {
  const since = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString()

  const [verified, es, en, pending, unsubscribed, week, month, digests] = await Promise.all([
    count(client, (q) => q.eq('status', 'confirmed')),
    count(client, (q) => q.eq('status', 'confirmed').eq('locale', 'es')),
    count(client, (q) => q.eq('status', 'confirmed').eq('locale', 'en')),
    count(client, (q) => q.eq('status', 'pending')),
    count(client, (q) => q.eq('status', 'unsubscribed')),
    count(client, (q) => q.eq('status', 'confirmed').gte('confirmed_at', since(7))),
    count(client, (q) => q.eq('status', 'confirmed').gte('confirmed_at', since(30))),
    client.from('newsletter_digests').select('digest_date,locale').eq('status', 'sent').order('digest_date', { ascending: false }).limit(2),
  ])

  if (digests.error) throw new RepoError(digests.error.message, digests.error.code)
  const rows = (digests.data ?? []) as { digest_date: string; locale: string }[]
  const lastDay = rows[0]?.digest_date
  const lastDigest = lastDay ? { date: lastDay, locales: rows.filter((row) => row.digest_date === lastDay).map((row) => row.locale) } : null

  return {
    verified,
    verifiedByLocale: { es, en },
    pending,
    unsubscribed,
    verifiedLast7Days: week,
    verifiedLast30Days: month,
    lastDigest,
    generatedAt: now.toISOString(),
  }
}
