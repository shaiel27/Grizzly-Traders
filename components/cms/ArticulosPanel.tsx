'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { t } from '@/lib/i18n/get-dictionary'
import { useDictionary, useLocale } from '@/lib/i18n/LocaleProvider'
import { hayFalta, totalPaginas, type Ambito, type ArticuloLista, type Conteos, type EstadoFiltro, type RespuestaLista, type TipoError } from '@/lib/cms-articulos'
import type { Category, Source } from '@/lib/types'

// Sección «Artículos» del CMS: tres ámbitos separados (mis artículos, automáticos y errores del pipeline) con búsqueda, filtros y
// paginación en el servidor. Ver lib/cms-articulos.ts y app/api/posts/list/route.ts.

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue'
const campo =
  'rounded-lg border border-hairline bg-surface-container-lowest px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent-blue focus:outline-none'

export interface ArticulosPanelProps {
  categories: Category[]
  sources: Source[]
  // Sube al recargar desde fuera (guardar, publicar, borrar…); `quiet` evita el parpadeo del esqueleto (seguimiento de «completando»)
  version: { n: number; quiet: boolean }
  editingId: string | null
  completando: Record<string, number>
  encabezado: ReactNode
  onEdit: (id: string) => void
  onToggleStatus: (id: string, estado: string) => void
  onToggleFeatured: (id: string, actual: boolean) => void
  onDelete: (id: string) => void
  onCompletar: (id: string) => void
  onCargada: (items: ArticuloLista[]) => void
  askConfirm: (mensaje: string, opciones?: { title?: string; confirmLabel?: string; cancelLabel?: string }) => Promise<boolean>
  // Tras pedir una portada nueva: sigue el artículo hasta que termine (igual que «Completar»)
  onSeguir: (id: string) => void
  notify: (mensaje: string) => void
}

interface Filtros {
  ambito: Ambito
  estado: EstadoFiltro
  q: string
  categoria: string
  fuente: string
  pagina: number
}
const FILTROS_INICIALES: Filtros = { ambito: 'mis', estado: 'todos', q: '', categoria: '', fuente: '', pagina: 1 }

function parametros(f: Filtros): string {
  const p = new URLSearchParams({ ambito: f.ambito, pagina: String(f.pagina) })
  if (f.estado !== 'todos') p.set('estado', f.estado)
  if (f.q) p.set('q', f.q)
  if (f.categoria) p.set('categoria', f.categoria)
  if (f.fuente && f.ambito === 'auto') p.set('fuente', f.fuente)
  return p.toString()
}

