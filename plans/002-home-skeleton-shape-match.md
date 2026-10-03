# 002 — Match the home loading skeleton to the real hero's shape

- **Status**: TODO
- **Commit**: 8c7d50d
- **Severity**: HIGH
- **Category**: Missed opportunities (primary) + Cohesion & tokens (stagger)
- **Estimated scope**: 2 files (`components/ui/Loading.tsx`, `app/(site)/loading.tsx`)

## Problem

`app/(site)/loading.tsx` (the Suspense fallback for the home route) still
renders a skeleton shaped like the **old** hero — a centered text block
inside a padded, max-width container:

```tsx
// app/(site)/loading.tsx:3-9 — current
export default function Loading() {
  return (
    <main className="flex-grow pt-[var(--header-height)] pb-24 max-w-[1200px] mx-auto px-6 md:px-8 w-full">
      <LoadingComponent variant="home" className="mt-6" />
    </main>
  )
}
```

```tsx
// components/ui/Loading.tsx:77-82 — current hero block inside the 'home' variant
<div className="mb-8 flex flex-col gap-5">
  <Bar className="h-10 w-full max-w-xl sm:h-12" />
  <Bar className="h-4 w-full max-w-2xl" />
  <Bar className="h-4 w-3/4 max-w-xl" />
</div>
```

The real home page (`app/(site)/page.tsx`) no longer has a hero inside that
padded `<main>` — it renders `<HomeHero />` as a **full-bleed sibling before**
`<main>`, and `<main>` itself dropped `pt-[var(--header-height)]` in favor of
a plain `pt-10` (`HomeHero` owns the header offset now):

```tsx
// app/(site)/page.tsx — current, for reference
<HomeHero locale={locale} postCount={postCount} categoryCount={categoryCount} assetCount={assetCount} sourceCount={sourceCount} btcPrice={btcPrice} />
<main id="main-content" tabIndex={-1} className="flex-grow pb-24 pt-10 max-w-[1200px] mx-auto px-6 md:px-8 w-full">
```

`HomeHero` itself (`components/modules/HomeHero.tsx:63-173`) is:
- a `<section className="relative isolate min-h-[600px] overflow-hidden bg-canvas md:min-h-[680px]">` (full viewport width, fixed min-height, dark canvas background, video + veil absolutely positioned inside),
- containing `<div className="relative z-10 section-container pt-[calc(var(--header-height)+40px)] pb-16 md:pb-20">` → a `flex flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-14` row with: a headline+subcopy+two-buttons column (`max-w-xl`), and a `max-w-[400px]` glass/gradient "Pulso del mercado" card with a price, a delta badge, a 32-bar sparkline, and a stats line.

Because the skeleton's container chain (`pt-[var(--header-height)]` +
`max-w-[1200px]` + `px-6`) doesn't match the real chain (full-bleed section
→ `section-container` at a different breakpoint rhythm), the skeleton's
hero block is narrower, shorter, and positioned differently than the real
hero. The instant real content replaces it, nearly everything above the
fold shifts — the "no luce bien" the user flagged. Per this skill's own
audit (AUDIT.md §8, Missed opportunities): *"Spatially-connected UI with no
motion explaining where it came from"* — here it's worse than "no motion",
the shapes actively disagree.

Secondary, smaller finding (AUDIT.md §7, Cohesion & tokens): every skeleton
block uses the same `animate-pulse` with no stagger, so the whole page
blinks in unison. A 60-90ms offset between the hero block and the content
below is cheap, decorative, and "belongs" per the audit — but it is NOT the
thing to fix first, and must never replace the shape fix above.

## Target

**`app/(site)/loading.tsx` — full file:**

```tsx
import { Loading as LoadingComponent } from '@/components/ui'

export default function Loading() {
  return <LoadingComponent variant="home" />
}
```

(No wrapping `<main>` here — the `'home'` variant now owns its own full
structure, exactly mirroring `page.tsx`'s two top-level siblings.)

**`components/ui/Loading.tsx` — replace the `'home'` variant's body (current
lines 74-128) with:**

