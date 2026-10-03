# 003 — Diffuse/blurred treatment for the home loading skeleton

- **Status**: SUPERSEDED by [004](004-home-loading-terminal-boot.md) — the
  user rejected the whole skeleton approach after seeing it and picked a
  terminal boot sequence instead. (Note for history: Bar gained an opt-in
  `style` prop during execution, not anticipated in this plan's Target
  snippets, needed so `animationDelay` could actually be passed to it;
  everything else matched as written. Plan 004 reverts this.)
- **Supersedes**: [002](002-home-skeleton-shape-match.md) — same shape-match fix, folded in here, now with a blurred visual treatment instead of flat `bg-surface-2` rectangles. 002's step 1 (`app/(site)/loading.tsx`) is already applied and correct for this plan too — nothing to redo there.
- **Commit**: 8c7d50d
- **Severity**: HIGH (shape match) + MEDIUM (blur treatment)
- **Category**: Missed opportunities (shape) + Cohesion & tokens (one motion language across the whole skeleton) + Performance (static vs. animated blur)
- **Estimated scope**: 1 file (`components/ui/Loading.tsx`) — `app/(site)/loading.tsx` already matches the target, untouched by this plan.

## Problem

Two things, not one:

1. **Shape mismatch** (unchanged from plan 002): the `'home'` variant's hero
   block (`components/ui/Loading.tsx:77-82`, current) is a plain, narrow
   text-bar stack with no container chain matching the real
   `HomeHero.tsx:63-173` (full-bleed `min-h-[600px]/[680px]` section,
   `section-container` + `pt-[calc(var(--header-height)+40px)]`, two-column
   flex with a `max-w-[400px]` card on the right). This plan folds in the
   same fix plan 002 specified, so it's written once, correctly, with the
   blur treatment already baked in — don't apply 002 and then re-edit on
   top of it.

2. **The user asked for the loading motion itself to feel "difuminada"**
   (diffuse/blurred) rather than the current flat gray rectangles pulsing
   opacity. Right now every skeleton shape in every variant is a hard-edged
   `bg-surface-2` block (`Bar`, `components/ui/Loading.tsx:28-30`, and
   `CardSkeleton`, lines 12-25) — functional, but reads as a generic
   wireframe, not as "this specific dark, glassy, video-backed page about
   to resolve." The real page already has a strong blur/glass vocabulary
   (`HomeHero.tsx`'s `backdrop-filter`-free gradient card, `Header.tsx`'s
   `backdrop-blur-md` translucent bar) that the skeleton currently ignores
   entirely.

## Target

**A fixed, non-animated `filter: blur()` on every skeleton shape** (the
blur radius never changes — only `opacity` animates via the existing
`animate-pulse`), plus **one soft blurred glow** behind the hero text,
reusing `HomeHero.tsx`'s own veil gradient colors so the skeleton already
looks like *this* page's hero, not a generic one.

This stays inside AUDIT.md §5's performance rule ("keep transition-time
`filter: blur()` under 20px — heavy blur is expensive"): the blur here is
never the animated property, so there is no transition-time blur cost at
all — each blurred shape rasterizes once and only its opacity changes per
frame, which is exactly the compositor-cheap path the rule is protecting.

**`components/ui/Loading.tsx` — full replacement of the `'home'` branch
(current lines 72-130), plus a small `CardSkeleton` signature change:**

```tsx
// CardSkeleton gets an opt-in `blurred` prop — default false, so every existing
// call site (the 'cards' variant) renders exactly as it does today.
function CardSkeleton({ blurred = false }: { blurred?: boolean } = {}) {
  const soft = blurred ? 'blur-[1.5px]' : ''
  return (
    <div className="card animate-pulse motion-reduce:animate-none" aria-hidden="true">
      <div className={clsx('aspect-[16/10] bg-surface-2 rounded-lg mb-4', soft)} />
      <div className="flex gap-2 mb-3">
        <div className={clsx('h-5 w-20 bg-surface-2 rounded-full', soft)} />
        <div className={clsx('h-5 w-16 bg-surface-2 rounded-full', soft)} />
      </div>
      <div className={clsx('h-6 bg-surface-2 rounded w-4/5 mb-2', soft)} />
      <div className={clsx('h-4 bg-surface-2 rounded w-3/5 mb-2', soft)} />
      <div className={clsx('h-4 bg-surface-2 rounded w-2/5', soft)} />
    </div>
  )
}
```

