// Pure logic used by scripts/translate-posts.mjs, split out so it can be unit-tested
// (scripts/translate-posts.test.ts) without touching the network or Supabase.

// --- Slugs -----------------------------------------------------------------

// Mirrors the kind of slug the n8n pipeline already produces for `posts.slug`:
// lowercase, accents stripped, non-alphanumeric runs collapsed to a single dash.
export function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (á -> a, ñ -> n, ...)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// `posts_translations` has a `unique (locale, slug)` constraint. `slugExists(candidate)`
// is an injected async check (normally a Supabase lookup) so this stays testable in
// isolation: keep appending -2, -3, ... until we land on a free slug.
export async function generateUniqueSlug(baseSlug, slugExists) {
  let candidate = baseSlug
  let suffix = 2
  while (await slugExists(candidate)) {
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }
  return candidate
}

// --- HTML text-node translation ---------------------------------------------

// Splits an HTML string into alternating tag / text segments. Tag segments (anything
// matching `<...>`) are returned verbatim so a translation pass never has to touch
// markup; only the text segments between tags are candidates for translation.
export function splitHtmlTextNodes(html) {
  const segments = []
  const tagRegex = /<[^>]*>/g
  let lastIndex = 0
  let match
  while ((match = tagRegex.exec(html))) {
    if (match.index > lastIndex) segments.push({ text: html.slice(lastIndex, match.index), isTag: false })
    segments.push({ text: match[0], isTag: true })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < html.length) segments.push({ text: html.slice(lastIndex), isTag: false })
  return segments
}

export function joinHtmlTextNodes(segments) {
  return segments.map((segment) => segment.text).join('')
}

// Translates only the text nodes of an HTML document, leaving every tag byte-for-byte
// untouched. `translateText(text)` is an injected async function (the real one calls an
// LLM; tests can pass a trivial mock) so this function itself needs no network access.
// Leading/trailing whitespace of each text node is preserved exactly rather than sent to
// the translator, since whitespace-only differences are not meaningful to translate and
// matter for HTML layout (e.g. the space between an open tag and inline text).
export async function translateHtmlNodes(html, translateText) {
  const segments = splitHtmlTextNodes(html)
  const translated = await Promise.all(
    segments.map(async (segment) => {
      if (segment.isTag) return segment.text
      const leading = segment.text.match(/^\s*/)[0]
      const trailing = segment.text.match(/\s*$/)[0]
      const core = segment.text.slice(leading.length, segment.text.length - trailing.length)
      if (!core) return segment.text // whitespace-only node, nothing to translate
      return leading + (await translateText(core)) + trailing
    })
  )
  return joinHtmlTextNodes(translated.map((text) => ({ text, isTag: false })))
}
