# 004 — Replace the home skeleton with a terminal boot sequence

- **Status**: SUPERSEDED by [005](005-home-loading-minimal-splash.md) —
  applied exactly as specified (no drift found), but the user rejected the
  text-crawl-with-cursor look after seeing it and asked for something more
  minimal, full-screen.
- **Supersedes**: [003](003-home-skeleton-diffuse-blur.md) (and transitively
  [002](002-home-skeleton-shape-match.md)) — the user tried the blurred
  skeleton, didn't like it, and asked for a non-skeleton loading animation.
  Chosen direction (user picked from 3 previewed options): a dark terminal
  boot sequence — status lines appearing one by one with a blinking
  cursor, matching the site's "Autonomous Trader Terminal" identity.
- **Commit**: a commit containing 003's changes (not yet committed as of
  this writing — see Boundaries)
- **Severity**: N/A (direction change, not a defect fix)
- **Category**: Missed opportunities (brand-grounded loading moment) +
  Purpose & frequency (bounded, short-lived, not a frequently-fought-with
  control) + Accessibility (reduced-motion, already-global coverage)
- **Estimated scope**: 4 files — `components/ui/Loading.tsx` (revert the
  skeleton additions, add the `'terminal'` variant), `app/globals.css`
  (new keyframes), `app/(site)/loading.tsx` (pass `locale`),
  `lib/i18n/dictionaries/{es,en}.json` (new strings).

## Problem

The home route's Suspense fallback (`app/(site)/loading.tsx` →
`components/ui/Loading.tsx`'s `'home'` variant) is a skeleton. The user
tried two iterations (plain gray blocks, then a blurred/glowing version)
and rejected the whole approach, asking for a different *type* of loading
animation. Presented with three concrete, brand-grounded alternatives
(terminal boot sequence, animated logomark, thin top progress bar), they
picked the terminal boot sequence.

This is a direction change, not a bug — so this plan's "Problem" is simply:
the current `'home'` variant (`components/ui/Loading.tsx`, the whole
`if (variant === 'home') { ... }` block added by plan 003) must be removed
and replaced with a new, different kind of loading UI.

## Target

**1. `app/globals.css` — two new keyframes + two utility classes,** added
near the existing hero keyframes (same section, same conventions):

```css
@keyframes terminalLineIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes terminalBlink { 50% { opacity: 0; } }

.terminal-line { opacity: 0; animation: terminalLineIn 0.4s var(--ease-out) forwards; }
.terminal-cursor { animation: terminalBlink 1s step-end infinite; }
```

`--ease-out` (already defined, `cubic-bezier(0.23, 1, 0.32, 1)`) is reused
deliberately — this is a different context from the hero's reserved
`--ease-hero-entrance`, so it uses the project's general-purpose easing
token instead of introducing a third one. `terminalBlink` is the standard
single-keyframe blink idiom (default `ease` timing is fine here — the
50%-opacity:0 stop alone already reads as a toggle). Both animations are
covered automatically by the existing global
`@media (prefers-reduced-motion: reduce)` block (it matches `*`) — nothing
extra needed for accessibility.

**2. `components/ui/Loading.tsx` — revert plan 003's additions, add
`'terminal'`:**

- `CardSkeleton`: remove the `blurred` prop entirely, back to its
  pre-003 form (no callers will pass `blurred` once the `'home'` variant
  is gone — keeping an unused prop would be dead code):
  ```tsx
  function CardSkeleton() {
    return (
      <div className="card animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <div className="aspect-[16/10] bg-surface-2 rounded-lg mb-4" />
        <div className="flex gap-2 mb-3">
          <div className="h-5 w-20 bg-surface-2 rounded-full" />
          <div className="h-5 w-16 bg-surface-2 rounded-full" />
        </div>
        <div className="h-6 bg-surface-2 rounded w-4/5 mb-2" />
        <div className="h-4 bg-surface-2 rounded w-3/5 mb-2" />
        <div className="h-4 bg-surface-2 rounded w-2/5" />
      </div>
    )
  }
  ```
