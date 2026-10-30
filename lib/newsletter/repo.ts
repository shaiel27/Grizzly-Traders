import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NewSubscriber, SubscriberPatch, SubscriberRecord, SubscriberRepo } from './subscribe'

// Cliente con la llave de servicio. Solo existe en el servidor: la tabla de suscriptores no tiene
// políticas públicas, así que ni siquiera con la llave anónima se puede leer ni escribir desde el navegador.
export function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

const COLUMNS =
  'id,email,status,locale,consented_at,consent_text,source_url,ip_hash,token_hash,token_purpose,token_expires_at,token_sent_at,confirmed_at,unsubscribed_at'

export class RepoError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message)
    this.name = 'RepoError'
  }
}

// Tabla ausente: la migración 0007 todavía no se aplicó
export function isMissingTable(error: unknown): boolean {
  return error instanceof RepoError && (error.code === '42P01' || error.code === 'PGRST205')
}

export function createSubscriberRepo(client: SupabaseClient): SubscriberRepo {
  const table = () => client.from('subscribers')

  return {
    async findByEmail(email) {
      // La migración 0007 pasa los correos existentes a minúsculas y el alta los guarda así: se compara con igualdad
      // exacta (un `ilike` trataría "_" y "%" del correo como comodines y podría coincidir con otra persona)
      const { data, error } = await table().select(COLUMNS).eq('email', email).maybeSingle()
      if (error) throw new RepoError(error.message, error.code)
      return (data as SubscriberRecord | null) ?? null
    },

    async findByTokenHash(hash) {
      const { data, error } = await table().select(COLUMNS).eq('token_hash', hash).maybeSingle()
      if (error) throw new RepoError(error.message, error.code)
      return (data as SubscriberRecord | null) ?? null
    },

    async insert(row: NewSubscriber) {
      const { error } = await table().insert(row)
      if (!error) return 'inserted'
      // Índice único sobre lower(email): otra petición ganó la carrera
      if (error.code === '23505') return 'duplicate'
      throw new RepoError(error.message, error.code)
    },

    async update(id: string, patch: SubscriberPatch) {
      const { error } = await table()
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new RepoError(error.message, error.code)
    },
  }
}
