export default function PivotPointsLoading() {
  return (
    <main className="flex-1 pt-[var(--header-height)] pb-24">
      <div className="section-container mx-auto max-w-[1400px] pt-8">
        <div role="status" aria-live="polite">
          <div aria-hidden="true">
            <div className="mb-8">
              <div className="mb-3 h-8 w-48 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
              <div className="h-4 w-full max-w-2xl animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
              <div className="mt-2 h-4 w-64 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
            </div>

            <div className="mb-6 h-24 animate-pulse motion-reduce:animate-none rounded-2xl border border-outline-variant/40 bg-surface-container-lowest" />

            {/* Two-column layout: asset list (1.35fr) + sticky asset panel (1fr), same grid as PivotPointsClient */}
            <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
                <div className="h-6 w-40 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
                <div className="mt-4 h-9 w-full animate-pulse motion-reduce:animate-none rounded-full bg-surface-2" />
                <div className="mt-4 space-y-2">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-10 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
                  ))}
                </div>
              </div>
              <div className="h-[560px] animate-pulse motion-reduce:animate-none rounded-2xl bg-surface-2" />
            </div>
          </div>
          <span className="sr-only">Cargando pivot points…</span>
        </div>
      </div>
    </main>
  )
}
