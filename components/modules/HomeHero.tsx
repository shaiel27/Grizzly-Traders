'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui'
import { getDictionary, t, type Locale } from '@/lib/i18n/get-dictionary'
import type { PriceData } from '@/lib/prices'

interface HomeHeroProps {
  locale: Locale
  postCount: number
  categoryCount: number
  assetCount: number
  sourceCount: number
  btcPrice: PriceData | null
}

const BAR_COUNT = 32
const PROJECTED_FROM = BAR_COUNT - 4

// Deterministic sparkline derived from the price itself — no Math.random()/Date.now(), so
// server and client render the exact same bars (react-hooks/purity, no hydration mismatch).
function sparklineBars(seed: number): number[] {
  const bars: number[] = []
  for (let i = 0; i < BAR_COUNT; i++) {
    const wave = Math.sin((i + seed) * 0.45) * 16 + Math.sin((i + seed) * 0.17) * 9
    bars.push(Math.max(10, Math.round(32 + wave + i * 1.4)))
  }
  return bars
}

export function HomeHero({ locale, postCount, categoryCount, assetCount, sourceCount, btcPrice }: HomeHeroProps) {
  const dict = getDictionary(locale).home
  const numberLocale = locale === 'en' ? 'en-US' : 'es-ES'
  const videoRef = useRef<HTMLVideoElement>(null)

  // prefers-reduced-motion covers CSS animations on its own (globals.css), but a <video> keeps
  // playing regardless — this is the one thing that needs JS to actually stop.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      if (query.matches) video.pause()
      else video.play().catch(() => {})
    }
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  const price = btcPrice?.price ?? null
  const changePercent = btcPrice?.changePercent24h ?? 0
  const isUp = changePercent >= 0
  const bars = sparklineBars(price !== null ? Math.round(price) % 97 : 42)
  const maxBar = Math.max(...bars)

  const intPart = price !== null ? Math.floor(price) : null
  const centsPart = price !== null ? Math.round((price - Math.floor(price)) * 100).toString().padStart(2, '0') : null
  const previousClose = price !== null && btcPrice ? price - btcPrice.change24h : null

  return (
    <section className="relative isolate min-h-[600px] overflow-hidden bg-canvas md:min-h-[680px]" aria-label={dict.heroSectionAria}>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        poster="/market-loop-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src="/market-loop-1080p.webm" type="video/webm" />
        <source src="/market-loop-1080p.mp4" type="video/mp4" />
      </video>

      {/* Veil: keeps the headline legible over the footage and fades the hero into the canvas below */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 20% 10%, color-mix(in srgb, var(--gradient-violet) 16%, transparent) 0%, transparent 60%), linear-gradient(180deg, rgba(9,9,9,0.55) 0%, rgba(9,9,9,0.72) 55%, var(--canvas) 100%)',
        }}
      />

      <div className="relative z-10 section-container pt-[calc(var(--header-height)+40px)] pb-16 md:pb-20">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-14">
          <div className="max-w-xl">
            <h1
              className="hero-fade-up text-display-lg-mobile sm:text-display-lg md:text-display-xl tracking-tight text-ink"
              style={{ animationDelay: '200ms' }}
            >
              <span className="block">{dict.heroTitleLine1}</span>
              <span className="block">{dict.heroTitleLine2}</span>
            </h1>
            <p className="hero-fade-up mt-5 max-w-md text-body text-on-surface-variant" style={{ animationDelay: '360ms' }}>
              {dict.heroLead}
            </p>
            <div className="hero-fade-up mt-7 flex flex-wrap gap-3" style={{ animationDelay: '520ms' }}>
              <Button variant="primary" size="lg" asChild>
                <Link href="/articulos">{dict.heroCtaPrimary}</Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/aprende">{dict.heroCtaSecondary}</Link>
              </Button>
            </div>
          </div>

          <div
            className="hero-fade-scale w-full max-w-[400px] rounded-xl border border-white/[0.12] p-7 md:p-8"
            style={{
              animationDelay: '680ms',
              background:
                'radial-gradient(140% 100% at 15% 0%, color-mix(in srgb, var(--gradient-violet) 30%, transparent) 0%, color-mix(in srgb, var(--gradient-magenta) 18%, transparent) 32%, var(--surface-1) 62%)',
            }}
          >
            <p className="text-caption text-ink-subtle">{dict.heroPulseLabel}</p>
            <p className="mt-1 text-body-lg font-semibold text-ink">BTC/USD</p>

            <p className="mt-3 flex items-baseline gap-0.5 font-mono tabular-nums text-ink">
              <span className="text-[36px] font-semibold">{intPart !== null ? intPart.toLocaleString(numberLocale) : '—'}</span>
              {centsPart !== null && <span className="text-[36px] font-semibold text-ink-subtle">.{centsPart}</span>}
            </p>

            {price !== null && (
              <div className="mb-7 mt-2 flex items-center gap-2.5">
                <span
                  className={
                    isUp
                      ? 'rounded-md border border-semantic-success/30 bg-semantic-success/10 px-2 py-1.5 text-caption font-semibold text-semantic-success'
                      : 'rounded-md border border-semantic-danger/30 bg-semantic-danger/10 px-2 py-1.5 text-caption font-semibold text-semantic-danger'
                  }
                >
                  {isUp ? '+' : ''}
                  {changePercent.toFixed(1)}%
                </span>
                <span className="text-caption text-on-surface-variant/80">
                  {t(dict.heroPulseVs, {
                    price: previousClose !== null ? `$${Math.round(previousClose).toLocaleString(numberLocale)}` : '—',
                  })}
                </span>
              </div>
            )}

            <div className="relative flex h-[90px] items-end gap-[2px]" aria-hidden="true">
              {bars.map((height, i) => (
                <div
                  key={i}
                  className="hero-bar-grow flex-1 rounded-[1px]"
                  style={{
                    height: `${Math.round((height / maxBar) * 100)}%`,
                    backgroundColor: i >= PROJECTED_FROM ? 'rgba(255,255,255,0.14)' : 'var(--ink)',
                    animationDelay: `${820 + i * 16}ms`,
                  }}
                />
              ))}
            </div>

            <p className="mt-3 border-t border-hairline-soft pt-3 font-mono text-micro text-ink-subtle">
              {t(dict.heroStatsLine, {
                posts: postCount.toLocaleString(numberLocale),
                categories: categoryCount,
                assets: assetCount,
                sources: sourceCount,
              })}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
