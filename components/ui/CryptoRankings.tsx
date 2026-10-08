'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { clsx } from 'clsx'
import { formatNumber, formatPrice } from '@/lib/format'
import { useDictionary } from '@/lib/i18n/LocaleProvider'

interface CryptoRanking {
  id: string
  rank: number
  symbol: string
  name: string
  image: string
  price: number
  change24h: number
  marketCap: number
  volume24h: number
}

export function CryptoRankings() {
  const dict = useDictionary()
  const [coins, setCoins] = useState<CryptoRanking[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [brokenIcons, setBrokenIcons] = useState<Set<string>>(new Set())

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/crypto-rankings', { signal: controller.signal })
      .then((response) => response.json())
      .then((body) => {
        if (body.success) setCoins(body.data)
        else setFailed(true)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [])

  if (failed || coins?.length === 0) return null

  return (
    <section aria-labelledby="rankings-heading">
      <h2 id="rankings-heading" className="text-[22px] font-semibold tracking-tight text-ink">
        {dict.cryptoRankings.title}
      </h2>
      <p className="mb-8 mt-1 max-w-2xl text-[14px] text-ink-muted">{dict.cryptoRankings.description}</p>

      {coins === null ? (
        <div role="status" aria-live="polite" className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left" aria-hidden="true">
            <thead>
              <tr className="border-b border-hairline text-[12px] text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-normal">#</th>
                <th scope="col" className="py-2 pr-4 font-normal">{dict.cryptoRankings.colName}</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">{dict.cryptoRankings.colPrice}</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">{dict.cryptoRankings.col24h}</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">{dict.cryptoRankings.colMarketCap}</th>
                <th scope="col" className="py-2 text-right font-normal">{dict.cryptoRankings.colVolume}</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-hairline-soft last:border-b-0">
                  <td className="py-2.5 pr-4">
                    <div className="h-3 w-4 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="flex items-center gap-2">
                      <span className="size-[18px] shrink-0 animate-pulse motion-reduce:animate-none rounded-full bg-surface-2" />
                      <span className="h-3 w-24 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <div className="ml-auto h-3 w-16 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <div className="ml-auto h-3 w-12 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <div className="ml-auto h-3 w-20 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="ml-auto h-3 w-20 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <span className="sr-only">{dict.cryptoRankings.loadingLabel}</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <caption className="sr-only">{dict.cryptoRankings.tableCaption}</caption>
            <thead>
              <tr className="border-b border-hairline text-[12px] text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-normal">#</th>
                <th scope="col" className="py-2 pr-4 font-normal">{dict.cryptoRankings.colName}</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">{dict.cryptoRankings.colPrice}</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">{dict.cryptoRankings.col24h}</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">{dict.cryptoRankings.colMarketCap}</th>
                <th scope="col" className="py-2 text-right font-normal">{dict.cryptoRankings.colVolume}</th>
              </tr>
            </thead>
            <tbody>
              {coins.map((coin) => (
                <tr key={coin.id} className="border-b border-hairline-soft last:border-b-0">
                  <td className="py-2.5 pr-4 text-[13px] tabular-nums text-ink-subtle">{coin.rank}</td>
                  <td className="py-2.5 pr-4">
                    <span className="flex items-center gap-2">
                      {brokenIcons.has(coin.id) || !coin.image ? (
                        <span
                          aria-hidden="true"
                          className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-[9px] font-semibold text-ink-subtle"
                        >
                          {coin.symbol.charAt(0)}
                        </span>
                      ) : (
                        <Image
                          src={coin.image}
                          alt=""
                          width={18}
                          height={18}
                          className="rounded-full"
                          onError={() => setBrokenIcons((prev) => new Set(prev).add(coin.id))}
                        />
                      )}
                      <span className="text-[13px] text-ink">{coin.name}</span>
                      <span className="text-[11px] text-ink-subtle">{coin.symbol}</span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-[13px] tabular-nums text-ink">{formatPrice(coin.price, '', { currency: true })}</td>
                  <td className={clsx('py-2.5 pr-4 text-right text-[13px] tabular-nums', coin.change24h >= 0 ? 'text-semantic-success' : 'text-semantic-danger')}>
                    {coin.change24h >= 0 ? '+' : ''}
                    {coin.change24h.toFixed(2)}%
                  </td>
                  <td className="py-2.5 pr-4 text-right text-[13px] tabular-nums text-ink-muted">{formatNumber(coin.marketCap, 0)}</td>
                  <td className="py-2.5 text-right text-[13px] tabular-nums text-ink-muted">{formatNumber(coin.volume24h, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-[11px] text-ink-subtle">{dict.cryptoRankings.source}</p>
    </section>
  )
}
