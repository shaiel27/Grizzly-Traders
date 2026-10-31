'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { EditorContent, Node, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type NodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useDictionary } from '@/lib/i18n/LocaleProvider'
import { t } from '@/lib/i18n/get-dictionary'
import { briefImageCount, briefWordCount } from '@/lib/brief'
import { countImagesWithoutAlt, needsSourceMode, normalizeEditorHtml } from '@/lib/rich-html'

// Editor de texto del CMS, a la manera de un procesador de textos: una hoja grande y centrada, barra de formato fija
// arriba, contador de palabras y pantalla completa. Las imágenes se pegan, se arrastran o se suben con el botón
// (POST /api/posts/upload-image). Guarda el mismo HTML de siempre: el servidor lo vuelve a sanear al publicar. Los
// textos con elementos que el editor no conoce se editan en HTML para no perderlos.

const ACCEPT = 'image/png,image/jpeg,image/webp'
const inputClass =
  'w-full rounded-lg border border-outline-variant bg-surface-1 px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-subtle focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/30'

interface UploadResult {
  url: string
  width: number
  height: number
}

async function uploadImage(file: File): Promise<UploadResult> {
  const form = new FormData()
  form.set('file', file)
  form.set('kind', 'inline')
  const response = await fetch('/api/posts/upload-image', { method: 'POST', body: form })
  const body = (await response.json().catch(() => null)) as { success?: boolean; error?: string; url?: string; width?: number; height?: number } | null
  if (!response.ok || !body?.success || !body.url) throw new Error(body?.error ?? 'upload failed')
  return { url: body.url, width: body.width ?? 0, height: body.height ?? 0 }
}

function FigureView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const dict = useDictionary().cms
  const attrs = node.attrs as { src: string; alt: string; caption: string }
  return (
    <NodeViewWrapper as="figure" className={clsx('my-8 rounded-xl p-2 transition-shadow', selected && 'ring-2 ring-accent-blue')} contentEditable={false}>
      {/* eslint-disable-next-line @next/next/no-img-element -- vista previa dentro del editor: la URL ya es del bucket público */}
      <img src={attrs.src} alt={attrs.alt} draggable={false} className="mx-auto max-h-[480px] w-full rounded-xl border border-hairline object-contain" />
      <div className="mt-3 grid gap-2 font-sans sm:grid-cols-[1fr_1fr_auto]">
        <input
          type="text"
          value={attrs.alt}
          onChange={(event) => updateAttributes({ alt: event.target.value })}
          placeholder={dict.editor.richAltLabel}
          aria-label={dict.editor.richAltLabel}
          className={clsx(inputClass, !attrs.alt.trim() && 'border-semantic-warning')}
        />
        <input
          type="text"
          value={attrs.caption}
          onChange={(event) => updateAttributes({ caption: event.target.value })}
          placeholder={dict.editor.richCaptionLabel}
          aria-label={dict.editor.richCaptionLabel}
          className={inputClass}
        />
        <button type="button" onClick={deleteNode} className="rounded-lg border border-outline-variant px-3 py-1.5 text-[13px] font-medium text-ink-muted hover:border-semantic-danger hover:text-semantic-danger">
          {dict.editor.richRemoveImage}
        </button>
      </div>
    </NodeViewWrapper>
  )
}

