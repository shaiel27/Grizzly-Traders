import { Loading as LoadingComponent } from '@/components/ui'

export default function BuscarLoading() {
  return (
    <main className="flex-1 pt-[var(--header-height)] pb-24">
      <div className="section-container mb-8 pt-8" role="status" aria-live="polite">
        <div className="mb-2 h-10 w-72 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
        <div className="h-4 w-96 max-w-full animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
        <span className="sr-only">Cargando contenido…</span>
      </div>

      <div className="section-container mb-6" role="status" aria-live="polite">
        <div className="h-11 w-full max-w-2xl animate-pulse motion-reduce:animate-none rounded-full bg-surface-2" />
        <span className="sr-only">Cargando buscador…</span>
      </div>

      <div className="section-container">
        <LoadingComponent variant="cards" count={6} />
      </div>
    </main>
  )
}
