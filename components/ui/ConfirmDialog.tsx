'use client'

import { useEffect, useId, useRef } from 'react'

// Confirmación y avisos DENTRO de la página, en lugar de los cuadros nativos del navegador (confirm / alert): tienen el
// estilo del sitio, se leen en el idioma del sitio y no bloquean la pestaña. Usa el elemento <dialog> nativo, que ya
// atrapa el foco, cierra con Escape y marca el resto de la página como inerte.

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      // Escape: el navegador cierra el <dialog> solo; se avisa al padre para que su estado no quede desfasado
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      // Un clic en el fondo oscuro cancela; un clic dentro de la caja no
      onClick={(event) => {
        if (event.target === ref.current) onCancel()
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-hairline bg-surface-1 p-0 text-ink shadow-2xl backdrop:bg-black/60"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-base font-bold text-ink">
          {title}
        </h2>
        <p id={messageId} className="mt-2 text-sm leading-relaxed text-ink-muted">
          {message}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {/* El foco empieza en Cancelar: una acción destructiva nunca debe confirmarse con un Enter distraído */}
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="rounded-lg border border-hairline px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-semantic-danger px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-semantic-danger"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

interface NoticeProps {
  message: string
  closeLabel: string
  onClose: () => void
}

// Aviso de error en la parte baja de la pantalla; role="alert" para que el lector de pantalla lo anuncie y se cierra solo
export function Notice({ message, closeLabel, onClose }: NoticeProps) {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const timer = window.setTimeout(() => closeRef.current(), 8000)
    return () => window.clearTimeout(timer)
  }, [message])

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-md items-start gap-3 rounded-xl border border-semantic-danger/40 bg-surface-1 px-4 py-3 text-sm text-ink shadow-2xl"
    >
      <span className="material-symbols-outlined mt-0.5 text-[18px] text-semantic-danger" aria-hidden="true">
        error
      </span>
      <p className="min-w-0 flex-1 leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-blue"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          close
        </span>
      </button>
    </div>
  )
}