// Imagen con pie de foto: se guarda como <figure><img><figcaption>, que el saneador del servidor ya permite
const Figure = Node.create({
  name: 'figure',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { src: { default: null }, alt: { default: '' }, caption: { default: '' }, width: { default: null }, height: { default: null } }
  },
  parseHTML() {
    return [
      {
        tag: 'figure',
        getAttrs: (element) => {
          const img = (element as HTMLElement).querySelector('img')
          if (!img?.getAttribute('src')) return false
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt') ?? '',
            caption: (element as HTMLElement).querySelector('figcaption')?.textContent ?? '',
            width: img.getAttribute('width'),
            height: img.getAttribute('height'),
          }
        },
      },
      {
        tag: 'img[src]',
        getAttrs: (element) => {
          const img = element as HTMLElement
          return { src: img.getAttribute('src'), alt: img.getAttribute('alt') ?? '', caption: '', width: img.getAttribute('width'), height: img.getAttribute('height') }
        },
      },
    ]
  },
  renderHTML({ node }) {
    const { src, alt, caption, width, height } = node.attrs as { src: string; alt: string; caption: string; width: string | null; height: string | null }
    const img = ['img', { src, alt, ...(width ? { width } : {}), ...(height ? { height } : {}) }] as const
    return caption ? ['figure', img, ['figcaption', caption]] : ['figure', img]
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureView)
  },
})

interface RichEditorProps {
  id: string
  value: string
  onChange: (html: string) => void
  // Clases de borde/foco del contenedor (las mismas que el resto de campos del panel)
  fieldClass?: string
  placeholder?: string
  // Nombre accesible del cuadro de texto (por defecto, "Contenido")
  ariaLabel?: string
  // Mientras algo (p. ej. una generación) usa el texto, no se puede editar
  disabled?: boolean
  // Altura mínima de la hoja
  minHeightClass?: string
}

