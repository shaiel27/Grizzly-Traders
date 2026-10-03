# 001 — Tone down the home hero's first-load entrance

- **Status**: DONE
- **Commit**: 3e8f34b
- **Severity**: MEDIUM
- **Category**: Physicality & origin (primary) + Easing & duration (secondary)
- **Estimated scope**: 2 files, ~12 lines changed (`app/globals.css`, `components/modules/HomeHero.tsx`)

## Problem

The home hero (`components/modules/HomeHero.tsx`) plays a one-shot entrance
sequence on every first load: headline, subcopy, CTAs, the "Pulso del
mercado" card, then all 32 sparkline bars growing in with a stagger. The
user flagged it as not subtle enough. Two concrete issues, not just taste:

1. **`heroBarGrow` animates from `scaleY(0)`** — `app/globals.css:251`:
   ```css
   @keyframes heroBarGrow { from { transform: scaleY(0); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }
   ```
   `scale(0)` is a standing finding in this skill's own audit playbook
   (AUDIT.md §3, Physicality & origin): "Never `scale(0)` — nothing in the
   real world appears from nothing." With 32 bars doing this at once, it
   reads as the loudest moment in the sequence — bars snapping in from
   nothing rather than settling into place.

2. **The travel distances and total sequence length are large for a
   "subtle" first impression**, even though AUDIT.md's duration table
   allows marketing moments to run long:
   - `app/globals.css:248-250` — `heroFadeUp`/`heroFadeDown` translate
     24px/-16px; `heroFadeScale` starts at `scale(0.94)`.
   - `app/globals.css:253-256` — durations are 0.8s/0.7s/0.9s/0.6s.
   - `components/modules/HomeHero.tsx:94,99,102,115` — headline/subcopy/CTAs/card
     fire at 300ms/500ms/700ms/900ms.
   - `components/modules/HomeHero.tsx:156` — bars stagger from 1100ms at
     30ms apart (`1100 + i * 30`), so bar 31 starts at 2030ms and the whole
     sequence (last bar's 0.6s) doesn't resolve until ~2630ms after load.

   Longer + larger movements read as more dramatic; shrinking both is what
   "more subtle" means mechanically here, not just a vibe.

## Target

```css
/* app/globals.css — target (replaces lines 248-256) */
@keyframes heroFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes heroFadeDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes heroFadeScale { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes heroBarGrow { from { transform: scaleY(0.15); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }

.hero-fade-up { opacity: 0; animation: heroFadeUp 0.6s var(--ease-hero-entrance) forwards; }
.hero-fade-down { opacity: 0; animation: heroFadeDown 0.5s var(--ease-hero-entrance) forwards; }
.hero-fade-scale { opacity: 0; animation: heroFadeScale 0.6s var(--ease-hero-entrance) forwards; }
.hero-bar-grow { opacity: 0; transform-origin: bottom; animation: heroBarGrow 0.42s var(--ease-hero-entrance) forwards; }
```

```tsx
// components/modules/HomeHero.tsx — target delays
// line 94:  style={{ animationDelay: '200ms' }}
// line 99:  style={{ animationDelay: '360ms' }}
// line 102: style={{ animationDelay: '520ms' }}
// line 115: animationDelay: '680ms',
// line 156: animationDelay: `${820 + i * 16}ms`,
```

New total sequence length: last bar (i=31) starts at `820 + 31*16 = 1316ms`,
animates 420ms, resolves at **~1736ms** — down from ~2630ms — with every
individual movement smaller (10px vs 24px rise, 0.97 vs 0.94 scale floor,
no bar starting from literal zero).

## Repo conventions to follow

- The easing stays `var(--ease-hero-entrance)` (`app/globals.css:46`,
  `cubic-bezier(0.16, 1, 0.3, 1)`) — already a strong ease-out curve per
  AUDIT.md §2, correctly scoped as a one-off token reserved for this hero
  (comment above it explains why it's distinct from `--ease-out`). Do not
  touch this token or its value.
- Keep using plain `@keyframes` + a class + an inline `animationDelay` —
  that's the existing pattern for this one-shot sequence; don't introduce
  Framer Motion or a JS stagger helper for it.
- `prefers-reduced-motion` is already handled globally (`app/globals.css`'s
  catch-all block matching `*:not(.ticker-track):not(.ticker-motion)`) —
  nothing to add there; this plan only changes keyframe/delay values.

## Steps

1. In `app/globals.css`, replace the four `@keyframes` declarations at
   lines 248-251 with the four in **Target** above (same names, new
   `from`/`to` values only — do not rename the keyframes or classes).
2. In the same file, replace the four utility-class declarations at lines
   253-256 with the **Target** versions (new durations only — class names,
   `opacity: 0`, `transform-origin: bottom`, and the easing var all stay
   exactly as they are).
3. In `components/modules/HomeHero.tsx`, update the five `animationDelay`
   values at lines 94, 99, 102, 115, and 156 to the **Target** values
   above. Line 156's template literal changes from `` `${1100 + i * 30}ms` ``
   to `` `${820 + i * 16}ms` `` — keep it a template literal driven by the
   loop index `i`, do not hardcode 32 separate values.

## Boundaries

- Do NOT touch any other `@keyframes`/animation in `app/globals.css`
  (`tickerScroll`, `tickerFlashUp`, `tickerFlashDown` and their classes are
  out of scope — they are a documented, deliberate exception to the
  reduced-motion block for a different reason and must not be touched here).
- Do NOT change markup/structure in `HomeHero.tsx` — only the five
  `animationDelay` values and nothing else in that file.
- Do NOT add a new easing token or change `--ease-hero-entrance`.
- Do NOT touch the video `<source>`/`poster` handling or the
  `prefers-reduced-motion` video-pause `useEffect` in `HomeHero.tsx` —
  unrelated to this plan.
- If any of the five cited line numbers don't match this content when you
  open the file (drift since commit `3e8f34b`), STOP and report instead of
  guessing which block to edit.

## Verification

- **Mechanical**: `npx tsc --noEmit` (0 errors), `pnpm lint` (0 new
  errors/warnings beyond the project's existing preexisting warnings in
  `app/login/LoginForm.tsx`, `components/ui/CMSPanel.tsx`, `lib/api.ts`),
  `pnpm test` (217/217 passing, unchanged).
- **Feel check**: run `pnpm dev`, hard-reload `/` with cache disabled so
  the sequence actually replays, and confirm:
  - The headline/subcopy/CTA block eases in with a noticeably smaller
    vertical shift than before — it should read as a settle, not a slide.
  - The "Pulso del mercado" card's pop-in is barely perceptible as a scale
    change (should look close to a plain fade).
  - The 32 sparkline bars rise from a short visible stub, never from a
    flat invisible line — in DevTools' Animations panel, scrub to 0% and
    confirm every bar has nonzero height at the very start of its
    animation.
  - The whole sequence (headline through the last bar) finishes clearly
    faster than a ~2.6s count — eyeball it against a stopwatch or the
    Animations panel's timeline, should land close to 1.7s.
  - Toggle `prefers-reduced-motion` (DevTools Rendering panel): the hero's
    text/card/bars should appear instantly at full opacity with no
    movement (unchanged from before this plan — confirms the global
    reduced-motion block still catches these classes).
- **Done when**: all three mechanical checks pass and every feel-check
  bullet above is confirmed by eye in the running dev server.
