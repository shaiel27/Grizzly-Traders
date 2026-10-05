// Backfills English rows in `posts_translations` for posts that only have Spanish
// content. The read path (lib/api.ts, lib/feed.ts) already supports an `en` locale and
// falls back to the Spanish post when no translation exists — this script is what
// actually produces those `en` rows. Nothing else in the repo writes them today: the
// n8n content pipeline only ever writes Spanish.
//
// For each post missing an `en` row in `posts_translations`, this:
//   1. translates `title` and `content_html` (HTML tags are preserved byte-for-byte;
//      only the text nodes between tags are sent to the translator)
//   2. translates `meta_title` / `meta_description` when the source post has them
//   3. slugifies the translated title and de-dupes it against the
//      `posts_translations (locale, slug)` unique constraint (appends -2, -3, ...)
//   4. inserts the new `en` row (or just prints it with --dry-run)
//
// Translation provider is picked by whichever API key is present in the environment:
// ANTHROPIC_API_KEY first, then OPENAI_API_KEY. If neither is set, a clearly-labeled
// mock translator is used instead (prefixes text with "[EN-MOCK]") so the rest of the
// pipeline — querying, slug generation, HTML preservation — can still be exercised for
// free. Swapping providers later is a one-function change: see `translate()` below.
//
// ---------------------------------------------------------------------------
// HOW TO RUN
// ---------------------------------------------------------------------------
//   Safe test, no writes, no API spend if no key is set:
//     node scripts/translate-posts.mjs --dry-run --limit 3
//
//   One real post end-to-end (writes 1 row — use this to sanity check before anything bigger):
//     node scripts/translate-posts.mjs --limit 1
//
//   Full backfill (ALL posts missing an `en` translation):
//     node scripts/translate-posts.mjs --limit 100000
//   NOTE: --limit defaults to 5 for safety. Omitting --limit does NOT mean "unbounded" —
//   it means "5". To run the full backfill, pass an explicit number that's >= the number
//   of untranslated posts (check the count with --dry-run first). This has deliberately
//   NOT been run at scale against production data yet: a full run calls the LLM once per
//   post (title + every HTML text node + meta fields), which costs real money and should
//   be a decision made separately once a provider/budget is picked.
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { generateUniqueSlug, slugify, translateHtmlNodes } from './translate-posts-core.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')

// --- CLI args ----------------------------------------------------------------

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitIndex = args.indexOf('--limit')
const DEFAULT_LIMIT = 5 // deliberately small: each run costs real LLM API money
const limit = limitIndex !== -1 ? Number.parseInt(args[limitIndex + 1], 10) : DEFAULT_LIMIT
if (!Number.isInteger(limit) || limit <= 0) {
  console.error(`--limit must be a positive integer, got: ${args[limitIndex + 1]}`)
  process.exit(1)
}

// --- Env (.env.local isn't auto-loaded for a plain `node` invocation like Next.js does) --

async function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local')
  let contents
  try {
    contents = await readFile(envPath, 'utf8')
  } catch {
    return // no .env.local in this environment; rely on whatever is already in process.env
  }
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

await loadEnvLocal()

// --- Supabase client (service role: must read drafts and write posts_translations,
// bypassing RLS — same construction pattern as lib/supabase/admin.ts's editor client) ---

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Set them in .env.local or the environment before running this script.'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// --- Translation provider (pluggable) -----------------------------------------

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

function systemPromptFor(html) {
  const base = 'You are a professional financial journalist translator. Translate the given text from Spanish to English, keeping the same tone and meaning. Respond with ONLY the translated text — no preamble, no quotes, no explanation.'
  if (!html) return base
  return (
    base +
    ' The text may contain HTML entities (such as &nbsp; or &amp;) — preserve those exactly, character for character, and only translate the surrounding human-readable words.'
  )
}

async function translateViaAnthropic(text, { html, apiKey }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: systemPromptFor(html),
      messages: [{ role: 'user', content: text }],
    }),
  })
  if (!response.ok) throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`)
  const data = await response.json()
  return (data.content?.[0]?.text ?? '').trim()
}

async function translateViaOpenAI(text, { html, apiKey }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPromptFor(html) },
        { role: 'user', content: text },
      ],
    }),
  })
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`)
  const data = await response.json()
  return (data.choices?.[0]?.message?.content ?? '').trim()
}