export function RichEditor({ id, value, onChange, fieldClass, placeholder, ariaLabel, disabled = false, minHeightClass = 'min-h-[70vh]' }: RichEditorProps) {
  const dict = useDictionary().cms
  const [source, setSource] = useState(() => needsSourceMode(value))
  const [fullscreen, setFullscreen] = useState(false)
  const [pending, setPending] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const lastEmitted = useRef(value)
  const uploadRef = useRef<(file: File, pos?: number) => void>(() => {})
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: false, HTMLAttributes: { rel: 'noopener noreferrer nofollow' } },
      }),
      Placeholder.configure({ placeholder: placeholder ?? dict.editor.richPlaceholder }),
      Figure,
    ],
    content: value,
    editorProps: {
      attributes: {
        id,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaLabel ?? dict.editor.contentLabel,
        class: `article-body prose prose-lg max-w-none ${minHeightClass} font-serif prose-p:leading-[1.85] prose-headings:font-serif focus:outline-none`,
      },
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith('image/'))
        if (!file) return false
        event.preventDefault()
        uploadRef.current(file)
        return true
      },
      handleDrop: (view, event) => {
        const file = Array.from(event.dataTransfer?.files ?? []).find((item) => item.type.startsWith('image/'))
        if (!file) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        uploadRef.current(file, pos)
        return true
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = normalizeEditorHtml(current.getHTML())
      lastEmitted.current = html
      onChangeRef.current(html)
    },
  })

  useEffect(() => {
    uploadRef.current = (file, pos) => {
      setUploadError('')
      setPending((n) => n + 1)
      uploadImage(file)
        .then(({ url, width, height }) => {
          const node = { type: 'figure', attrs: { src: url, alt: '', caption: '', width: width || null, height: height || null } }
          const chain = editor?.chain().focus()
          if (typeof pos === 'number') chain?.insertContentAt(pos, node).run()
          else chain?.insertContent(node).run()
          // Tras la imagen se puede seguir escribiendo: si la figura quedó al final, se deja un párrafo vacío debajo
          const doc = editor?.state.doc
          if (doc && doc.lastChild?.type.name === 'figure') editor?.commands.insertContentAt(doc.content.size, { type: 'paragraph' })
        })
        .catch(() => setUploadError(dict.editor.richUploadFailed))
        .finally(() => setPending((n) => n - 1))
    }
  }, [editor, dict.editor.richUploadFailed])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  // Cambios que no vienen de este editor (copiar imágenes a la otra versión, cargar otro artículo)
  useEffect(() => {
    if (!editor || source || value === lastEmitted.current) return
    lastEmitted.current = value
    editor.commands.setContent(value, { emitUpdate: false })
  }, [value, editor, source])

  // Pantalla completa: Esc la cierra y la página de debajo no se desplaza
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setFullscreen(false)
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [fullscreen])

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive('bold') ?? false,
      italic: current?.isActive('italic') ?? false,
      underline: current?.isActive('underline') ?? false,
      style: current?.isActive('heading', { level: 2 }) ? 'h2' : current?.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      bullets: current?.isActive('bulletList') ?? false,
      numbers: current?.isActive('orderedList') ?? false,
      quote: current?.isActive('blockquote') ?? false,
      link: current?.isActive('link') ?? false,
      canUndo: current?.can().undo() ?? false,
      canRedo: current?.can().redo() ?? false,
    }),
  })

  const setLink = () => {
    if (!editor) return
    const previous = (editor.getAttributes('link').href as string | undefined) ?? ''
    const answer = window.prompt(dict.editor.richLinkPrompt, previous)
    if (answer === null) return
    const href = answer.trim()
    if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else if (/^(https?:\/\/|mailto:)/i.test(href)) editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }

  const applyStyle = (style: string) => {
    if (!editor) return
    const chain = editor.chain().focus()
    if (style === 'p') chain.setParagraph().run()
    else chain.setHeading({ level: style === 'h2' ? 2 : 3 }).run()
  }

  const toggleSource = () => {
    if (source) {
      if (needsSourceMode(value)) return
      lastEmitted.current = value
      editor?.commands.setContent(value, { emitUpdate: false })
    }
    setSource(!source)
  }

  const sourceOnly = needsSourceMode(value)
  const missingAlt = countImagesWithoutAlt(value)
  const words = briefWordCount(value)
  const images = briefImageCount(value)
  const button = (active: boolean) =>
    clsx(
      'rounded-md px-2.5 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
      active ? 'bg-accent-blue/20 text-accent-blue' : 'text-ink-muted hover:bg-white/[0.06] hover:text-ink'
    )
  const divider = <span aria-hidden="true" className="mx-1 h-5 w-px bg-hairline" />

  return (
    <div
      className={clsx(
        fullscreen ? 'fixed inset-0 z-[100] flex flex-col bg-canvas' : 'rounded-xl bg-surface-2',
        disabled && 'pointer-events-none opacity-60',
        !fullscreen && fieldClass
      )}
      aria-disabled={disabled || undefined}
    >
      <div
        role="toolbar"
        aria-label={dict.editor.richToolbarAria}
        className={clsx(
          'z-30 flex flex-wrap items-center gap-1 border-b border-hairline bg-surface-2 px-3 py-2',
          fullscreen ? 'shrink-0' : 'sticky top-[var(--header-h-real,var(--header-height))] rounded-t-xl'
        )}
      >
        {!source && editor && (
          <>
            <select
              aria-label={dict.editor.richStyleLabel}
              value={state?.style ?? 'p'}
              onChange={(event) => applyStyle(event.target.value)}
              className="mr-1 rounded-md border border-outline-variant bg-surface-1 px-2 py-1.5 text-[13px] font-medium text-ink focus:border-accent-blue focus:outline-none"
            >
              <option value="p">{dict.editor.richStyleNormal}</option>
              <option value="h2">{dict.editor.richH2}</option>
              <option value="h3">{dict.editor.richH3}</option>
            </select>
            {divider}
            <button type="button" aria-pressed={state?.bold} onClick={() => editor.chain().focus().toggleBold().run()} className={clsx(button(!!state?.bold), 'font-bold')}>
              {dict.editor.richBold}
            </button>
            <button type="button" aria-pressed={state?.italic} onClick={() => editor.chain().focus().toggleItalic().run()} className={clsx(button(!!state?.italic), 'italic')}>
              {dict.editor.richItalic}
            </button>
            <button type="button" aria-pressed={state?.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} className={clsx(button(!!state?.underline), 'underline')}>
              {dict.editor.richUnderline}
            </button>
            {divider}
            <button type="button" aria-pressed={state?.bullets} onClick={() => editor.chain().focus().toggleBulletList().run()} className={button(!!state?.bullets)}>
              {dict.editor.richBullets}
            </button>
            <button type="button" aria-pressed={state?.numbers} onClick={() => editor.chain().focus().toggleOrderedList().run()} className={button(!!state?.numbers)}>
              {dict.editor.richNumbers}
            </button>
            <button type="button" aria-pressed={state?.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()} className={button(!!state?.quote)}>
              {dict.editor.richQuote}
            </button>
            <button type="button" aria-pressed={state?.link} onClick={setLink} className={button(!!state?.link)}>
              {dict.editor.richLink}
            </button>
            {divider}
            <button type="button" onClick={() => fileInput.current?.click()} className={clsx(button(false), 'bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 hover:text-accent-blue')}>
              {dict.editor.richImage}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) uploadRef.current(file)
                event.target.value = ''
              }}
            />
            {divider}
            <button type="button" disabled={!state?.canUndo} onClick={() => editor.chain().focus().undo().run()} className={button(false)}>
              {dict.editor.richUndo}
            </button>
            <button type="button" disabled={!state?.canRedo} onClick={() => editor.chain().focus().redo().run()} className={button(false)}>
              {dict.editor.richRedo}
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-1" role="group">
          <button type="button" aria-pressed={!source} disabled={sourceOnly} title={sourceOnly ? dict.editor.richSourceOnly : undefined} onClick={() => source && toggleSource()} className={button(!source)}>
            {dict.editor.richVisualMode}
          </button>
          <button type="button" aria-pressed={source} onClick={() => !source && toggleSource()} className={button(source)}>
            {dict.editor.richSourceMode}
          </button>
          {divider}
          <button type="button" aria-pressed={fullscreen} onClick={() => setFullscreen((v) => !v)} className={button(fullscreen)}>
            {fullscreen ? dict.editor.richExitFullscreen : dict.editor.richFullscreen}
          </button>
        </div>
      </div>

      {/* Hoja: fondo oscuro de la web y una página centrada, como un documento */}
      <div className={clsx('bg-surface-container-lowest px-3 py-6 sm:px-6 sm:py-8', fullscreen && 'min-h-0 flex-1 overflow-y-auto')}>
        {source ? (
          <textarea
            id={`${id}-source`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label={ariaLabel ?? dict.editor.contentLabel}
            placeholder={dict.editor.contentPlaceholder}
            rows={24}
            className="mx-auto block min-h-[60vh] w-full max-w-[860px] resize-y rounded-lg border border-hairline bg-surface-2 px-6 py-5 font-mono text-sm leading-relaxed text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        ) : (
          <div className="rich-editor mx-auto w-full max-w-[860px] rounded-lg border border-hairline bg-surface-2 px-6 py-8 shadow-[0_8px_40px_rgba(0,0,0,0.35)] sm:px-14 sm:py-12">
            <EditorContent editor={editor} />
          </div>
        )}
      </div>

      <div className={clsx('flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline-soft px-4 py-2 text-[12px] text-ink-muted', fullscreen && 'shrink-0 bg-surface-2')} aria-live="polite">
        <span className="tabular-nums">{t(dict.editor.richWords, { n: words })}</span>
        {images > 0 && <span className="tabular-nums">{t(dict.editor.richImages, { n: images })}</span>}
        {sourceOnly && <span className="text-semantic-warning">{dict.editor.richSourceOnly}</span>}
        {pending > 0 && <span>{dict.editor.richUploading}</span>}
        {uploadError && <span role="alert" className="font-medium text-semantic-danger">{uploadError}</span>}
        {missingAlt > 0 && <span className="text-semantic-warning">{t(dict.editor.richMissingAlt, { n: missingAlt })}</span>}
      </div>
    </div>
  )
}
