'use client'

import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { clsx } from 'clsx'
import { formatNumber, formatPrice } from '@/lib/format'
import { t, type Dictionary } from '@/lib/i18n/get-dictionary'
import { useDictionary } from '@/lib/i18n/LocaleProvider'
import { adxReading, compareWithAverages, macdReading, rsiReading, signalFor, type Reading, type Tone } from '@/lib/market-analysis'
import type { MarketItem as MarketAsset } from '@/lib/markets'

interface AssetDetailPanelProps {
  asset: MarketAsset | null
  className?: string
}

type Tab = 'summary' | 'performance' | 'averages' | 'company'

interface CompanyProfile {
  name: string
  industry: string
  exchange: string
  website: string | null
  marketCap: number | null
  pe: number | null
  eps: number | null
  week52High: number | null
  week52Low: number | null
  dividendYield: number | null
}

function CompanyTab({ symbol, dict }: { symbol: string; dict: Dictionary }) {
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/company-profile?symbol=${encodeURIComponent(symbol)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((body) => {
        if (body.success) setProfile(body.data)
        else setFailed(true)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [symbol])

  if (failed) return <p className="text-[13px] text-ink-muted">{dict.assetDetail.noCompanyData}</p>
  if (!profile) return <p className="text-[13px] text-ink-muted">{dict.assetDetail.loading}</p>

  return (
    <dl>
      <Row label={dict.assetDetail.industry} value={profile.industry || '—'} />
      <Row label={dict.assetDetail.exchange} value={profile.exchange || '—'} />
      <Row label={dict.assetDetail.marketCap} value={profile.marketCap != null ? formatNumber(profile.marketCap, 0) : '—'} />
      <Row label={dict.assetDetail.peRatio} value={profile.pe != null ? profile.pe.toFixed(2) : '—'} />
      <Row label={dict.assetDetail.eps} value={profile.eps != null ? `$${profile.eps.toFixed(2)}` : '—'} />
      <Row
        label={dict.assetDetail.range52w}
        value={profile.week52Low != null && profile.week52High != null ? `${formatPrice(profile.week52Low, '', { currency: true })} – ${formatPrice(profile.week52High, '', { currency: true })}` : '—'}
      />
      <Row label={dict.assetDetail.dividendYield} value={profile.dividendYield != null ? `${profile.dividendYield.toFixed(2)}%` : '—'} />
      {profile.website && (
        <div className="pt-3">
          <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-[13px] text-accent-blue hover:text-accent-blue-hover">
            {dict.assetDetail.website}
          </a>
        </div>
      )}
    </dl>
  )
}

const TONE_TEXT: Record<Tone, string> = {
  positive: 'text-semantic-success',
  negative: 'text-semantic-danger',
  neutral: 'text-ink-muted',
}

function signed(value: number, decimals = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

function readingLabel(dict: Dictionary, reading: Reading): string {
  return dict.marketAnalysis[reading.key]
}

function Row({ label, value, note, tone = 'neutral' }: { label: string; value: string; note?: string; tone?: Tone }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline-soft py-2.5 last:border-b-0">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="text-right">
        <span className="text-[13px] tabular-nums text-ink">{value}</span>
        {note && <span className={clsx('ml-3 text-[12px]', TONE_TEXT[tone])}>{note}</span>}
      </dd>
    </div>
  )
}

// -1 (strong sell) to +1 (strong buy), with the marker where the rating falls
function RatingScale({ value, dict }: { value: number; dict: Dictionary }) {
  const position = Math.max(0, Math.min(100, ((value + 1) / 2) * 100))
  return (
    <div className="mt-3" aria-hidden="true">
      <div className="relative h-1 rounded-full bg-gradient-to-r from-semantic-danger/60 via-surface-2 to-semantic-success/60">
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-surface-container-lowest" style={{ left: `${position}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-ink-subtle">
        <span>{dict.assetDetail.sellStrongScale}</span>
        <span>{dict.assetDetail.neutralScale}</span>
        <span>{dict.assetDetail.buyStrongScale}</span>
      </div>
    </div>
  )
}

function SummaryTab({ asset, dict }: { asset: MarketAsset; dict: Dictionary }) {
  const overall = signalFor(asset.recommendAll)
  const averages = signalFor(asset.recommendMA)
  const oscillators = signalFor(asset.recommendOther)
  const rsi = rsiReading(asset.rsi)
  const macd = macdReading(asset.macd, asset.macdSignal)
  const adx = adxReading(asset.adx)

  return (
    <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
      <div>
        <p className="text-[12px] text-ink-muted">{dict.assetDetail.overallSignal}</p>
        <p className={clsx('mt-0.5 text-[22px] font-semibold tracking-tight', TONE_TEXT[overall.tone])}>{readingLabel(dict, overall)}</p>
        <RatingScale value={asset.recommendAll} dict={dict} />
        <dl className="mt-4">
          <Row label={dict.assetDetail.movingAveragesTab} value={readingLabel(dict, averages)} tone={averages.tone} />
          <Row label={dict.assetDetail.oscillatorsLabel} value={readingLabel(dict, oscillators)} tone={oscillators.tone} />
        </dl>
        <p className="mt-2 text-[11px] text-ink-subtle">{dict.assetDetail.calculatedByNote}</p>
      </div>

      <dl>
        <Row label={dict.assetDetail.rsiLabel} value={asset.rsi ? asset.rsi.toFixed(1) : '—'} note={readingLabel(dict, rsi)} tone={rsi.tone} />
        <Row label={dict.assetDetail.macdLabel} value={asset.macd != null ? asset.macd.toFixed(2) : '—'} note={readingLabel(dict, macd)} tone={macd.tone} />
        <Row label={dict.assetDetail.adxLabel} value={asset.adx ? asset.adx.toFixed(1) : '—'} note={readingLabel(dict, adx)} />
        <Row label={dict.assetDetail.atrLabel} value={asset.atr ? asset.atr.toFixed(2) : '—'} />
        {asset.beta != null && <Row label={dict.assetDetail.betaLabel} value={asset.beta.toFixed(2)} />}
        {asset.marketCap > 0 && <Row label={dict.assetDetail.marketCap} value={formatNumber(asset.marketCap, 0)} />}
      </dl>
    </div>
  )
}

function PerformanceTab({ asset, dict }: { asset: MarketAsset; dict: Dictionary }) {
  const periods = [
    { label: dict.assetDetail.period1M, value: asset.perf1M },
    { label: dict.assetDetail.period3M, value: asset.perf3M },
    { label: dict.assetDetail.period6M, value: asset.perf6M },
    { label: dict.assetDetail.period1Y, value: asset.perfY },
  ]
  const scale = Math.max(1, ...periods.map((period) => Math.abs(period.value ?? 0)))

  return (
    <div>
      <ul className="max-w-2xl">
        {periods.map((period) => {
          const value = period.value
          const width = value == null ? 0 : (Math.abs(value) / scale) * 50
          const up = (value ?? 0) >= 0
          return (
            <li key={period.label} className="grid grid-cols-[5rem_1fr_4.5rem] items-center gap-4 border-b border-hairline-soft py-3 last:border-b-0">
              <span className="text-[13px] text-ink-muted">{period.label}</span>
              <span className="relative h-2" aria-hidden="true">
                <span className="absolute inset-y-0 left-1/2 w-px bg-hairline" />
                {value != null && (
                  <span
                    className={clsx('absolute inset-y-0 rounded-[2px]', up ? 'bg-semantic-success' : 'bg-semantic-danger')}
                    style={up ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }}
                  />
                )}
              </span>
              <span className={clsx('text-right text-[13px] tabular-nums', value == null ? 'text-ink-subtle' : up ? 'text-semantic-success' : 'text-semantic-danger')}>
                {value == null ? '—' : signed(value, 1)}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-[11px] text-ink-subtle">{dict.assetDetail.performanceNote}</p>
    </div>
  )
}

function AveragesTab({ asset, dict }: { asset: MarketAsset; dict: Dictionary }) {
  const comparisons = compareWithAverages(asset.close, [
    { label: dict.assetDetail.ema10, value: asset.ema10 },
    { label: dict.assetDetail.ema20, value: asset.ema20 },
    { label: dict.assetDetail.ema50, value: asset.ema50 },
    { label: dict.assetDetail.sma50, value: asset.sma50 },
    { label: dict.assetDetail.sma200, value: asset.sma200 },
    { label: dict.assetDetail.vwap, value: asset.vwap },
  ])
  const above = comparisons.filter((item) => item.distancePct >= 0).length

  if (comparisons.length === 0) return <p className="text-[13px] text-ink-muted">{dict.assetDetail.noAveragesData}</p>

  // Splits "...{above} of {total}..." around its two placeholders so the count can keep its own <span> styling
  const [prefix, middle, suffix] = dict.assetDetail.priceAboveReferences.split(/\{above\}|\{total\}/)

  return (
    <div>
      <p className="mb-2 text-[13px] text-ink-muted">
        {prefix}
        <span className="text-ink">{above}</span>
        {middle}
        {comparisons.length}
        {suffix}
      </p>
      <table className="w-full max-w-2xl text-left">
        <caption className="sr-only">{dict.assetDetail.averagesCaption}</caption>
        <thead>
          <tr className="border-b border-hairline text-[12px] text-ink-muted">
            <th scope="col" className="py-2 font-normal">{dict.assetDetail.referenceLabel}</th>
            <th scope="col" className="py-2 text-right font-normal">{dict.assetDetail.valueLabel}</th>
            <th scope="col" className="py-2 text-right font-normal">{dict.assetDetail.priceVsLabel}</th>
          </tr>
        </thead>
        <tbody>
          {comparisons.map((item) => (
            <tr key={item.label} className="border-b border-hairline-soft last:border-b-0">
              <th scope="row" className="py-2.5 text-[13px] font-normal text-ink-muted">{item.label}</th>
              <td className="py-2.5 text-right text-[13px] tabular-nums text-ink">{formatPrice(item.value, asset.symbol)}</td>
              <td className={clsx('py-2.5 text-right text-[13px] tabular-nums', item.distancePct >= 0 ? 'text-semantic-success' : 'text-semantic-danger')}>
                {signed(item.distancePct)}
                <span className="ml-2 text-[12px] text-ink-muted">{item.distancePct >= 0 ? dict.assetDetail.aboveLabel : dict.assetDetail.belowLabel}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AssetDetailPanel({ asset, className }: AssetDetailPanelProps) {
  const dict = useDictionary()
  const [tab, setTab] = useState<Tab>('summary')
  const id = useId()

  const TABS: { key: Tab; label: string }[] = [
    { key: 'summary', label: dict.assetDetail.technicalSummaryTab },
    { key: 'performance', label: dict.assetDetail.performanceTab },
    { key: 'averages', label: dict.assetDetail.movingAveragesTab },
  ]
  const COMPANY_TAB: { key: Tab; label: string } = { key: 'company', label: dict.assetDetail.companyTab }

  if (!asset) return null

  const tabs = asset.category === 'stock' ? [...TABS, COMPANY_TAB] : TABS
  const activeTab = tabs.some((item) => item.key === tab) ? tab : 'summary'

  // Arrow keys move between tabs, as in any tab list
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((item) => item.key === activeTab)
    if (event.key === 'ArrowRight') setTab(tabs[(index + 1) % tabs.length].key)
    else if (event.key === 'ArrowLeft') setTab(tabs[(index - 1 + tabs.length) % tabs.length].key)
    else return
    event.preventDefault()
  }

  return (
    <section className={className} aria-label={t(dict.assetDetail.ariaLabel, { name: asset.name })}>
      <div role="tablist" aria-label={dict.assetDetail.tabsAriaLabel} className="flex gap-6 border-b border-hairline px-5" onKeyDown={onKeyDown}>
        {tabs.map((item) => (
          <button
            key={item.key}
            id={`${id}-${item.key}-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === item.key}
            aria-controls={`${id}-panel`}
            tabIndex={activeTab === item.key ? 0 : -1}
            onClick={() => setTab(item.key)}
            className={clsx(
              '-mb-px border-b-2 py-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
              activeTab === item.key ? 'border-accent-blue text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${activeTab}-tab`} className="p-5">
        {activeTab === 'summary' && <SummaryTab asset={asset} dict={dict} />}
        {activeTab === 'performance' && <PerformanceTab asset={asset} dict={dict} />}
        {activeTab === 'averages' && <AveragesTab asset={asset} dict={dict} />}
        {activeTab === 'company' && <CompanyTab symbol={asset.symbol.split(':').pop() || asset.symbol} dict={dict} />}
      </div>
    </section>
  )
}