export function ArticulosPanel(props: ArticulosPanelProps) {
  const { categories, sources, version, editingId, completando, encabezado, onEdit, onToggleStatus, onToggleFeatured, onDelete, onCompletar, onCargada, askConfirm, notify, onSeguir } = props
  const dict = useDictionary().cms
  const { locale } = useLocale()
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const [busqueda, setBusqueda] = useState('')
  const [items, setItems] = useState<ArticuloLista[]>([])
  const [total, setTotal] = useState(0)
  const [conteos, setConteos] = useState<Conteos>({ mis: 0, auto: 0, errores: 0 })
  const [cargando, setCargando] = useState(true)
  // «Hace N días» se calcula al llegar la lista, no al pintar (pintar no puede depender del reloj)
  const [ahora, setAhora] = useState(0)
  const [fallo, setFallo] = useState(false)
  const [ocupados, setOcupados] = useState<Record<string, boolean>>({})
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [enLote, setEnLote] = useState(false)
  const ultimaVersion = useRef(version.n)
  const onCargadaRef = useRef(onCargada)
  useEffect(() => {
    onCargadaRef.current = onCargada
  })

  // La búsqueda espera a que se deje de escribir y vuelve a la página 1
  useEffect(() => {
    const espera = window.setTimeout(() => setFiltros((f) => (f.q === busqueda.trim() ? f : { ...f, q: busqueda.trim(), pagina: 1 })), 350)
    return () => window.clearTimeout(espera)
  }, [busqueda])

  const consulta = parametros(filtros)
  useEffect(() => {
    const silencioso = version.quiet && ultimaVersion.current !== version.n
    ultimaVersion.current = version.n
    const control = new AbortController()
    if (!silencioso) setCargando(true)
    fetch('/api/posts/list?' + consulta, { signal: control.signal })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          window.location.assign('/login')
          return null
        }
        return (await res.json()) as RespuestaLista
      })
      .then((r) => {
        if (!r) return
        if (!r.success) {
          setFallo(true)
          return
        }
        setFallo(false)
        // Si se vació la última página (p. ej. al borrar su único artículo), se vuelve a la última que queda
        const ultima = totalPaginas(r.total, r.porPagina)
        if (r.data.length === 0 && r.total > 0 && filtros.pagina > ultima) {
          setFiltros((f) => ({ ...f, pagina: ultima }))
          return
        }
        setItems(r.data)
        setSeleccion((sel) => sel.filter((id) => r.data.some((p) => p.id === id)))
        setAhora(Date.now())
        setTotal(r.total)
        setConteos(r.conteos)
        onCargadaRef.current(r.data)
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setFallo(true)
      })
      .finally(() => {
        if (!control.signal.aborted) setCargando(false)
      })
    return () => control.abort()
    // `filtros.pagina` ya va dentro de `consulta`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta, version.n])

  const cambiar = (cambio: Partial<Filtros>) => {
    setSeleccion([])
    setFiltros((f) => ({ ...f, ...cambio, pagina: cambio.pagina ?? 1 }))
  }
  const hayFiltros = filtros.estado !== 'todos' || filtros.q !== '' || filtros.categoria !== '' || filtros.fuente !== ''
  const quitarFiltros = () => {
    setSeleccion([])
    setBusqueda('')
    setFiltros((f) => ({ ...FILTROS_INICIALES, ambito: f.ambito }))
  }
  const paginas = totalPaginas(total)
  const recargar = () => setFiltros((f) => ({ ...f }))

  // ---- Acciones en lote y portada nueva
  const alternar = (id: string) => setSeleccion((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]))
  const todosMarcados = items.length > 0 && items.every((p) => seleccion.includes(p.id))

  async function lote(accion: 'publicar' | 'despublicar' | 'borrar') {
    const ids = seleccion
    const textos = {
      publicar: [t(dict.posts.bulkPublishConfirm, { n: ids.length }), dict.posts.bulkPublishTitle, dict.posts.bulkPublish],
      despublicar: [t(dict.posts.bulkUnpublishConfirm, { n: ids.length }), dict.posts.bulkUnpublishTitle, dict.posts.bulkUnpublish],
      borrar: [t(dict.posts.bulkDeleteConfirm, { n: ids.length }), undefined, undefined],
    }[accion]
    if (!(await askConfirm(textos[0] as string, textos[1] ? { title: textos[1], confirmLabel: textos[2] } : undefined))) return
    setEnLote(true)
    try {
      const res = await fetch('/api/posts/lote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, ids }) })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) notify(data?.error ?? dict.posts.bulkFailed)
      else notify(t(dict.posts.bulkDone, { n: data.data.cambiados, total: data.data.pedidos }))
    } catch {
      notify(dict.connectionError)
    } finally {
      setEnLote(false)
      setSeleccion([])
      recargar()
    }
  }

  async function nuevaPortada(id: string) {
    if (!(await askConfirm(dict.posts.newCoverConfirm, { title: dict.posts.newCoverTitle, confirmLabel: dict.posts.newCover }))) return
    try {
      const res = await fetch('/api/posts/regenerar-portada', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        notify(data?.error ?? dict.posts.newCoverFailed)
      } else {
        notify(dict.posts.newCoverStarted)
        onSeguir(id)
      }
    } catch {
      notify(dict.connectionError)
    } finally {
      recargar()
    }
  }

  // ---- Errores del pipeline
  async function accionError(id: string, accion: 'reintentar' | 'descartar') {
    if (accion === 'descartar' && !(await askConfirm(dict.posts.errDiscardConfirm))) return
    setOcupados((o) => ({ ...o, [id]: true }))
    try {
      const res = await fetch('/api/posts/errores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, id }) })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) notify(data?.error ?? dict.posts.errActionFailed)
      else if (accion === 'reintentar') notify(dict.posts.errRetried)
    } catch {
      notify(dict.connectionError)
    } finally {
      setOcupados((o) => ({ ...o, [id]: false }))
      recargar()
    }
  }

  async function limpiarAntiguos() {
    if (!(await askConfirm(dict.posts.errCleanConfirm))) return
    try {
      const res = await fetch('/api/posts/errores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'limpiar_antiguos' }) })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) notify(data?.error ?? dict.posts.errActionFailed)
      else notify(data.data.borradas > 0 ? t(dict.posts.errCleaned, { n: data.data.borradas }) : dict.posts.errCleanNone)
    } catch {
      notify(dict.connectionError)
    } finally {
      recargar()
    }
  }

  const fechaCorta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-AR') : dict.posts.noDate)
  const edad = (iso: string) => {
    const dias = Math.max(0, Math.floor((ahora - Date.parse(iso)) / 86_400_000))
    return dias <= 0 ? dict.posts.errAgeToday : t(dict.posts.errAge, { n: dias })
  }
  const etiquetaTipo = (tipo: TipoError | null | undefined) =>
    tipo === 'pendiente' ? dict.posts.errTypePendiente : tipo === 'duplicado' ? dict.posts.errTypeDuplicado : tipo === 'checklist' ? dict.posts.errTypeChecklist : dict.posts.errTypeFallo
  const vistaPrevia = (p: ArticuloLista) => (p.status === 'published' ? `/articulos/${p.translations.find((x) => x.locale === 'es')?.slug ?? p.translations[0]?.slug ?? p.slug}` : null)

  const segmentos: { id: Ambito; etiqueta: string; n: number }[] = [
    { id: 'mis', etiqueta: dict.posts.scopeMine, n: conteos.mis },
    { id: 'auto', etiqueta: dict.posts.scopeAuto, n: conteos.auto },
    { id: 'errores', etiqueta: dict.posts.scopeErrors, n: conteos.errores },
  ]
  const vacio = hayFiltros ? dict.posts.noResults : filtros.ambito === 'mis' ? dict.posts.emptyMine : filtros.ambito === 'auto' ? dict.posts.emptyAuto : dict.posts.emptyErrors

  return (
    <div>
      {encabezado}

      {/* Los tres ámbitos no se mezclan: lo escrito a mano nunca queda enterrado bajo las notas automáticas */}
      <div role="group" aria-label={dict.posts.scopeAria} className="mb-4 inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-hairline bg-surface-1 p-1">
        {segmentos.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={filtros.ambito === s.id}
            // Cada ámbito empieza limpio: un texto de búsqueda o un filtro de otro ámbito no debe quedar oculto y seguir aplicándose
            onClick={() => {
              setSeleccion([])
              setBusqueda('')
              setFiltros({ ...FILTROS_INICIALES, ambito: s.id })
            }}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-bold transition-colors',
              focusRing,
              filtros.ambito === s.id ? 'bg-accent-blue/15 text-accent-blue-hover' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
            )}
          >
            {s.etiqueta}
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-[11px] tabular-nums',
                s.id === 'errores' && s.n > 0 ? 'bg-semantic-warning/15 text-semantic-warning' : 'bg-surface-2 text-ink-muted'
              )}
            >
              {s.n}
            </span>
          </button>
        ))}
      </div>

      {/* Búsqueda y filtros */}
      {filtros.ambito !== 'errores' && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="cms-buscar" className="sr-only">
              {dict.posts.searchLabel}
            </label>
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-ink-subtle" aria-hidden="true">
                search
              </span>
              <input id="cms-buscar" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={dict.posts.searchPlaceholder} className={clsx(campo, 'w-full pl-9')} />
            </div>
          </div>
          <label className="text-[12px] font-bold text-ink-muted">
            <span className="mb-1 block">{dict.posts.filterStatus}</span>
            <select value={filtros.estado} onChange={(e) => cambiar({ estado: e.target.value as EstadoFiltro })} className={campo}>
              <option value="todos">{dict.posts.statusAll}</option>
              <option value="published">{dict.editor.statusPublished}</option>
              <option value="draft">{dict.editor.statusDraft}</option>
              <option value="scheduled">{dict.editor.statusScheduled}</option>
            </select>
          </label>
          <label className="text-[12px] font-bold text-ink-muted">
            <span className="mb-1 block">{dict.posts.filterCategory}</span>
            <select value={filtros.categoria} onChange={(e) => cambiar({ categoria: e.target.value })} className={campo}>
              <option value="">{dict.posts.categoryAll}</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {filtros.ambito === 'auto' && (
            <label className="text-[12px] font-bold text-ink-muted">
              <span className="mb-1 block">{dict.posts.filterSource}</span>
              <select value={filtros.fuente} onChange={(e) => cambiar({ fuente: e.target.value })} className={campo}>
                <option value="">{dict.posts.sourceAll}</option>
                {sources.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {hayFiltros && (
            <button type="button" onClick={quitarFiltros} className={clsx('rounded-lg px-3 py-2 text-sm font-bold text-accent-blue-hover hover:bg-accent-blue/10', focusRing)}>
              {dict.posts.clearFilters}
            </button>
          )}
        </div>
      )}

      {filtros.ambito === 'errores' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-4 py-3">
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-muted">{dict.posts.errorsIntro}</p>
          <button type="button" onClick={limpiarAntiguos} disabled={conteos.errores === 0} className={clsx('rounded-lg border border-hairline px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50', focusRing)}>
            {dict.posts.errCleanOld}
          </button>
        </div>
      )}

      {fallo && (
        <p role="alert" className="mb-4 rounded-lg border border-semantic-danger/40 bg-semantic-danger/10 px-3 py-2.5 text-sm text-ink">
          {dict.posts.listLoadFailed}{' '}
          <button type="button" onClick={recargar} className="font-bold underline">
            {dict.posts.errRetry}
          </button>
        </p>
      )}

      {cargando ? (
        <div className="space-y-2" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} aria-hidden="true" className="h-[88px] animate-pulse rounded-xl border border-hairline bg-surface-1 motion-reduce:animate-none" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant py-16 text-center">
          <span className="material-symbols-outlined mb-3 block text-5xl text-ink-subtle" aria-hidden="true">
            article
          </span>
          <p className="text-body text-ink-muted">{vacio}</p>
        </div>
      ) : (
        <>
          {filtros.ambito !== 'errores' && (
            <div className="mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-surface-1 px-4 py-2.5">
              <label className="flex items-center gap-2 text-[13px] font-bold text-ink-muted">
                <input type="checkbox" checked={todosMarcados} onChange={() => setSeleccion(todosMarcados ? [] : items.map((p) => p.id))} className="size-4 accent-[var(--color-accent-blue)]" />
                {seleccion.length > 0 ? t(dict.posts.selectedCount, { n: seleccion.length }) : dict.posts.selectAll}
              </label>
              {seleccion.length > 0 && (
                <div className="flex flex-wrap items-center gap-2" role="group">
                  <button type="button" disabled={enLote} onClick={() => lote('publicar')} className={clsx('rounded-lg bg-accent-blue/10 px-3 py-1.5 text-xs font-bold text-accent-blue-hover hover:bg-accent-blue/20 disabled:opacity-60', focusRing)}>
                    {dict.posts.bulkPublish}
                  </button>
                  <button type="button" disabled={enLote} onClick={() => lote('despublicar')} className={clsx('rounded-lg border border-hairline px-3 py-1.5 text-xs font-bold text-ink hover:bg-surface-2 disabled:opacity-60', focusRing)}>
                    {dict.posts.bulkUnpublish}
                  </button>
                  <button type="button" disabled={enLote} onClick={() => lote('borrar')} className={clsx('rounded-lg px-3 py-1.5 text-xs font-bold text-semantic-danger hover:bg-semantic-danger/10 disabled:opacity-60', focusRing)}>
                    {dict.posts.bulkDelete}
                  </button>
                  <button type="button" onClick={() => setSeleccion([])} className={clsx('rounded-lg px-2 py-1.5 text-xs font-bold text-ink-muted hover:underline', focusRing)}>
                    {dict.posts.bulkClear}
                  </button>
                </div>
              )}
            </div>
          )}
        <ul className="space-y-2">
          {items.map((post) =>
            filtros.ambito === 'errores' ? (
              <li key={post.id} className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-semantic-warning/30 bg-semantic-warning/10 px-2 py-0.5 text-[11px] font-bold text-semantic-warning">{etiquetaTipo(post.tipo_error)}</span>
                    {post.source && <span className="text-[12px] text-ink-muted">{t(dict.posts.sourceBadge, { name: post.source.name })}</span>}
                  </div>
                  <p className="truncate text-sm font-bold text-ink" title={post.title}>
                    {post.title}
                  </p>
                  <p className="mt-0.5 text-[12px] tabular-nums text-ink-muted">
                    {fechaCorta(post.created_at)} · {edad(post.created_at)}
                    {post.pipeline_attempts ? ` · ${t(dict.posts.errAttempts, { n: post.pipeline_attempts })}` : ''}
                  </p>
                  {post.pipeline_error && (
                    <p className="mt-1 line-clamp-2 break-words text-[12px] text-ink-muted" title={post.pipeline_error}>
                      {post.pipeline_error}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
                  {post.source_url && (
                    <a href={post.source_url} target="_blank" rel="noreferrer noopener" aria-label={dict.posts.errOpenSource} title={dict.posts.errOpenSource} className={clsx('rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-accent-blue-hover', focusRing)}>
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">open_in_new</span>
                    </a>
                  )}
                  {post.tipo_error === 'checklist' && (
                    <button type="button" onClick={() => onEdit(post.id)} className={clsx('flex items-center gap-1.5 rounded-lg bg-accent-blue/10 px-2.5 py-2 text-xs font-bold text-accent-blue-hover hover:bg-accent-blue/20', focusRing)}>
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
                      {dict.posts.edit}
                    </button>
                  )}
                  {(post.tipo_error === 'pendiente' || post.tipo_error === 'fallo') && (
                    <button type="button" disabled={ocupados[post.id]} onClick={() => accionError(post.id, 'reintentar')} className={clsx('rounded-lg bg-accent-blue/10 px-2.5 py-2 text-xs font-bold text-accent-blue-hover hover:bg-accent-blue/20 disabled:opacity-60', focusRing)}>
                      {dict.posts.errRetry}
                    </button>
                  )}
                  <button type="button" disabled={ocupados[post.id]} onClick={() => accionError(post.id, 'descartar')} className={clsx('flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-semantic-danger hover:bg-semantic-danger/10 disabled:opacity-60', focusRing)}>
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
                    {dict.posts.errDiscard}
                  </button>
                </div>
              </li>
            ) : (
              <FilaArticulo
                key={post.id}
                post={post}
                editando={editingId === post.id}
                enCurso={post.id in completando}
                ambito={filtros.ambito}
                href={vistaPrevia(post)}
                fecha={fechaCorta(post.published_at)}
                onEdit={onEdit}
                onToggleStatus={onToggleStatus}
                onToggleFeatured={onToggleFeatured}
                onDelete={onDelete}
                onCompletar={onCompletar}
                seleccionado={seleccion.includes(post.id)}
                onSeleccion={alternar}
                onNuevaPortada={nuevaPortada}
              />
            )
          )}
        </ul>
        </>
      )}

      {!cargando && total > 0 && (
        <nav aria-label={dict.posts.scopeAria} className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] tabular-nums text-ink-muted">{t(dict.posts.pageInfo, { page: filtros.pagina, pages: paginas, total })}</p>
          <div className="flex gap-2">
            <button type="button" disabled={filtros.pagina <= 1} onClick={() => cambiar({ pagina: filtros.pagina - 1 })} className={clsx('rounded-lg border border-hairline px-3.5 py-2 text-sm font-bold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40', focusRing)}>
              {dict.posts.pagePrev}
            </button>
            <button type="button" disabled={filtros.pagina >= paginas} onClick={() => cambiar({ pagina: filtros.pagina + 1 })} className={clsx('rounded-lg border border-hairline px-3.5 py-2 text-sm font-bold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40', focusRing)}>
              {dict.posts.pageNext}
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}

interface FilaProps {
  post: ArticuloLista
  editando: boolean
  enCurso: boolean
  ambito: Ambito
  href: string | null
  fecha: string
  onEdit: (id: string) => void
  onToggleStatus: (id: string, estado: string) => void
  onToggleFeatured: (id: string, actual: boolean) => void
  onDelete: (id: string) => void
  onCompletar: (id: string) => void
  seleccionado: boolean
  onSeleccion: (id: string) => void
  onNuevaPortada: (id: string) => void
}

function FilaArticulo({ post, editando, enCurso, ambito, href, fecha, onEdit, onToggleStatus, onToggleFeatured, onDelete, onCompletar, seleccionado, onSeleccion, onNuevaPortada }: FilaProps) {
  const dict = useDictionary().cms
  const f = post.faltantes
  const faltan = [f?.portada && dict.posts.missingCover, f?.categoria && dict.posts.missingCategory, f?.traduccion && dict.posts.missingTranslation].filter(Boolean)
  return (
    <li className={clsx('flex flex-col gap-3 rounded-xl border bg-surface-1 p-4 transition-colors sm:flex-row sm:items-center sm:gap-4', editando ? 'border-accent-blue/60' : 'border-hairline hover:border-outline-variant')}>
      <input
        type="checkbox"
        checked={seleccionado}
        onChange={() => onSeleccion(post.id)}
        aria-label={t(dict.posts.selectRow, { title: post.title })}
        className="size-4 shrink-0 self-start accent-[var(--color-accent-blue)] sm:self-center"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          {/* Pastilla con marca de forma además del color: publicado = punto lleno, programado = anillo, borrador = anillo punteado */}
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold',
              post.status === 'published' ? 'border-semantic-success/30 bg-semantic-success/10 text-semantic-success' : post.status === 'draft' ? 'border-outline-variant bg-surface-2 text-ink-muted' : 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue-hover'
            )}
          >
            <span aria-hidden="true" className={clsx('size-1.5 rounded-full', post.status === 'published' ? 'bg-current' : post.status === 'draft' ? 'border border-dashed border-current' : 'border border-current')} />
            {post.status === 'published' ? dict.editor.statusPublished : post.status === 'draft' ? dict.editor.statusDraft : dict.editor.statusScheduled}
          </span>
          {post.category && <span className="text-[12px] text-ink-muted">{post.category.name}</span>}
          {ambito === 'auto' && post.source && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">{t(dict.posts.sourceBadge, { name: post.source.name })}</span>}
        </div>
        <p className="truncate text-sm font-bold text-ink" title={post.title}>
          {post.title}
        </p>
        <p className="mt-0.5 text-[12px] tabular-nums text-ink-muted">
          {fecha} · {post.view_count} {dict.posts.viewsSuffix}
        </p>
        {hayFalta(f) && post.status === 'published' && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-semantic-warning/30 bg-semantic-warning/[0.07] px-3 py-2 text-[12px] leading-relaxed">
            <p className="min-w-0 flex-1 text-ink-muted">
              <span className="font-bold text-semantic-warning">{dict.posts.missingLabel}</span> {faltan.join(' · ')}
            </p>
            <button type="button" disabled={enCurso} onClick={() => onCompletar(post.id)} className={clsx('rounded-md bg-accent-blue/10 px-2.5 py-1 text-xs font-bold text-accent-blue-hover transition-colors hover:bg-accent-blue/20 disabled:cursor-wait disabled:opacity-60', focusRing)}>
              {enCurso ? dict.posts.completing : dict.posts.complete}
            </button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
        {/* Editar es la acción de casi todas las filas: tiene peso propio */}
        <button type="button" onClick={() => onEdit(post.id)} className={clsx('flex items-center gap-1.5 rounded-lg bg-accent-blue/10 px-2.5 py-2 text-accent-blue-hover transition-colors hover:bg-accent-blue/20', focusRing)}>
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
          <span className="text-xs font-bold">{dict.posts.edit}</span>
        </button>
        {post.status === 'published' && !f?.portada && (
          <button type="button" disabled={enCurso} onClick={() => onNuevaPortada(post.id)} aria-label={dict.posts.newCover} title={dict.posts.newCover} className={clsx('rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-accent-blue-hover disabled:opacity-50', focusRing)}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">auto_awesome</span>
          </button>
        )}
        <span className="mx-1 h-5 w-px bg-hairline" aria-hidden="true" />
        <button
          type="button"
          onClick={() => onToggleFeatured(post.id, post.is_featured)}
          aria-pressed={post.is_featured}
          aria-label={post.is_featured ? dict.posts.removeFeatured : dict.posts.markFeatured}
          title={post.is_featured ? dict.posts.removeFeatured : dict.posts.markFeatured}
          className={clsx('rounded-lg p-2 transition-colors', focusRing, post.is_featured ? 'bg-accent-blue/10 text-accent-blue-hover' : 'text-ink-muted hover:bg-surface-2 hover:text-ink')}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">star</span>
        </button>
        <button
          type="button"
          onClick={() => onToggleStatus(post.id, post.status)}
          aria-label={post.status === 'published' ? dict.posts.unpublish : dict.posts.publish}
          title={post.status === 'published' ? dict.posts.unpublish : dict.posts.publish}
          className={clsx('rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink', focusRing)}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{post.status === 'published' ? 'unpublished' : 'publish'}</span>
        </button>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" aria-label={dict.posts.viewArticle} title={dict.posts.viewArticle} className={clsx('rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-accent-blue-hover', focusRing)}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">open_in_new</span>
          </a>
        ) : (
          <span role="img" aria-label={dict.posts.onlyPublishedPreview} title={dict.posts.onlyPublishedPreview} className="cursor-not-allowed rounded-lg p-2 text-ink-subtle opacity-60">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">open_in_new</span>
          </span>
        )}
        <span className="mx-1 h-5 w-px bg-hairline" aria-hidden="true" />
        {/* Destructivo: separado del resto para que no se confunda con una fila de iconos neutros */}
        <button type="button" onClick={() => onDelete(post.id)} aria-label={dict.posts.delete} title={dict.posts.delete} className={clsx('rounded-lg p-2 text-semantic-danger transition-colors hover:bg-semantic-danger/10', focusRing)}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
        </button>
      </div>
    </li>
  )
}