```tsx
// 'home' variant — target
if (variant === 'home') {
  return (
    <div className={clsx('w-full', className)} role="status" aria-live="polite">
      <div aria-hidden="true">
        {/* Hero skeleton — same container chain as HomeHero.tsx (zero layout shift),
            plus a static blurred glow reusing the real hero's own veil colors. */}
        <div className="relative min-h-[600px] overflow-hidden bg-canvas md:min-h-[680px]">
          <div
            className="absolute inset-0 blur-[60px] animate-pulse motion-reduce:animate-none"
            style={{
              background:
                'radial-gradient(60% 60% at 25% 20%, color-mix(in srgb, var(--gradient-violet) 28%, transparent) 0%, transparent 70%), radial-gradient(55% 55% at 80% 15%, color-mix(in srgb, var(--gradient-magenta) 20%, transparent) 0%, transparent 70%)',
            }}
          />
          <div className="relative z-10 section-container pt-[calc(var(--header-height)+40px)] pb-16 md:pb-20">
            <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-14">
              <div className="max-w-xl">
                <Bar className="h-10 w-full blur-[1.5px] sm:h-12" />
                <Bar className="mt-3 h-10 w-3/4 blur-[1.5px] sm:h-12" />
                <Bar className="mt-5 h-4 w-full max-w-md blur-[1.5px]" />
                <Bar className="mt-2 h-4 w-2/3 max-w-md blur-[1.5px]" />
                <div className="mt-7 flex gap-3">
                  <Bar className="h-11 w-40 rounded-full blur-[1.5px]" />
                  <Bar className="h-11 w-44 rounded-full blur-[1.5px]" />
                </div>
              </div>

              <div className="w-full max-w-[400px] rounded-xl border border-hairline-soft bg-surface-1/70 p-7 backdrop-blur-sm md:p-8">
                <Bar className="h-3 w-24 blur-[1px]" style={{ animationDelay: '60ms' }} />
                <Bar className="mt-2 h-5 w-20 blur-[1px]" style={{ animationDelay: '60ms' }} />
                <Bar className="mt-3 h-9 w-32 blur-[1px]" style={{ animationDelay: '60ms' }} />
                <Bar className="mt-4 h-6 w-28 rounded-md blur-[1px]" style={{ animationDelay: '60ms' }} />
                <div className="relative mt-7 flex h-[90px] items-end gap-[2px]">
                  {[...Array(32)].map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 animate-pulse motion-reduce:animate-none rounded-[1px] bg-surface-2 blur-[1px]"
                      style={{ height: `${20 + ((i * 7) % 60)}%`, animationDelay: `${60 + i * 6}ms` }}
                    />
                  ))}
                </div>
                <Bar className="mt-3 h-3 w-full blur-[1px]" style={{ animationDelay: '60ms' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Below the fold: same blurred-edge language, no glow — restraint: the glow is
            the hero's one bold moment, not repeated everywhere. */}
        <div className="mx-auto w-full max-w-[1200px] px-6 pt-10 md:px-8">
          <div className="mb-8 rounded-xl border border-hairline-soft bg-surface-1/50 p-4" style={{ animationDelay: '90ms' }}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Bar className="size-9 shrink-0 rounded-lg blur-[1px]" style={{ animationDelay: '90ms' }} />
                  <div className="flex-1 space-y-1.5">
                    <Bar className="h-4 w-12 blur-[1px]" style={{ animationDelay: '90ms' }} />
                    <Bar className="h-3 w-20 blur-[1px]" style={{ animationDelay: '90ms' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-8 grid gap-0 overflow-hidden rounded-2xl border border-hairline lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col gap-4 p-5 md:p-6">
              <Bar className="h-5 w-24 rounded-full blur-[1px]" style={{ animationDelay: '120ms' }} />
              <Bar className="h-8 w-full blur-[1px]" style={{ animationDelay: '120ms' }} />
              <Bar className="h-4 w-2/3 blur-[1px]" style={{ animationDelay: '120ms' }} />
              <div className="grid grid-cols-3 gap-2">
                {[...Array(3)].map((_, i) => <Bar key={i} className="h-14 rounded-lg blur-[1px]" style={{ animationDelay: '120ms' }} />)}
              </div>
            </div>
            <Bar className="min-h-[220px] rounded-none blur-[1px]" style={{ animationDelay: '120ms' }} />
          </div>

          <div className="mb-4 flex items-end justify-between">
            <Bar className="h-6 w-40 blur-[1px]" style={{ animationDelay: '150ms' }} />
            <Bar className="h-4 w-24 blur-[1px]" style={{ animationDelay: '150ms' }} />
          </div>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <CardSkeleton key={i} blurred />)}
          </div>

          <Bar className="mb-4 h-6 w-48 blur-[1px]" style={{ animationDelay: '180ms' }} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => <CardSkeleton key={i} blurred />)}
          </div>
        </div>
      </div>
      <span className="sr-only">Cargando portal…</span>
    </div>
  )
}
```

