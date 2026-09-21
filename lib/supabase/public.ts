import { createClient } from '@supabase/supabase-js'

// Cookie-less anonymous client for public reads (sitemap, feed). Does not opt the route into per-request rendering.
export function createPublicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
