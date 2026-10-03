# 005 — Full-screen minimal splash for the home loading state

- **Status**: DONE — applied exactly as specified, no drift found.
- **Supersedes**: [004](004-home-loading-terminal-boot.md) — the user
  rejected the terminal boot sequence's look (multi-line text crawl felt
  too busy) but confirmed the *scope* should be a full-screen takeover
  (covering the real header/ticker too, not a small box inside the page).
  Direction: same full-screen coverage, replace the text lines + cursor
  with a single minimal, centered, breathing brand mark.
- **Commit**: a commit containing 004's changes (not yet committed as of
  this writing)
- **Severity**: N/A (direction change)
- **Category**: Purpose & frequency (one simple, continuous, low-key
  motion instead of a multi-step reveal) + Restraint (impeccable-design:
  "spend your boldness in one place" — here, nowhere loud at all)

## Problem

Plan 004's `'terminal'` variant is a small `min-h-[70vh]` centered box that
renders *within* the page's normal flow, below the still-visible real
Header/ticker — and its content (brand label + 3 staggered lines + a
blinking block cursor) reads as busy for what the user wants, which is a
genuinely minimal, full-interface loading moment.

## Target

A single fixed, full-viewport overlay — `bg-canvas`, covering the entire
screen including the real Header/LiveTicker underneath (they're not
unmounted, just visually covered until this overlay goes away) — showing
only the site's actual logo mark, breathing gently, plus one small static
caption line. No multi-line crawl, no cursor, no brand wordmark typed out.

**1. `app/globals.css`** — remove 004's terminal-specific keyframes/classes
(`terminalLineIn`, `terminalBlink`, `.terminal-line`, `.terminal-cursor` —
dead once the variant they served is gone) and add one new keyframe:

```css
/* Home loading screen's minimal splash mark — a slow, continuous breathe.
   Reduced motion is already handled by the global catch-all below (it
   matches `*`), so no separate motion-reduce class is needed here. */
@keyframes splashBreathe {
  0%, 100% { opacity: 0.55; transform: scale(0.94); }
  50% { opacity: 1; transform: scale(1); }
}
.splash-mark { animation: splashBreathe 1.8s var(--ease-in-out) infinite; }
```

**2. `components/ui/Loading.tsx`** — rename the variant from `'terminal'`
to `'splash'` and replace its body:

```tsx
interface LoadingProps {
  variant?: 'spinner' | 'skeleton' | 'cards' | 'article' | 'splash'
  count?: number
  className?: string
  locale?: Locale
}
```

```tsx
if (variant === 'splash') {
  // Full-screen takeover: covers the real Header/LiveTicker too (z-[60] is above
  // the header's z-50), not a box inside the page's normal flow.
  const dict = getDictionary(locale).common.loadingSplash
  return (
    <div className={clsx('fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-canvas', className)} role="status" aria-live="polite">
      <Image src="/logo.png" alt="" width={48} height={48} className="splash-mark size-12 object-contain" aria-hidden="true" />
      <p aria-hidden="true" className="text-caption text-ink-muted">{dict.caption}</p>
      <span className="sr-only">{dict.srLabel}</span>
    </div>
  )
}
```

Add `import Image from 'next/image'` at the top (the file doesn't import it
yet).

**3. `lib/i18n/dictionaries/es.json` / `en.json`** — replace `loadingTerminal` with:

```json
"loadingSplash": {
  "caption": "Cargando mercados...",
  "srLabel": "Cargando portal..."
}
```
English:
```json
"loadingSplash": {
  "caption": "Loading markets...",
  "srLabel": "Loading portal..."
}
```

**4. `app/(site)/loading.tsx`** — only the variant name changes:

```tsx
return <LoadingComponent variant="splash" locale={locale} />
```

## Repo conventions to follow

- `/logo.png` is the real logo asset already used by `Header.tsx:221` and
  `Footer.tsx` (`<Image src="/logo.png" alt="" width={36|28} height={36|28} />`)
  — reuse the exact same asset and `alt=""` convention (decorative, name is
  already read elsewhere), don't draw a new SVG mark.
- The global `@media (prefers-reduced-motion: reduce)` block in
  `app/globals.css` (matches `*`, excludes only `.ticker-track`/
  `.ticker-motion`) already catches `.splash-mark` — this is the same
  mechanism `.hero-fade-up` etc. rely on; don't add a redundant
  `motion-reduce:animate-none` utility class on top of a non-Tailwind
  custom animation class, it isn't needed and isn't how this codebase
  does it for custom keyframes.
- `z-[60]` is deliberately above `Header.tsx:207`'s `z-50` — if the header's
  z-index ever changes, this value needs to stay higher than it, not an
  arbitrary round number.

## Steps

1. In `app/globals.css`, delete the `terminalLineIn`/`terminalBlink`
   keyframes and `.terminal-line`/`.terminal-cursor` classes added by plan
   004, replace with the **Target §1** `splashBreathe` keyframe + `.splash-mark` class.
2. In `components/ui/Loading.tsx`:
   a. Add `import Image from 'next/image'`.
   b. Change `LoadingProps['variant']`'s union from `'terminal'` to `'splash'`.
   c. Delete the whole `if (variant === 'terminal') { ... }` block and
      insert the `if (variant === 'splash') { ... }` block from **Target §2**.
3. In both dictionary files, replace the `loadingTerminal` object (added by
   plan 004) with `loadingSplash` from **Target §3**.
4. In `app/(site)/loading.tsx`, change `variant="terminal"` to
   `variant="splash"` — nothing else in that file changes.

## Boundaries

- Do NOT reintroduce multi-line text, a cursor, or any staggered reveal —
  the whole point of this plan is fewer moving parts than 004, not a
  different arrangement of the same amount of content.
- Do NOT change `Header.tsx`, `Footer.tsx`, or any other place that
  already uses `/logo.png` — only read its existing usage for the `alt`/
  asset convention.
- Do NOT add a scroll lock, a timeout-based auto-dismiss, or any JS beyond
  what's in Target §2 — this is a Suspense fallback; Next.js unmounts it
  automatically once the real page is ready.
- If `Header.tsx`'s outer z-index (currently `z-50`, `Header.tsx:207`) has
  changed since this plan was written, STOP and pick a `z-[N]` value higher
  than whatever it is now, don't blindly keep `60`.

## Verification

- **Mechanical**: `npx tsc --noEmit` (0 errors), `pnpm lint` (0 new
  errors/warnings), `pnpm test` (217/217 passing — confirms dictionary
  parity after swapping `loadingTerminal` for `loadingSplash` in both files).
- **Feel check**: `pnpm dev`, throttle network (Slow 3G), hard-reload `/`:
  - The real Header/ticker should be completely covered — not visible
    through or above the splash.
  - The logo should breathe slowly and continuously (scale + opacity),
    never disappearing entirely (opacity floor is 0.55, not 0).
  - Toggle `prefers-reduced-motion`: the logo should sit static at full
    opacity/scale, no breathing.
  - Switch locale to `en` and confirm the caption changes language.
  - Confirm zero flash of the real page's header/content behind the splash
    before it's covered (the overlay must paint before or atomically with
    first paint — if there's a flash, the `fixed`/`z-[60]`/`bg-canvas`
    combination needs rechecking, not papered over).
- **Done when**: all mechanical checks pass and every feel-check bullet is
  confirmed by eye.
