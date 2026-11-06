'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { t } from '@/lib/i18n/get-dictionary'
import { useDictionary, useLocale } from '@/lib/i18n/LocaleProvider'
import type { VersionListada } from '@/lib/historial'

// Historial de versiones del artículo abierto (idioma activo): cada cambio de título o texto guarda antes la versión anterior.
// «Restaurar» la devuelve; la versión que se sustituye también queda en el historial, así que se puede deshacer.

interface Props {
  open: boolean
  postId: string
  locale: 'es' | 'en'
  // Si hay cambios sin guardar en el formulario, restaurar los descarta: se avisa en la confirmación
  hayCambiosSinGuardar: boolean
  onClose: () => void
  onRestaurada: () => void
  askConfirm: (mensaje: string, opciones?: { title?: string; confirmLabel?: string }) => Promise<boolean>
  notify: (mensaje: string) => void
}

export function HistorialDialog({ open, postId, locale, hayCambiosSinGuardar, onClose, onRestaurada, askConfirm, notify }: Props) {
  const dict = useDictionary().cms
  const e = dict.edicion
  const { locale: idioma } = useLocale()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [versiones, setVersiones] = useState<VersionListada[] | null>(null)
  const [fallo, setFallo] = useState(false)
  const [ocupada, setOcupada] = useState<number | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const control = new AbortController()
    fetch(`/api/posts/historial?id=${encodeURIComponent(postId)}&locale=${locale}`, { signal: control.signal })
      .then(async (res) => ({ ok: res.ok, json: await res.json().catch(() => null) }))
      .then(({ ok, json }) => {
        if (!ok || !json?.success) {
          setFallo(true)
          setVersiones([])
        } else {
          setFallo(false)
          setVersiones(json.data as VersionListada[])
        }
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') {
          setFallo(true)
          setVersiones([])
        }
      })
    return () => {
      control.abort()
      setVersiones(null)
    }
  }, [open, postId, locale])

  async function restaurar(v: VersionListada) {
    const mensaje = e.historyRestoreConfirm + (hayCambiosSinGuardar ? ' ' + e.discardBody : '')
    if (!(await askConfirm(mensaje, { title: e.historyRestoreTitle, confirmLabel: e.historyRestore }))) return
    setOcupada(v.id)
    try {
      const res = await fetch('/api/posts/historial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: postId, version_id: v.id }) })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        notify(json?.error ?? e.historyFailed)
        return
      }
      notify(e.historyRestored)
      onRestaurada()
      onClose()
    } catch {
      notify(dict.connectionError)
    } finally {
      setOcupada(null)
    }
  }

  const fecha = (iso: string) => new Date(iso).toLocaleString(idioma === 'en' ? 'en-US' : 'es-AR', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(ev) => {
        ev.preventDefault()
        onClose()
      }}
      onClick={(ev) => {
        if (ev.target === ref.current) onClose()
      }}
      className="m-auto w-[min(94vw,40rem)] rounded-2xl border border-hairline bg-surface-1 p-0 text-ink shadow-2xl backdrop:bg-black/60"
    >
      <div className="flex max-h-[80vh] flex-col p-6">
        <h2 id={titleId} className="text-base font-bold text-ink">
          {e.historyTitle} · {locale.toUpperCase()}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{e.historyIntro}</p>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {versiones === null ? (
            <div aria-busy="true" className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} aria-hidden="true" className="h-16 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none" />
              ))}
            </div>
          ) : fallo ? (
            <p role="alert" className="rounded-lg border border-semantic-warning/30 bg-semantic-warning/10 px-3 py-2.5 text-sm text-ink">
              {e.historyFailed}
            </p>
          ) : versiones.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">{e.historyEmpty}</p>
          ) : (
            <ul className="space-y-2">
              {versiones.map((v) => (
                <li key={v.id} className="flex items-start gap-3 rounded-xl border border-hairline bg-surface-container-lowest p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] tabular-nums text-ink-muted">
                      {fecha(v.created_at)}
                      {v.editado_por ? ' · ' + t(e.historyBy, { quien: v.editado_por }) : ''}
                      {v.motivo === 'restauracion' ? ' · ' + e.historyBeforeRestore : ''}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-ink" title={v.title}>
                      {v.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-ink-muted">{v.resumen}</p>
                  </div>
                  <button
                    type="button"
                    disabled={ocupada !== null}
                    onClick={() => restaurar(v)}
                    className={clsx('shrink-0 rounded-lg bg-accent-blue/10 px-3 py-2 text-xs font-bold text-accent-blue-hover transition-colors hover:bg-accent-blue/20 disabled:opacity-60', 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue')}
                  >
                    {e.historyRestore}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" autoFocus onClick={onClose} className="rounded-lg border border-hairline px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue">
            {e.historyClose}
          </button>
        </div>
      </div>
    </dialog>
  )
}
