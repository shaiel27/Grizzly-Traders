import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'

// Server-only client for editor writes. Uses the service role key when configured;
// otherwise falls back to the signed-in editor's session (RLS policies then apply).
export async function createEditorClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (serviceKey) {
    return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  return createSessionClient()
}