let mockWarningPrinted = false
async function translateViaMock(text) {
  if (!mockWarningPrinted) {
    console.warn(
      'WARNING: no ANTHROPIC_API_KEY or OPENAI_API_KEY found. Using a MOCK translator ' +
        '(output is prefixed with "[EN-MOCK]" and is NOT a real translation).'
    )
    mockWarningPrinted = true
  }
  return `[EN-MOCK] ${text}`
}

// Tiny pluggable abstraction: swapping providers later is changing this one function.
function createTranslator() {
  if (process.env.ANTHROPIC_API_KEY) {
    console.log(`Translation provider: Anthropic (${ANTHROPIC_MODEL})`)
    const apiKey = process.env.ANTHROPIC_API_KEY
    return (text, { html = false } = {}) => translateViaAnthropic(text, { html, apiKey })
  }
  if (process.env.OPENAI_API_KEY) {
    console.log(`Translation provider: OpenAI (${OPENAI_MODEL})`)
    const apiKey = process.env.OPENAI_API_KEY
    return (text, { html = false } = {}) => translateViaOpenAI(text, { html, apiKey })
  }
  return (text) => translateViaMock(text)
}

const translate = createTranslator()

// --- Main ----------------------------------------------------------------------

async function postsMissingEnglishTranslation(max) {
  const { data: translatedRows, error: translatedError } = await supabase
    .from('posts_translations')
    .select('post_id')
    .eq('locale', 'en')
  if (translatedError) throw translatedError

  const excludeIds = (translatedRows ?? []).map((row) => row.post_id)

  let query = supabase
    .from('posts')
    .select('id, title, slug, content_html, meta_title, meta_description')
    .order('created_at', { ascending: true })
    .limit(max)

  if (excludeIds.length > 0) query = query.not('id', 'in', `(${excludeIds.join(',')})`)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// Slugs chosen earlier in this same run haven't been inserted yet in --dry-run mode (and
// inserts happen one at a time anyway), so track them locally as well as checking the DB.
const slugsReservedThisRun = new Set()

async function slugExists(candidate) {
  if (slugsReservedThisRun.has(candidate)) return true
  const { data, error } = await supabase
    .from('posts_translations')
    .select('id')
    .eq('locale', 'en')
    .eq('slug', candidate)
    .maybeSingle()
  if (error) throw error
  return data !== null
}

async function translatePost(post) {
  const title = await translate(post.title, { html: false })
  const content_html = await translateHtmlNodes(post.content_html, (text) => translate(text, { html: true }))
  const meta_title = post.meta_title ? await translate(post.meta_title, { html: false }) : null
  const meta_description = post.meta_description ? await translate(post.meta_description, { html: false }) : null

  const baseSlug = slugify(title)
  const slug = await generateUniqueSlug(baseSlug, slugExists)
  slugsReservedThisRun.add(slug)

  return { post_id: post.id, locale: 'en', title, slug, content_html, meta_title, meta_description }
}

async function main() {
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE (will insert into posts_translations)'}, limit: ${limit}`)

  const posts = await postsMissingEnglishTranslation(limit)
  if (posts.length === 0) {
    console.log('No posts are missing an English translation. Nothing to do.')
    return
  }
  console.log(`Found ${posts.length} post(s) to translate.\n`)

  let okCount = 0
  let failCount = 0

  for (const [index, post] of posts.entries()) {
    const label = `[${index + 1}/${posts.length}] "${post.title}" (${post.id})`
    try {
      const row = await translatePost(post)
      if (dryRun) {
        console.log(`${label} -> slug "${row.slug}" [DRY RUN, not written]`)
      } else {
        const { error } = await supabase.from('posts_translations').insert(row)
        if (error) throw error
        console.log(`${label} -> slug "${row.slug}" [INSERTED]`)
      }
      okCount += 1
    } catch (error) {
      console.error(`${label} -> FAILED: ${error instanceof Error ? error.message : String(error)}`)
      failCount += 1
    }
  }

  console.log(`\nDone. ${okCount} succeeded, ${failCount} failed.`)
  if (failCount > 0) process.exitCode = 1
}

await main()
