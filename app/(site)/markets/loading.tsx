export default function MarketsLoading() {
  return (
    <main className="flex-1 pt-[var(--header-height)] pb-24">
      <div className="mx-auto max-w-[1400px] px-6 pt-8 md:px-8">
        <div role="status" aria-live="polite">
          <div aria-hidden="true">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <div className="h-8 w-56 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
                <div className="mt-2 h-4 w-72 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
              </div>
              <div className="h-4 w-40 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
            </div>

            {/* Two-column terminal: watchlist sidebar (340px) + chart panel, same grid as MarketsClient */}
            <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-6">
              <div className="order-2 overflow-hidden rounded-[10px] border border-hairline bg-surface-container-lowest p-3 xl:order-1">
                <div className="h-9 w-full animate-pulse motion-reduce:animate-none rounded-[8px] bg-surface-1" />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-7 w-16 animate-pulse motion-reduce:animate-none rounded-[6px] bg-surface-1" />
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-10 animate-pulse motion-reduce:animate-none rounded bg-surface-1" />
                  ))}
                </div>
              </div>

              <div className="order-1 min-w-0 overflow-hidden rounded-[10px] border border-hairline bg-surface-container-lowest xl:order-2">
                <div className="flex items-center justify-between gap-3 border-b border-hairline p-4">
                  <div className="h-5 w-32 animate-pulse motion-reduce:animate-none rounded bg-surface-1" />
                  <div className="h-5 w-20 animate-pulse motion-reduce:animate-none rounded bg-surface-1" />
                </div>
                <div className="h-[440px] animate-pulse motion-reduce:animate-none bg-surface-1" />
              </div>
            </div>
          </div>
          <span className="sr-only">Cargando terminal de mercados…</span>
        </div>
      </div>
    </main>
  )
}