```tsx
return (
  <div className={clsx('w-full', className)} role="status" aria-live="polite">
    <div aria-hidden="true">
      {/* Hero skeleton — same container chain as HomeHero.tsx, so swapping in the
          real hero (video + headline + pulse card) causes zero layout shift. */}
      <div className="relative min-h-[600px] overflow-hidden bg-canvas md:min-h-[680px]">
        <div className="section-container pt-[calc(var(--header-height)+40px)] pb-16 md:pb-20">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-14">
            <div className="max-w-xl">
              <Bar className="h-10 w-full sm:h-12" />
              <Bar className="mt-3 h-10 w-3/4 sm:h-12" />
              <Bar className="mt-5 h-4 w-full max-w-md" />
              <Bar className="mt-2 h-4 w-2/3 max-w-md" />
              <div className="mt-7 flex gap-3">
                <Bar className="h-11 w-40 rounded-full" />
                <Bar className="h-11 w-44 rounded-full" />
              </div>
            </div>

            <div className="w-full max-w-[400px] rounded-xl border border-hairline-soft bg-surface-1 p-7 md:p-8">
              <Bar className="h-3 w-24" style={{ animationDelay: '60ms' }} />
              <Bar className="mt-2 h-5 w-20" style={{ animationDelay: '60ms' }} />
              <Bar className="mt-3 h-9 w-32" style={{ animationDelay: '60ms' }} />
              <Bar className="mt-4 h-6 w-28 rounded-md" style={{ animationDelay: '60ms' }} />
              <div className="relative mt-7 flex h-[90px] items-end gap-[2px]">
                {[...Array(32)].map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 animate-pulse motion-reduce:animate-none rounded-[1px] bg-surface-2"
                    style={{ height: `${20 + ((i * 7) % 60)}%`, animationDelay: `${60 + i * 6}ms` }}
                  />
                ))}
              </div>
              <Bar className="mt-3 h-3 w-full" style={{ animationDelay: '60ms' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Everything below the hero: unchanged from the current skeleton, just offset
          with a small stagger and moved into the real max-width container. */}
      <div className="mx-auto w-full max-w-[1200px] px-6 pt-10 md:px-8">
        <div className="mb-8 rounded-xl border border-hairline-soft bg-surface-1/50 p-4" style={{ animationDelay: '90ms' }}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Bar className="size-9 shrink-0 rounded-lg" style={{ animationDelay: '90ms' }} />
                <div className="flex-1 space-y-1.5">
                  <Bar className="h-4 w-12" style={{ animationDelay: '90ms' }} />
                  <Bar className="h-3 w-20" style={{ animationDelay: '90ms' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8 grid gap-0 overflow-hidden rounded-2xl border border-hairline lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-4 p-5 md:p-6">
            <Bar className="h-5 w-24 rounded-full" style={{ animationDelay: '120ms' }} />
            <Bar className="h-8 w-full" style={{ animationDelay: '120ms' }} />
            <Bar className="h-4 w-2/3" style={{ animationDelay: '120ms' }} />
            <div className="grid grid-cols-3 gap-2">
              {[...Array(3)].map((_, i) => <Bar key={i} className="h-14 rounded-lg" style={{ animationDelay: '120ms' }} />)}
            </div>
          </div>
          <Bar className="min-h-[220px] rounded-none" style={{ animationDelay: '120ms' }} />
        </div>

        <div className="mb-4 flex items-end justify-between">
          <Bar className="h-6 w-40" style={{ animationDelay: '150ms' }} />
          <Bar className="h-4 w-24" style={{ animationDelay: '150ms' }} />
        </div>
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
        </div>

        <Bar className="mb-4 h-6 w-48" style={{ animationDelay: '180ms' }} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    </div>
    <span className="sr-only">Cargando portal…</span>
  </div>
)
```

## Repo conventions to follow