- `Bar`: remove the `style` prop (added in 003 only for the skeleton's
  stagger delays, which go away with it) and the now-unused `CSSProperties`
  import:
  ```tsx
  function Bar({ className }: { className: string }) {
    return <div className={clsx('animate-pulse motion-reduce:animate-none rounded bg-surface-2', className)} />
  }
  ```
- `LoadingProps`: change `variant` from
  `'spinner' | 'skeleton' | 'cards' | 'article' | 'home'` to
  `'spinner' | 'skeleton' | 'cards' | 'article' | 'terminal'`, and add an
  optional `locale?: Locale` prop (default `'es'`, same default pattern
  `ArticleCard` already uses):
  ```tsx
  import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'
  // ...
  interface LoadingProps {
    variant?: 'spinner' | 'skeleton' | 'cards' | 'article' | 'terminal'
    count?: number
    className?: string
    locale?: Locale
  }
  export function Loading({ variant = 'spinner', count = 3, className, locale = 'es' }: LoadingProps) {
  ```
- Delete the entire `if (variant === 'home') { ... }` block (everything
  plan 003 added) and replace it with:
  ```tsx
  if (variant === 'terminal') {
    const t = getDictionary(locale).common.loadingTerminal
    return (
      <div className={clsx('flex min-h-[70vh] w-full items-center justify-center bg-canvas px-6', className)} role="status" aria-live="polite">
        <div aria-hidden="true" className="w-full max-w-sm font-mono text-body-sm">
          <p className="mb-4 text-caption font-semibold tracking-[0.18em] text-ink">{t.brand}</p>
          <p className="terminal-line text-ink-muted" style={{ animationDelay: '150ms' }}>
            <span className="text-accent-blue">{'> '}</span>{t.line1}
          </p>
          <p className="terminal-line mt-1.5 text-ink-muted" style={{ animationDelay: '650ms' }}>
            <span className="text-accent-blue">{'> '}</span>{t.line2}
          </p>
          <p className="terminal-line mt-1.5 text-ink-muted" style={{ animationDelay: '1150ms' }}>
            <span className="text-accent-blue">{'> '}</span>
            {t.line3}
            <span className="terminal-cursor ml-1 inline-block h-[14px] w-[7px] translate-y-[2px] bg-accent-blue" />
          </p>
        </div>
        <span className="sr-only">{t.srLabel}</span>
      </div>
    )
  }
  ```

**3. `app/(site)/loading.tsx` — pass the real locale (cheap: a cookie read,
no network fetch):**

```tsx
import { Loading as LoadingComponent } from '@/components/ui'
import { getServerLocale } from '@/lib/i18n/server'

export default async function Loading() {
  const locale = await getServerLocale()
  return <LoadingComponent variant="terminal" locale={locale} />
}
```

**4. `lib/i18n/dictionaries/es.json` and `en.json` — new keys under
`common`** (sibling to the existing `pagination` object):

```json
"loadingTerminal": {
  "brand": "GRIZZLY TRADERS",
  "line1": "Conectando a mercados...",
  "line2": "Sincronizando feed de noticias...",
  "line3": "Cargando portal...",
  "srLabel": "Cargando portal..."
}
```
English:
```json
"loadingTerminal": {
  "brand": "GRIZZLY TRADERS",
  "line1": "Connecting to markets...",
  "line2": "Syncing news feed...",
  "line3": "Loading portal...",
  "srLabel": "Loading portal..."
}
```

## Repo conventions to follow

- `getDictionary(locale).common.X` is the exact pattern every other
  component uses (e.g. `StatsBar.tsx:1,12`) — this plan is the first time
  `Loading.tsx` participates in i18n; do it the same way, don't invent a
  parallel mechanism.
- `locale = 'es'` as a default parameter is the same fallback pattern
  `components/ui/ArticleCard.tsx` already uses — match it so `Loading`
  stays usable without a locale from call sites that don't have one.
- The blinking cursor (`<span className="terminal-cursor" ...>`) is a
  decorative `aria-hidden` detail inside a block that's already
  `aria-hidden="true"` as a whole, with the real accessible status
  communicated once via the `sr-only` span + `role="status" aria-live="polite"`
  on the outer wrapper — same accessibility pattern every other `Loading`
  variant already uses, don't add a second live region.
