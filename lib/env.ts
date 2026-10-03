import { z } from 'zod'

const emailList = z.string().refine(
  (value) =>
    value
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean)
      .every((email) => z.email().safeParse(email).success),
  'must be a comma-separated list of valid emails'
)

const optionalText = z.string().min(1).optional()

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: optionalText,
  CMS_ALLOWED_EMAILS: emailList.optional(),
  FINNHUB_API_KEY: optionalText,
  N8N_MCP_TOKEN: optionalText,
  N8N_MCP_URL: z.url().optional(),
  N8N_WORKFLOW_ID: optionalText,
  N8N_API_KEY: optionalText,
  NEXT_PUBLIC_VIP_URL: z.url().optional(),
  NEXT_PUBLIC_TELEGRAM_URL: z.url().optional(),
})

export type Env = z.infer<typeof schema>

type Source = Record<string, string | undefined>

// `KEY=` in a .env file yields an empty string, which should behave like an unset variable
function withoutEmpty(source: Source): Source {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''))
}

export function parseEnv(source: Source): { ok: true; env: Env } | { ok: false; issues: string[] } {
  const result = schema.safeParse(withoutEmpty(source))
  if (result.success) return { ok: true, env: result.data }

  return {
    ok: false,
    issues: result.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`),
  }
}

export function validateEnv(source: Source = process.env): Env {
  const result = parseEnv(source)
  if (!result.ok) {
    throw new Error(`Invalid environment configuration:\n${result.issues.map((issue) => `  - ${issue}`).join('\n')}`)
  }

  if (process.env.NODE_ENV === 'production' && !result.env.NEXT_PUBLIC_SITE_URL) {
    console.warn('NEXT_PUBLIC_SITE_URL is not set: canonical URLs, sitemap and RSS will point to http://localhost:3000')
  }

  return result.env
}