## Repo conventions to follow

- `blur-[Npx]` is a standard Tailwind arbitrary-value utility — no new CSS,
  no new keyframes, nothing added to `app/globals.css`. This plan is scoped
  entirely to `components/ui/Loading.tsx`.
- `color-mix(in srgb, var(--gradient-violet) 28%, transparent)` is the exact
  pattern `HomeHero.tsx:85` already uses for its veil — the glow reuses
  that recipe (different percentages/positions) rather than inventing a new
  color mixing approach.
- `animate-pulse motion-reduce:animate-none` stays the single motion
  mechanism for every shape, including the new glow div — no new animation
  utility, no JS. `prefers-reduced-motion` is handled exactly as it already
  is for `Bar`/`CardSkeleton`.
- `CardSkeleton`'s new `blurred` prop defaults to `false` specifically so
  the `'cards'` variant (`components/ui/Loading.tsx`'s `if (variant === 'cards')` branch, unchanged by this plan) keeps its exact current look —
  do not flip the default or touch that branch's call site.

## Steps

1. In `components/ui/Loading.tsx`, change the `CardSkeleton` function
   signature and body to the **Target** version above (adds the optional
   `blurred` prop; every internal `bg-surface-2` div gains the conditional
   `soft` class via `clsx`).
2. Replace the entire `if (variant === 'home') { ... }` branch (current
   lines 72-130) with the **Target** version above.
3. Leave the `'cards'` variant's `<CardSkeleton key={i} />` call (line 66)
   exactly as it is — no `blurred` prop there, confirming the default
   keeps that variant unblurred.
4. `app/(site)/loading.tsx` needs no change — it was already rewritten
   under plan 002 to `return <LoadingComponent variant="home" />` with no
   wrapping `<main>`, which is still correct here.

## Boundaries

- Do NOT modify the `'spinner'`, `'skeleton'`, or `'article'` variants.
- Do NOT change the `'cards'` variant's visual output — `CardSkeleton`'s
  new prop must be opt-in and default to the current look.
- Do NOT add blur to `HomeHero.tsx` or any real (non-skeleton) component —
  this plan is the loading state only.
- Do NOT animate the blur radius itself (no `transition`/`@keyframes` on
  `filter`) — only `opacity` via the existing `animate-pulse` animates;
  this is the specific performance line this plan must not cross.
- Keep every blur value at or under the literal pixels specified above
  (`1px`, `1.5px`, `60px` on the glow) — do not round up "for effect"; the
  shape-level blurs are deliberately barely-there (soften edges, don't
  obscure the shape), only the glow is a real blur.
- If `HomeHero.tsx`'s veil gradient recipe or container classes have
  changed since commit `8c7d50d`, STOP and re-derive the glow/shape-match
  values from the current file instead of applying this plan's literal
  values.

## Verification

- **Mechanical**: `npx tsc --noEmit` (0 errors), `pnpm lint` (0 new
  errors/warnings beyond the project's existing preexisting warnings),
  `pnpm test` (217/217 passing, unchanged).
- **Feel check**: `pnpm dev`, throttle network (DevTools → Slow 3G), hard
  reload `/`:
  - The hero skeleton should read as a soft, glowing, slightly out-of-
    focus version of the real hero — not a sharp gray wireframe, and not
    so blurred the shapes are unreadable as "a headline, two buttons, a
    card."
  - The violet/magenta glow should be visible but subtle behind the
    headline area, not competing with it.
  - Every shape below the fold should have the same soft-edge quality as
    the hero (one consistent motion/visual language top to bottom).
  - Open DevTools Performance panel, record ~2s of the skeleton pulsing:
    confirm no long frames/jank from the blurred layers (opacity-only
    compositing should keep this cheap even with ~15 blurred elements on
    screen at once).
  - Toggle `prefers-reduced-motion`: every shape (including the glow)
    should stop pulsing and sit static — blur itself is not motion, so it
    stays visible; only the opacity animation stops.
  - Confirm, as in plan 002, that there is still no layout shift between
    the skeleton and the real loaded hero.
- **Done when**: all mechanical checks pass, the feel-check bullets are
  confirmed by eye, and the Performance panel recording shows no jank.