- `font-mono` (`var(--font-mono)`, already a token) is the right typeface
  for a terminal readout — consistent with how the ticker, pivot levels,
  and the hero's price card already use mono for anything "terminal-like."

## Steps

1. Add the two keyframes + two classes from **Target §1** to
   `app/globals.css`, placed directly after the existing
   `.hero-bar-grow` rule (same comment block area, new comment line above
   them explaining they're for the loading terminal, not the hero).
2. In `components/ui/Loading.tsx`:
   a. Add `import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'` near the top (alongside the existing `clsx` import).
   b. Revert `CardSkeleton` to the pre-003 form (**Target §2**) — remove the `blurred` prop and every `clsx(..., soft)` call, back to plain template strings.
   c. Revert `Bar` to the pre-003 form (**Target §2**) — remove `style`/`CSSProperties`; remove the now-unused `import type { CSSProperties } from 'react'` line entirely.
   d. Update `LoadingProps` and the `Loading` function signature per **Target §2** (swap `'home'` for `'terminal'` in the variant union, add `locale = 'es'`).
   e. Delete the whole `if (variant === 'home') { ... }` block and insert the `if (variant === 'terminal') { ... }` block from **Target §2** in its place (same position in the file, between the `'cards'` and `'article'` branches).
3. Replace `app/(site)/loading.tsx` with **Target §3**.
4. Add the `loadingTerminal` object from **Target §4** to both
   `lib/i18n/dictionaries/es.json` and `en.json`, under `common`, after the
   existing `pagination` key.

## Boundaries

- Do NOT touch `app/(site)/articulos/loading.tsx`,
  `app/(site)/articulos/[slug]/loading.tsx`, or
  `app/(site)/buscar/loading.tsx` — this plan is the home route only. If a
  terminal boot sequence is wanted elsewhere later, that's a separate,
  explicit request.
- Do NOT touch `HomeHero.tsx`, `app/(site)/page.tsx`, or any of plan 001's
  hero-entrance work — unrelated.
- Do NOT add a progress bar, a logo-equalizer animation, or any of the two
  alternatives the user did not pick — this plan implements exactly the
  chosen direction.
- Do NOT leave the `'home'` variant, the `blurred` prop, or the `style`
  prop on `Bar` in place "just in case" — grep confirmed before this plan
  was written that `variant="home"` has exactly one call site
  (`app/(site)/loading.tsx`), so the revert in Target §2 is safe and
  complete; leaving dead code here would violate this repo's own stated
  standards.
- If plan 003's code doesn't match what's cited above (e.g. it was already
  partially reverted, or further edited) when you open the file, STOP and
  diff against what's actually there before applying the revert — don't
  blindly paste over unknown drift.

## Verification

- **Mechanical**: `npx tsc --noEmit` (0 errors), `pnpm lint` (0 new
  errors/warnings), `pnpm test` (217/217 passing — `lib/i18n/i18n.test.ts`
  specifically must still pass, confirming `es.json`/`en.json` stay in
  parity after adding `loadingTerminal` to both).
- **Feel check**: `pnpm dev`, throttle network (DevTools → Slow 3G), hard
  reload `/`:
  - The three lines should appear one at a time, roughly 500ms apart, each
    with a small upward settle — not all at once.
  - A blinking block cursor should sit right after the third line once it
    appears, blinking steadily (on/off, not fading).
  - Reload with `?gt_locale` cookie (or however the project's locale
    switcher sets it) set to `en` — confirm the English lines render, not
    Spanish.
  - Toggle `prefers-reduced-motion`: all three lines should appear
    instantly at full opacity, and the cursor should stop blinking (shows
    static, not flashing) — confirms the global reduced-motion block still
    reaches these two new classes without any extra code.
  - Confirm there is no flash of unstyled/wrong-colored background before
    this screen paints — `bg-canvas` on the outer wrapper should match the
    real page's background exactly, so the transition in and out is just a
    content swap, not a color flash.
- **Done when**: all mechanical checks pass and every feel-check bullet is
  confirmed by eye in the running dev server.