- Keep using `Bar` and `CardSkeleton` (already defined at the top of
  `components/ui/Loading.tsx`) — do not introduce a new skeleton primitive
  or a shimmer-gradient effect. `Bar` already carries
  `animate-pulse motion-reduce:animate-none`; the 32-bar sparkline stub
  inlines the same two classes directly (it isn't using `Bar` because it
  needs a per-bar `height`, same pattern `Bar` itself doesn't support).
- `animationDelay` as an inline style on top of a Tailwind `animate-pulse`
  class is the same technique already used for the hero's real entrance
  animation in `components/modules/HomeHero.tsx` (e.g. line 156) — reuse
  it, don't add a second stagger mechanism.
- `section-container` (defined in `app/globals.css`) is the exact class
  `HomeHero.tsx:89` uses for its inner content width — reuse it verbatim so
  both the skeleton and the real hero wrap text at the same width.
- `pt-[calc(var(--header-height)+40px)]` must be copied character-for-
  character from `HomeHero.tsx:89` — this is the one value in the whole
  plan where an approximation (e.g. a plain `pt-10`) would silently
  reintroduce the layout shift this plan exists to remove.

## Steps

1. Replace the full contents of `app/(site)/loading.tsx` with the **Target**
   version above — it no longer wraps `<LoadingComponent>` in a `<main>`.
2. In `components/ui/Loading.tsx`, replace the `'home'` branch's returned
   JSX (currently lines 74-128, between `if (variant === 'home') {` and its
   closing `}`) with the **Target** version above. Leave the `Bar` and
   `CardSkeleton` helper functions, every other variant, and the outer
   `if (variant === 'home') { return ( ... ) }` wrapper untouched.
3. Confirm `clsx` is still imported and used (it already is, for `className`
   on the outer wrapper) — no import changes needed in either file.

## Boundaries

- Do NOT change `components/modules/HomeHero.tsx` or `app/(site)/page.tsx`
  — this plan only brings the skeleton in line with what they already do.
- Do NOT add a shimmer/gradient-sweep animation or any new `@keyframes` —
  the fix is shape + stagger, not a new motion idiom. If tempted, re-read
  this plan's Problem section: the shape mismatch is the finding, not the
  pulse technique.
- Do NOT touch the `'spinner'`, `'skeleton'`, `'cards'`, or `'article'`
  variants in `components/ui/Loading.tsx`.
- Do NOT change the real BTC price/sparkline logic — the skeleton's 32 bars
  use a fixed deterministic pattern (`20 + ((i * 7) % 60)`), not
  `HomeHero`'s `sparklineBars()` — it only needs to occupy the same space,
  not predict the real data.
- If `HomeHero.tsx`'s container classes (section-container, the
  `pt-[calc(...)]` value, the `max-w-[400px]` card, or the two-column flex
  breakpoint) have changed since commit `8c7d50d`, STOP and re-derive the
  Target from the current file instead of applying this plan's literal
  classes — the whole point is a shape match, so drift must be re-checked,
  not copy-pasted through.

## Verification

- **Mechanical**: `npx tsc --noEmit` (0 errors), `pnpm lint` (0 new
  errors/warnings), `pnpm test` (217/217 passing, unchanged — no test
  currently covers `loading.tsx`, so none should break or need updating).
- **Feel check**: in `pnpm dev`, throttle the network (DevTools → Network →
  Slow 3G) and hard-reload `/`, then:
  - Confirm the skeleton's hero block fills the exact same width/height as
    the real `HomeHero` section once it loads — nothing above the fold
    should jump vertically or horizontally when the real content swaps in.
  - Confirm the "pulse card" skeleton on the right lines up with where the
    real glass card renders (same `max-w-[400px]`, same position in the
    flex row).
  - Confirm the 32 skeleton bars sit in the same `h-[90px]` box as the real
    sparkline.
  - Toggle `prefers-reduced-motion` (DevTools Rendering panel): every
    skeleton block should stop pulsing and sit at full, static opacity —
    confirms `motion-reduce:animate-none` still reaches the new/moved
    blocks (inherited via `Bar`'s own classes, and inlined directly on the
    32-bar stub).
  - Confirm the hero block's pulse and the content-below pulse are
    perceptibly offset (not perfectly synchronized) — the stagger should
    read as alive, not as a glitch.
- **Done when**: no visible layout shift between the loading and loaded
  states of `/`, confirmed by eye with network throttling, and all three
  mechanical checks pass.
