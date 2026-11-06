'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Header, Button, Card, Footer } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/i18n/get-dictionary'
import { copyFigures, figuresOf } from '@/lib/rich-html'
import { briefImageCount, briefTextLength, briefToPayload, MAX_BRIEF_IMAGES } from '@/lib/brief'
import { RichEditor } from './RichEditor'
import { ConfirmDialog, Notice } from './ConfirmDialog'
import { SubscribersPanel } from './SubscribersPanel'
import { useLocale, useDictionary } from '@/lib/i18n/LocaleProvider'
import type { Category, Tag, Asset, AssetType, Source } from '@/lib/types'

interface CMSPanelProps {
  initialCategories: Category[]
  initialTags: Tag[]
  initialAssets: Asset[]
  initialSources: Source[]
  initialAssetTypes: AssetType[]
}

interface PostListItem {
  id: string
  title: string
  slug: string
  status: string
  sentiment: string
  view_count: number
  published_at: string
  created_at: string
  is_featured: boolean
  category: { name: string; slug: string } | null
  author: { full_name: string } | null
  assets: { symbol: string; name: string }[]
  tags: { name: string; slug: string }[]
  translations: { locale: 'es' | 'en'; slug: string }[]
  // Escritos por el pipeline automatico: por que un borrador no se publico solo. Opcionales para
  // no romper si la API vieja aun no los manda.
  pipeline_error?: string | null
  pipeline_attempts?: number | null
  // Lo que le falta al artículo (portada, categoría, traducción): el CMS ofrece completarlo
  faltantes?: { portada: boolean; categoria: boolean; traduccion: boolean }
}

const hayFalta = (f?: PostListItem['faltantes']) => !!f && (f.portada || f.categoria || f.traduccion)

// `pipeline_error` llega con prefijo: `checklist:` = el checklist editorial lo rechazo (hay que
// corregir el contenido), `error:` = fallo tecnico (reintentar). Sin prefijo conocido se muestra
// tal cual como fallo tecnico, que es lo que pide accion del editor en cualquier caso.
function parsePipelineError(raw: string | null | undefined): { kind: 'checklist' | 'error'; reason: string } | null {
  const text = raw?.trim()
  if (!text) return null
  const match = /^(checklist|error)\s*:\s*/i.exec(text)
  if (!match) return { kind: 'error', reason: text }
  return { kind: match[1].toLowerCase() as 'checklist' | 'error', reason: text.slice(match[0].length).trim() }
}

type Locale = 'es' | 'en'
type TranslationDraft = { title: string; slug: string; content_html: string; meta_title: string; meta_description: string }

const EMPTY_TRANSLATION: TranslationDraft = { title: '', slug: '', content_html: '', meta_title: '', meta_description: '' }
const EMPTY_TRANSLATIONS: Record<Locale, TranslationDraft> = { es: { ...EMPTY_TRANSLATION }, en: { ...EMPTY_TRANSLATION } }

const EMPTY_POST_DATA = {
  locale: 'es' as Locale,
  sentiment: 'neutral' as 'bullish' | 'bearish' | 'neutral',
  cover_image_url: '',
  og_image_url: '',
  source_url: '',
  source_id: '',
  status: 'draft' as 'draft' | 'published' | 'scheduled',
  scheduled_at: '',
  category_id: '',
  asset_ids: [] as string[],
  tag_ids: [] as string[],
  is_featured: false,
}

// ---- Assisted mode ----

// Los cinco pasos del flujo editorial, en el orden en que n8n los ejecuta. El webhook solo
// informa el paso cuando algo se rompe (`etapa`): no hay forma de saber en cual va mientras
// corre (una sola llamada sincrona, sin progreso intermedio). Esta lista nombra el paso DESPUES
// de que el error ya lo trajo.
type Stage = 'analisis' | 'imagen' | 'storage' | 'insercion' | 'traduccion'

// Durante la espera (30-90 s tipicos) si se muestran etapas, pero ESTIMADAS por tiempo
// transcurrido y rotuladas como tales en pantalla: nunca un porcentaje ni un "paso 2 de 5"
// presentado como dato. Los cortes salen de la duracion habitual de cada tramo (redaccion GPT,
// portada, insercion + traduccion). Pasado ASSIST_SLOW_MS se avisa de que va lento.
type ProgressStage = 'redaccion' | 'portada' | 'guardado' | 'traduccion'
const PROGRESS_STAGES: readonly { key: ProgressStage; fromMs: number }[] = [
  { key: 'redaccion', fromMs: 0 },
  { key: 'portada', fromMs: 20_000 },
  { key: 'guardado', fromMs: 50_000 },
  { key: 'traduccion', fromMs: 60_000 },
]
const ASSIST_SLOW_MS = 95_000

function progressIndex(elapsedMs: number): number {
  let index = 0
  PROGRESS_STAGES.forEach((stage, i) => {
    if (elapsedMs >= stage.fromMs) index = i
  })
  return index
}

// Same cut-off the server applies to the webhook (app/api/posts/asistir). What the panel promises
// on screen is the real server limit, not a guess at how long generation usually takes.
const ASSIST_MAX_MS = 150_000
const BODY_MIN_CHARS = 200
const EMPTY_BRIEF = { titular: '', cuerpo: '', destacar: false }

type AssistState =
  | { phase: 'idle' }
  | { phase: 'running'; startedAt: number }
  | { phase: 'error'; message: string; detail: string | null; stage: Stage | null; timedOut: boolean }
  | { phase: 'done'; postId: string; slug: string | null; original: Locale | null; locales: Locale[] }

// The three the form knows about. An assisted draft is written straight into the table by n8n, so a
// status the select has no option for would render blank and fail validation on save.
const KNOWN_STATUSES = new Set(['draft', 'published', 'scheduled'])

function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// Auto-generate a slug from a title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Borde de campo a outline-variant entero (antes /40, casi invisible sobre surface-2): el
// contorno es lo que dice "aqui se escribe". Hover lo aclara, focus lo pinta de accent-blue con
// anillo, y disabled baja opacidad Y cambia el cursor (el color no es el unico canal).
const fieldStateClass =
  'border border-outline-variant transition-[border-color,box-shadow] duration-150 hover:border-ink-subtle focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-outline-variant'
// Contenedor del editor visual: el foco lo recibe el texto de dentro, así que el anillo va con focus-within
const richFieldClass =
  'border border-outline-variant transition-[border-color,box-shadow] duration-150 hover:border-ink-subtle focus-within:border-accent-blue focus-within:ring-2 focus-within:ring-accent-blue/30'
const inputClass = `w-full rounded-xl bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-subtle ${fieldStateClass}`
const labelClass = 'text-micro font-bold text-ink-muted uppercase tracking-wider block mb-2'
// Anillo de foco de teclado para todo lo clicable del panel que no es un <Button>: mismo patron
// (outline 2px accent-blue) que AssetTable/MarketChart.
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue'
const segmentClass = (active: boolean) =>
  clsx(
    'flex items-center gap-2 rounded-lg font-bold transition-colors duration-150',
    focusRing,
    active ? 'bg-surface-container-lowest text-ink shadow-sm' : 'text-ink-muted hover:bg-surface-container-high/60 hover:text-ink'
  )

// Iconos nuevos en SVG inline: la fuente de Material Symbols del sitio es un subset generado
// (`pnpm icons`) y un nombre que no este dentro se pinta como TEXTO — eso era lo que pasaba con
// `progress_activity` en el boton de generar (la palabra girando en diagonal sobre el panel).
function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={clsx('size-4 animate-spin motion-reduce:animate-none', className)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// Chip de seleccion multiple (activos, tags): aria-pressed + check visible al estar marcado,
// asi la seleccion no depende solo del azul.
function ToggleChip({ selected, onToggle, children }: { selected: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={clsx(
        'inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors duration-150',
        focusRing,
        selected
          ? 'border-accent-blue bg-accent-blue/15 text-accent-blue-hover'
          : 'border-hairline bg-surface-2 text-ink-muted hover:border-outline-variant hover:text-ink'
      )}
    >
      {selected && <StatusIcon kind="check" className="-ml-0.5 size-3" />}
      {children}
    </button>
  )
}

function StatusIcon({ kind, className }: { kind: 'error' | 'warning' | 'check'; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={clsx('size-4 shrink-0', className)}>
      {kind === 'check' ? (
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      ) : kind === 'warning' ? (
        <>
          <path d="M12 3.5l9.5 16.5h-19z" />
          <path d="M12 10v4.5M12 17.5v.01" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5M12 16.5v.01" />
        </>
      )}
    </svg>
  )
}

export function CMSPanel({ initialCategories, initialTags, initialAssets, initialSources, initialAssetTypes }: CMSPanelProps) {
  const { locale } = useLocale()
  const dict = useDictionary().cms
  const [activeTab, setActiveTab] = useState<'editor' | 'posts' | 'subscribers' | 'settings'>('editor')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [pipelineRunning, setPipelineRunning] = useState(false)
  const [pipelineMsg, setPipelineMsg] = useState('')
  const [automation, setAutomation] = useState<{ configured: boolean; active: boolean | null; loading: boolean; toggling: boolean }>({
    configured: false,
    active: null,
    loading: true,
    toggling: false,
  })
  const [postsList, setPostsList] = useState<PostListItem[]>([])
  // Confirmaciones y avisos dentro de la página (en vez de confirm()/alert() del navegador)
  const [dialog, setDialog] = useState<{ message: string; resolve: (ok: boolean) => void } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const askConfirm = (message: string) => new Promise<boolean>((resolve) => setDialog({ message, resolve }))
  const closeDialog = (ok: boolean) => {
    dialog?.resolve(ok)
    setDialog(null)
  }
  const notify = (message: string) => setNotice(message)
  // Artículos que se están completando en segundo plano (id -> cuándo empezó). Mientras haya alguno se consulta la lista.
  const [completando, setCompletando] = useState<Record<string, number>>({})
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [postData, setPostData] = useState(EMPTY_POST_DATA)
  const [translations, setTranslations] = useState<Record<Locale, TranslationDraft>>(EMPTY_TRANSLATIONS)

  // Assisted mode is the way in for a new article: two fields and the pipeline writes the rest.
  // Editing an existing post is always manual — there is nothing left to generate.
  const [mode, setMode] = useState<'assisted' | 'manual'>('assisted')
  const [brief, setBrief] = useState(EMPTY_BRIEF)
  const [assist, setAssist] = useState<AssistState>({ phase: 'idle' })
  const [assistElapsed, setAssistElapsed] = useState(0)
  const generatingRef = useRef(false)
  const fieldId = useId()
  const [assistant, setAssistant] = useState<{ configured: boolean; loading: boolean }>({ configured: false, loading: true })
  const [coverFailedUrl, setCoverFailedUrl] = useState('')

  // Catalogs start from the server snapshot; settings CRUD keeps its own copy in sync locally
  const [categories, setCategories] = useState(initialCategories)
  const [tags, setTags] = useState(initialTags)
  const [assets, setAssets] = useState(initialAssets)
  const [sources, setSources] = useState(initialSources)

  const current = translations[postData.locale]
  const assistDict = dict.assist
  // Un Record (no un array con .find) para que TypeScript obligue a tener las 5 etiquetas: si el
  // backend añade un Stage nuevo algun dia, falta aqui es un error de tipo, no un hueco en runtime.
  const STAGE_LABELS: Record<Stage, string> = {
    analisis: assistDict.stageAnalisis,
    imagen: assistDict.stageImagen,
    storage: assistDict.stageStorage,
    insercion: assistDict.stageInsercion,
    traduccion: assistDict.stageTraduccion,
  }
  const PROGRESS_LABELS: Record<ProgressStage, string> = {
    redaccion: assistDict.progressRedaccion,
    portada: assistDict.progressPortada,
    guardado: assistDict.progressGuardado,
    traduccion: assistDict.progressTraduccion,
  }
  const assistRunning = assist.phase === 'running'
  const progressAt = progressIndex(assistElapsed)
  const assistSlow = assistRunning && assistElapsed >= ASSIST_SLOW_MS
  const assistMaxLabel = formatClock(ASSIST_MAX_MS)
  const editorMode: 'assisted' | 'manual' = editingId ? 'manual' : mode
  const bodyLength = briefTextLength(brief.cuerpo)
  const briefImages = briefImageCount(brief.cuerpo)
  const briefReady = brief.titular.trim().length > 0 && bodyLength >= BODY_MIN_CHARS && briefImages <= MAX_BRIEF_IMAGES
  // The success banner replaces the generic "editing an existing article" one while the draft the
  // assistant just produced is the one loaded in the form.
  const generatedDraft = assist.phase === 'done' && editingId === assist.postId ? assist : null

  // Load posts list
  const loadPosts = async (quiet = false) => {
    if (!quiet) setLoadingPosts(true)
    try {
      const res = await fetch('/api/posts/list')
      if (res.status === 401 || res.status === 403) {
        window.location.assign('/login')
        return
      }
      const data = await res.json()
      if (data.success) {
        setPostsList(data.data)
        // El seguimiento de "completando" termina cuando ya no falta nada o pasan 6 minutos
        setCompletando((prev) => {
          const next = { ...prev }
          for (const id of Object.keys(prev)) {
            const post = (data.data as PostListItem[]).find((p) => p.id === id)
            if (!post || !hayFalta(post.faltantes) || Date.now() - prev[id] > 6 * 60_000) delete next[id]
          }
          return Object.keys(next).length === Object.keys(prev).length ? prev : next
        })
      }
    } catch (e) {
      console.error('Failed to load posts:', e)
    } finally {
      setLoadingPosts(false)
    }
  }

  const iniciarSeguimiento = (id: string) => setCompletando((prev) => ({ ...prev, [id]: Date.now() }))

  // Mientras se completa algo, la lista se refresca sola; el seguimiento termina cuando ya no falta nada o pasan 6 minutos
  const seguimientoActivo = Object.keys(completando).length > 0
  useEffect(() => {
    if (!seguimientoActivo) return
    const timer = window.setInterval(() => void loadPosts(true), 12_000)
    return () => window.clearInterval(timer)
  }, [seguimientoActivo])
  const handleCompletar = async (id: string) => {
    iniciarSeguimiento(id)
    const quitar = () => setCompletando((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id)))
    try {
      const res = await fetch('/api/posts/completar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.status === 401 || res.status === 403) {
        window.location.assign('/login')
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        notify(data?.error ?? dict.genericActionError)
        quitar()
      }
    } catch (e) {
      console.error('Complete post error:', e)
      notify(dict.connectionError)
      quitar()
    }
  }

  const selectTab = (tab: 'editor' | 'posts' | 'subscribers' | 'settings') => {
    setActiveTab(tab)
    if (tab === 'posts') loadPosts()
  }

  // Automation state is fetched once on mount so the switch is ready before the Posts tab is opened
  useEffect(() => {
    fetch('/api/automation/status')
      .then((res) => res.json())
      .then((data) => setAutomation((prev) => ({ ...prev, configured: !!data.configured, active: data.active ?? null, loading: false })))
      .catch(() => setAutomation((prev) => ({ ...prev, loading: false })))
  }, [])

  // Whether the editorial webhook exists at all. Asked once on mount so the button can say "not
  // connected" up front instead of letting the editor wait out a two-minute call to nothing.
  useEffect(() => {
    fetch('/api/posts/asistir')
      .then((res) => res.json())
      .then((data) => setAssistant({ configured: !!data.configured, loading: false }))
      .catch(() => setAssistant({ configured: false, loading: false }))
  }, [])

  // The only progress signal that exists while the pipeline runs: real elapsed time.
  const runningSince = assist.phase === 'running' ? assist.startedAt : null
  useEffect(() => {
    if (runningSince === null) return
    // No sync setState here: handleGenerate already zeroes assistElapsed in the same tick it sets
    // phase to 'running', so the clock starts correct and the first tick below is the first update.
    const id = window.setInterval(() => setAssistElapsed(Date.now() - runningSince), 500)
    return () => window.clearInterval(id)
  }, [runningSince])

  const handleToggleAutomation = async () => {
    if (automation.active === null) return
    const nextActive = !automation.active
    setAutomation((prev) => ({ ...prev, toggling: true }))
    try {
      const res = await fetch('/api/automation/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextActive }),
      })
      const data = await res.json()
      if (data.success) {
        setAutomation((prev) => ({ ...prev, active: data.active }))
      } else {
        notify(data.error ?? dict.posts.automationToggleFailed)
      }
    } catch {
      notify(dict.connectionError)
    } finally {
      setAutomation((prev) => ({ ...prev, toggling: false }))
    }
  }

  const resetForm = () => {
    setPostData(EMPTY_POST_DATA)
    setTranslations(EMPTY_TRANSLATIONS)
    setEditingId(null)
    setSaveMsg('')
    setBrief(EMPTY_BRIEF)
    setAssist({ phase: 'idle' })
    setMode('assisted')
  }

  const handleTitleChange = (title: string) => {
    setTranslations((prev) => ({
      ...prev,
      [postData.locale]: { ...prev[postData.locale], title, slug: generateSlug(title) },
    }))
  }

  const [copyMsg, setCopyMsg] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverUploadError, setCoverUploadError] = useState('')

  // Pasa las imágenes de la versión que se está editando a la otra, al final del texto
  const copyImagesToOtherVersion = () => {
    const from = postData.locale
    const to: Locale = from === 'es' ? 'en' : 'es'
    const { html, added } = copyFigures(translations[from].content_html, translations[to].content_html)
    if (added > 0) setTranslations((prev) => ({ ...prev, [to]: { ...prev[to], content_html: html } }))
    setCopyMsg(added > 0 ? t(dict.editor.richCopyImagesDone, { n: added }) : dict.editor.richCopyImagesNone)
  }

  const uploadCover = async (file: File) => {
    setCoverUploadError('')
    setCoverUploading(true)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('kind', 'cover')
      const response = await fetch('/api/posts/upload-image', { method: 'POST', body: form })
      const body = (await response.json().catch(() => null)) as { success?: boolean; url?: string } | null
      if (!response.ok || !body?.success || !body.url) throw new Error('upload failed')
      setPostData((prev) => ({ ...prev, cover_image_url: body.url as string }))
      setCoverFailedUrl('')
    } catch {
      setCoverUploadError(dict.editor.coverUploadFailed)
    } finally {
      setCoverUploading(false)
    }
  }

  const updateTranslationField = (field: keyof TranslationDraft, value: string) => {
    setTranslations((prev) => ({ ...prev, [postData.locale]: { ...prev[postData.locale], [field]: value } }))
  }

  // Load a post's full data into the editor for editing. `preferLocale` matters for assisted
  // drafts: the original is the language the author actually wrote in, and that is the version
  // worth reviewing first — the other one is a machine translation of it.
  const handleEditPost = async (id: string, preferLocale?: Locale) => {
    setLoadingEdit(true)
    setSaveMsg('')
    try {
      const res = await fetch(`/api/posts/manage?id=${encodeURIComponent(id)}`)
      if (res.status === 401 || res.status === 403) {
        window.location.assign('/login')
        return
      }
      const data = await res.json()
      if (!data.success) {
        notify(data.error ?? dict.editor.loadPostFailed)
        return
      }

      const post = data.data as {
        sentiment: string | null
        cover_image_url: string | null
        og_image_url: string | null
        source_url: string | null
        source_id: number | null
        status: 'draft' | 'published' | 'scheduled'
        scheduled_at: string | null
        category_id: number | null
        is_featured: boolean
        asset_ids: number[]
        tag_ids: number[]
        translations: { locale: Locale; title: string; slug: string; content_html: string; meta_title: string | null; meta_description: string | null }[]
      }

      const nextTranslations: Record<Locale, TranslationDraft> = { es: { ...EMPTY_TRANSLATION }, en: { ...EMPTY_TRANSLATION } }
      for (const t of post.translations) {
        nextTranslations[t.locale] = {
          title: t.title,
          slug: t.slug,
          content_html: t.content_html,
          meta_title: t.meta_title ?? '',
          meta_description: t.meta_description ?? '',
        }
      }
      const preferred = preferLocale && post.translations.some((t) => t.locale === preferLocale) ? preferLocale : null
      const availableLocale =
        preferred ?? (post.translations.find((t) => t.locale === 'es') ? 'es' : (post.translations[0]?.locale ?? 'es'))

      setTranslations(nextTranslations)
      setPostData({
        locale: availableLocale,
        sentiment: (post.sentiment as 'bullish' | 'bearish' | 'neutral') ?? 'neutral',
        cover_image_url: post.cover_image_url ?? '',
        og_image_url: post.og_image_url ?? '',
        source_url: post.source_url ?? '',
        source_id: post.source_id ? String(post.source_id) : '',
        status: KNOWN_STATUSES.has(post.status) ? post.status : 'draft',
        scheduled_at: post.scheduled_at ? post.scheduled_at.slice(0, 16) : '',
        category_id: post.category_id ? String(post.category_id) : '',
        asset_ids: post.asset_ids.map(String),
        tag_ids: post.tag_ids.map(String),
        is_featured: post.is_featured,
      })
      setEditingId(id)
      setActiveTab('editor')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      console.error('Failed to load post for edit:', e)
      notify(dict.connectionError)
    } finally {
      setLoadingEdit(false)
    }
  }

  // Generate a draft from the two brief fields. The call is slow by design (analysis, cover image,
  // insert, translation) and answers once, at the end.
  const handleGenerate = async () => {
    // Guarda sincrona: `assist.phase` no cambia hasta el proximo render, asi que un doble clic
    // (o clic + Reintentar) en el mismo tick pasaria dos veces el chequeo de estado y pagaria
    // dos generaciones. El ref se marca antes de cualquier await.
    if (generatingRef.current || assist.phase === 'running' || !briefReady) return
    generatingRef.current = true
    setAssist({ phase: 'running', startedAt: Date.now() })
    setAssistElapsed(0)

    try {
      const res = await fetch('/api/posts/asistir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titular: brief.titular, destacado: brief.destacar, ...briefToPayload(brief.cuerpo) }),
      })
      if (res.status === 401 || res.status === 403) {
        window.location.assign('/login')
        return
      }
      const data = await res.json().catch(() => null)

      if (!data?.success) {
        // Failures this panel knows by code get translated copy. A failure reported by the pipeline
        // keeps its own wording: it is written for the editor and says more than a generic line.
        const byCode: Record<string, string> = {
          no_configurado: assistDict.notConfigured,
          ocupado: assistDict.errorBusy,
          timeout: t(assistDict.errorTimeout, { max: assistMaxLabel }),
          webhook_caido: assistDict.errorUnreachable,
          webhook_inactivo: assistDict.errorInactive,
          respuesta_invalida: assistDict.errorOffContract,
        }
        setAssist({
          phase: 'error',
          message: byCode[data?.code ?? ''] ?? data?.error ?? dict.connectionError,
          detail: data?.detalle ?? null,
          stage: (data?.etapa as Stage | null) ?? null,
          timedOut: data?.code === 'timeout',
        })
        return
      }

      const result = data.data as {
        post_id: string
        slug: string | null
        original_locale: Locale | null
        traducciones: Locale[]
        destacado?: boolean
      }
      if (brief.destacar && !result.destacado) notify(assistDict.featuredFailed)
      setAssist({
        phase: 'done',
        postId: result.post_id,
        slug: result.slug,
        original: result.original_locale,
        locales: result.traducciones ?? [],
      })
      setBrief(EMPTY_BRIEF)
      setMode('manual')
      // The draft already exists in the table, so loading it hands the editor the form they use
      // every day: every generated field editable, and the publish flow untouched.
      await handleEditPost(result.post_id, result.original_locale ?? undefined)
    } catch {
      setAssist({ phase: 'error', message: dict.connectionError, detail: null, stage: null, timedOut: false })
    } finally {
      generatingRef.current = false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Assisted mode has no submit button; this only catches the browser's implicit submit on Enter,
    // which must never fire a save of an empty manual form.
    if (editorMode === 'assisted') return
    if (!current.title || !current.content_html) {
      setSaveMsg(dict.editor.titleAndContentRequired)
      return
    }

    setSaving(true)
    setSaveMsg('')

    try {
      const payload = { ...postData, ...current }
      const url = editingId ? '/api/posts/manage' : '/api/posts/publish'
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId ? { ...payload, id: editingId } : payload

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.success) {
        // Lo que falte (portada, categoría, traducción) se completa en segundo plano: se avisa y se sigue en la lista
        const completar = hayFalta(data.data?.completando) && data.data?.id
        setSaveMsg(`✓ ${data.message}${completar ? ` · ${dict.editor.completingNote}` : ''}`)
        if (completar) iniciarSeguimiento(data.data.id)
        if (!editingId && postData.status === 'published') resetForm()
      } else {
        setSaveMsg(`✗ ${data.error}`)
      }
    } catch {
      setSaveMsg(`✗ ${dict.connectionError}`)
    } finally {
      setSaving(false)
    }
  }

  const manageRequest = async (url: string, init: RequestInit) => {
    try {
      const res = await fetch(url, init)
      if (res.status === 401 || res.status === 403) {
        window.location.assign('/login')
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        notify(data?.error ?? dict.genericActionError)
        return
      }
      // Publicar desde la lista también completa lo que falte
      if (hayFalta(data.data?.completando) && typeof init.body === 'string') iniciarSeguimiento(String(JSON.parse(init.body).id))
      loadPosts()
    } catch (e) {
      console.error('Manage request error:', e)
      notify(dict.connectionError)
    }
  }

  const handleDeletePost = async (id: string) => {
    if (!(await askConfirm(dict.posts.confirmDeletePost))) return
    if (editingId === id) resetForm()
    await manageRequest(`/api/posts/manage?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published'
    await manageRequest('/api/posts/manage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
  }

  const handleToggleFeatured = async (id: string, current: boolean) => {
    await manageRequest('/api/posts/manage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_featured: !current }),
    })
  }

  const handleTriggerPipeline = async () => {
    setPipelineRunning(true)
    setPipelineMsg('')
    try {
      const res = await fetch('/api/posts/trigger-pipeline', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setPipelineMsg(t(dict.posts.pipelineRan, { id: data.executionId || dict.posts.naFallback }))
        setTimeout(() => loadPosts(), 5000)
      } else {
        setPipelineMsg(`✗ ${data.error}`)
      }
    } catch {
      setPipelineMsg(`✗ ${dict.connectionError}`)
    } finally {
      setPipelineRunning(false)
    }
  }

  const toggleArrayItem = (arr: string[], item: string) => {
    return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]
  }

  const handleSignOut = async () => {
    await createClient().auth.signOut()
    window.location.assign('/login')
  }

  // ---- Settings / catalog CRUD ----
  const createCatalogItem = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status === 401 || res.status === 403) {
      window.location.assign('/login')
      return null
    }
    const data = await res.json()
    if (!data.success) {
      notify(data.error ?? dict.settings.createFailed)
      return null
    }
    return data.data
  }

  const deleteCatalogItem = async (type: string, id: number, warnAboutUsage: boolean) => {
    const message = warnAboutUsage ? dict.settings.confirmDeleteWithUsage : dict.settings.confirmDeleteSimple
    if (!(await askConfirm(message))) return false
    const res = await fetch(`/api/catalog?type=${type}&id=${id}`, { method: 'DELETE' })
    if (res.status === 401 || res.status === 403) {
      window.location.assign('/login')
      return false
    }
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.success) {
      notify(data?.error ?? dict.settings.deleteFailed)
      return false
    }
    return true
  }

  const previewHref = (post: PostListItem) => {
    if (post.status !== 'published') return null
    const slug = post.translations.find((t) => t.locale === 'es')?.slug ?? post.translations[0]?.slug ?? post.slug
    return `/articulos/${slug}`
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Header />

      <main className="flex-1 pt-[var(--header-height)] pb-24">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8">
          {/* Tabs */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 pt-6">
            {/* No es un tablist ARIA completo (sin flechas/roving tabindex): botones con
                aria-pressed, que es lo que de verdad hacen y lo que el lector anuncia bien. */}
            <div className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-hairline bg-surface-2 p-1">
              {([
                { key: 'editor', label: dict.tabEditor, icon: 'edit' },
                { key: 'posts', label: dict.tabPosts, icon: 'article' },
                { key: 'subscribers', label: dict.tabSubscribers, icon: 'groups' },
                { key: 'settings', label: dict.tabSettings, icon: 'settings' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => selectTab(tab.key)}
                  aria-pressed={activeTab === tab.key}
                  className={clsx(segmentClass(activeTab === tab.key), 'shrink-0 px-3 py-2 text-sm sm:px-5 sm:py-2.5')}
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className={clsx('rounded-lg px-2 py-1.5 text-body-sm text-ink-muted transition-colors hover:text-ink', focusRing)}
            >
              {dict.signOut}
            </button>
          </div>

          {/* EDITOR TAB */}
          {activeTab === 'editor' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* What came back from the assistant, while that draft is the one in the form. It takes
                  the place of the generic "editing an existing article" strip rather than stacking
                  a second banner on top of it. */}
              {generatedDraft ? (
                <div
                  role="status"
                  className="flex flex-col gap-3 rounded-xl border border-semantic-success/40 bg-semantic-success/[0.07] px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-semantic-success/15 text-semantic-success">
                      <StatusIcon kind="check" className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink">{assistDict.successHeading}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{assistDict.successBody}</p>
                      <p className="mt-1.5 text-[12px] text-ink-muted">
                        {t(assistDict.successMeta, {
                          locale: (generatedDraft.original ?? '?').toUpperCase(),
                          locales: generatedDraft.locales.length > 0 ? generatedDraft.locales.join(' + ').toUpperCase() : '?',
                        })}
                      </p>
                      {generatedDraft.slug && (
                        <p className="truncate font-mono text-[12px] text-ink-muted">/articulos/{generatedDraft.slug}</p>
                      )}
                      {generatedDraft.locales.length < 2 && (
                        <p className="mt-2 flex items-start gap-1.5 text-[12px] font-bold text-semantic-warning">
                          <StatusIcon kind="warning" className="mt-px size-3.5" />
                          {assistDict.missingTranslation}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={resetForm} className="shrink-0 self-start">
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">auto_awesome</span>
                    {assistDict.anotherDraft}
                  </Button>
                </div>
              ) : editingId ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-blue/30 bg-accent-blue/5 px-4 py-3">
                  <span className="flex items-center gap-1.5 text-body-sm text-ink">
                    <span className="material-symbols-outlined text-[16px] text-accent-blue" aria-hidden="true">edit_note</span>
                    {dict.editor.editingExisting}
                  </span>
                  <button
                    type="button"
                    onClick={resetForm}
                    className={clsx('rounded-md text-body-sm font-bold text-accent-blue hover:underline', focusRing)}
                  >
                    {dict.editor.cancelNew}
                  </button>
                </div>
              ) : null}

              {/* Mode switch: only for a NEW article — editing an existing one is always manual,
                  there is nothing left to generate (comment on `mode`'s declaration above). */}
              {!editingId && !generatedDraft && (
                <div className="flex w-fit items-center gap-1 rounded-xl border border-hairline bg-surface-2 p-1">
                  {(['assisted', 'manual'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      aria-pressed={mode === m}
                      // Cambiar de modo a mitad de una generacion dejaria la espera corriendo sin
                      // nadie mirandola: el selector se bloquea hasta que n8n responda.
                      disabled={assistRunning}
                      className={clsx(segmentClass(mode === m), 'px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50')}
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{m === 'assisted' ? 'auto_awesome' : 'edit'}</span>
                      {m === 'assisted' ? assistDict.modeAssisted : assistDict.modeManual}
                    </button>
                  ))}
                </div>
              )}

              {editorMode === 'assisted' && !generatedDraft && (
                <div className="space-y-5 rounded-2xl border border-hairline bg-surface-1 p-5 sm:p-6" aria-busy={assistRunning}>
                  {!assistant.loading && !assistant.configured && (
                    <p className="flex items-start gap-2 rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 px-3 py-2.5 text-[13px] font-medium text-semantic-warning">
                      <StatusIcon kind="warning" className="mt-px" />
                      {assistDict.notConfigured}
                    </p>
                  )}

                  <div>
                    <label htmlFor={`${fieldId}-titular`} className={labelClass}>{assistDict.briefTitleLabel}</label>
                    <input
                      id={`${fieldId}-titular`}
                      type="text"
                      value={brief.titular}
                      onChange={(e) => setBrief((prev) => ({ ...prev, titular: e.target.value }))}
                      placeholder={assistDict.briefTitlePlaceholder}
                      disabled={assistRunning}
                      className={clsx('w-full rounded-xl bg-surface-container-lowest px-4 py-3 text-base font-bold text-ink placeholder:font-medium placeholder:text-ink-subtle', fieldStateClass)}
                    />
                  </div>

                  <div>
                    <label htmlFor={`${fieldId}-cuerpo`} className={labelClass}>{assistDict.briefBodyLabel}</label>
                    <RichEditor
                      id={`${fieldId}-cuerpo`}
                      value={brief.cuerpo}
                      onChange={(html) => setBrief((prev) => ({ ...prev, cuerpo: html }))}
                      placeholder={assistDict.briefBodyPlaceholder}
                      ariaLabel={assistDict.briefBodyLabel}
                      disabled={assistRunning}
                      minHeightClass="min-h-[55vh]"
                      fieldClass={richFieldClass}
                    />
                    {/* Icono + texto, no solo el color: el minimo cumplido se ve tambien en escala de grises. */}
                    <p
                      id={`${fieldId}-cuerpo-min`}
                      className={clsx(
                        'mt-1.5 flex items-center gap-1.5 text-[12px] tabular-nums',
                        bodyLength >= BODY_MIN_CHARS ? 'text-ink-muted' : 'text-semantic-warning'
                      )}
                    >
                      {bodyLength >= BODY_MIN_CHARS && <StatusIcon kind="check" className="size-3.5 text-semantic-success" />}
                      {t(assistDict.briefBodyMinChars, { count: bodyLength })}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-muted">{t(assistDict.briefImagesNote, { max: MAX_BRIEF_IMAGES })}</p>
                    {briefImages > MAX_BRIEF_IMAGES && (
                      <p role="alert" className="mt-1 text-[12px] font-medium text-semantic-danger">
                        {t(assistDict.briefImagesTooMany, { count: briefImages, max: MAX_BRIEF_IMAGES, extra: briefImages - MAX_BRIEF_IMAGES })}
                      </p>
                    )}
                  </div>

                  {assist.phase === 'error' && (
                    <div
                      role="alert"
                      className="flex flex-col gap-3 rounded-xl border border-semantic-danger/40 bg-semantic-danger/[0.07] px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <StatusIcon kind="error" className="mt-0.5 text-semantic-danger" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-ink">{assistDict.errorHeading}</p>
                          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{assist.message}</p>
                          {assist.stage && (
                            <p className="mt-1 text-[12px] text-ink-muted">{t(assistDict.errorStage, { stage: STAGE_LABELS[assist.stage] })}</p>
                          )}
                          {assist.detail && <p className="mt-1 break-words font-mono text-[12px] text-ink-muted">{assist.detail}</p>}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleGenerate}
                        disabled={!briefReady || !assistant.configured}
                        className="shrink-0 self-start"
                      >
                        {assistDict.errorRetry}
                      </Button>
                    </div>
                  )}

                  {/* Configuración del artículo antes de generarlo: hoy solo "destacar" */}
                  <fieldset className="space-y-2 border-t border-hairline pt-5" disabled={assistRunning}>
                    <legend className={labelClass}>{assistDict.settingsHeading}</legend>
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={brief.destacar}
                        onChange={(e) => setBrief((prev) => ({ ...prev, destacar: e.target.checked }))}
                        className="mt-0.5 h-4 w-4 rounded border-hairline bg-surface-2 accent-accent-blue"
                      />
                      <span>
                        <span className="block text-body-sm text-ink">{assistDict.featuredLabel}</span>
                        <span className="block text-[12px] text-ink-muted">{assistDict.featuredHint}</span>
                      </span>
                    </label>
                  </fieldset>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    {/* Durante la espera el boton NO se deshabilita con `disabled`: eso le quitaria el
                        foco al teclado justo al pulsarlo y el lector no oiria nada. aria-disabled lo
                        mantiene enfocable, handleGenerate ignora el clic (ref + fase) y aria-busy
                        anuncia que esta trabajando. */}
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleGenerate}
                      disabled={!assistRunning && (!briefReady || !assistant.configured)}
                      aria-disabled={assistRunning || undefined}
                      aria-busy={assistRunning || undefined}
                      className={clsx('w-full sm:w-auto', assistRunning && 'cursor-progress opacity-80 hover:shadow-none active:scale-100')}
                    >
                      {assistRunning ? (
                        <>
                          <Spinner />
                          {assistDict.generatingButton}
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">auto_awesome</span>
                          {assistDict.generateButton}
                        </>
                      )}
                    </Button>
                    {!assistRunning && (
                      <p className="text-[12px] leading-relaxed text-ink-muted">{t(assistDict.generatingHint, { max: assistMaxLabel })}</p>
                    )}
                  </div>

                  {assistRunning && (
                    <div className="rounded-xl border border-hairline bg-surface-container-lowest p-4">
                      {/* Lo que se anuncia: solo el cambio de etapa estimada (cada 15-30 s), nunca el
                          reloj, que cambiaria cada medio segundo. */}
                      <p role="status" className="sr-only">
                        {t(assistDict.progressSr, { stage: PROGRESS_LABELS[PROGRESS_STAGES[progressAt].key] })}
                      </p>

                      <div className="flex items-baseline justify-between gap-3" aria-hidden="true">
                        <p className="text-sm font-bold text-ink">{PROGRESS_LABELS[PROGRESS_STAGES[progressAt].key]}…</p>
                        <p className="shrink-0 font-mono text-[12px] tabular-nums text-ink-muted">
                          {formatClock(assistElapsed)} <span className="text-ink-subtle">/ {assistMaxLabel}</span>
                        </p>
                      </div>

                      {/* Barra indeterminada: dice "sigue vivo", no "va por el 40%". */}
                      <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                        <div className="cms-indeterminado absolute inset-y-0 left-0 w-2/5 rounded-full bg-gradient-to-r from-transparent via-accent-cyan to-transparent motion-reduce:animate-none" />
                      </div>

                      <ol className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4" aria-label={assistDict.progressListLabel}>
                        {PROGRESS_STAGES.map((stage, i) => {
                          const state = i < progressAt ? 'past' : i === progressAt ? 'current' : 'next'
                          return (
                            <li
                              key={stage.key}
                              aria-current={state === 'current' ? 'step' : undefined}
                              className={clsx(
                                'flex items-center gap-2 text-[12px]',
                                state === 'current' ? 'font-bold text-ink' : state === 'past' ? 'text-ink-muted' : 'text-ink-subtle'
                              )}
                            >
                              {/* Forma ademas de color: anillo vacio = pendiente, punto = estimado
                                  como hecho, punto con halo = etapa estimada actual. */}
                              <span
                                aria-hidden="true"
                                className={clsx(
                                  'relative flex size-2.5 shrink-0 rounded-full',
                                  state === 'current' && 'bg-accent-cyan',
                                  state === 'past' && 'bg-ink-muted',
                                  state === 'next' && 'border border-ink-subtle'
                                )}
                              >
                                {state === 'current' && (
                                  <span className="absolute inset-0 animate-ping rounded-full bg-accent-cyan/60 motion-reduce:animate-none" />
                                )}
                              </span>
                              {PROGRESS_LABELS[stage.key]}
                            </li>
                          )
                        })}
                      </ol>

                      <p className="mt-4 border-t border-hairline pt-3 text-[12px] leading-relaxed text-ink-muted">
                        {assistSlow ? t(assistDict.progressSlow, { max: assistMaxLabel }) : assistDict.progressEstimateNote}{' '}
                        {assistDict.progressKeepOpen}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {loadingEdit && (
                <div role="status" className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-1 px-4 py-3 text-body-sm text-ink-muted"><Spinner className="text-accent-blue" />
                  {dict.editor.loadingPost}
                </div>
              )}

              {editorMode === 'manual' && (
                <>
              {/* Locale Switcher */}
              <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby={`${fieldId}-lang`}>
                <span id={`${fieldId}-lang`} className={clsx(labelClass.replace('block mb-2', ''), 'mr-1')}>{dict.editor.languageLabel}</span>
                {(['es', 'en'] as const).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setPostData((prev) => ({ ...prev, locale: loc }))}
                    aria-pressed={postData.locale === loc}
                    className={clsx(
                      'inline-flex items-center rounded-lg border px-4 py-2 text-sm font-bold transition-colors duration-150',
                      focusRing,
                      // Texto oscuro sobre accent-blue (como el Button accent): blanco sobre #0099ff no llega a 4.5:1.
                      postData.locale === loc
                        ? 'border-accent-blue bg-accent-blue text-canvas'
                        : 'border-hairline bg-surface-2 text-ink-muted hover:border-outline-variant hover:text-ink'
                    )}
                  >
                    {loc === 'es' ? dict.editor.localeEs : dict.editor.localeEn}
                    {translations[loc].title && loc !== postData.locale && (
                      <>
                        <span className="ml-1.5 size-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
                        <span className="sr-only">{` (${dict.editor.localeHasContent})`}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>

              {/* Content on the left, publishing controls on the right — a wall of undifferentiated
                  fields makes it hard to tell what shapes the article from what shapes its metadata. */}
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
                <div className="space-y-6 min-w-0">
                  {/* Title */}
                  <div>
                    <label htmlFor={`${fieldId}-titleLabel`} className={labelClass}>{dict.editor.titleLabel}</label>
                    <input
                      id={`${fieldId}-titleLabel`}
                      type="text"
                      value={current.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder={dict.editor.titlePlaceholder}
                      className={clsx('w-full rounded-xl bg-surface-2 px-4 py-3 text-lg font-bold text-ink placeholder:font-medium placeholder:text-ink-subtle', fieldStateClass)}
                    />
                    {current.slug && <p className="mt-1.5 truncate font-mono text-[12px] text-ink-muted">/articulos/{current.slug}</p>}
                  </div>

                  {/* Content */}
                  <div>
                    <label htmlFor={`${fieldId}-contentLabel`} className={labelClass}>{dict.editor.contentLabel}</label>
                    <RichEditor
                      key={`${editingId ?? 'new'}-${postData.locale}`}
                      id={`${fieldId}-contentLabel`}
                      value={current.content_html}
                      onChange={(html) => updateTranslationField('content_html', html)}
                      fieldClass={richFieldClass}
                    />
                    {figuresOf(current.content_html).length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={copyImagesToOtherVersion}
                          className={clsx('rounded-lg border border-outline-variant px-3 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink', focusRing)}
                        >
                          {t(dict.editor.richCopyImages, { lang: postData.locale === 'es' ? dict.editor.localeEn : dict.editor.localeEs })}
                        </button>
                        {copyMsg && <p role="status" className="text-[12px] text-ink-muted">{copyMsg}</p>}
                      </div>
                    )}
                  </div>

                  {/* SEO meta rides along with the content it describes, at lower visual weight */}
                  <div className="rounded-xl border border-hairline p-4">
                    <h3 className="mb-3 text-sm font-bold text-ink">{dict.editor.seoHeading}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor={`${fieldId}-metaTitleLabel`} className={labelClass}>{dict.editor.metaTitleLabel}</label>
                        <input
                          id={`${fieldId}-metaTitleLabel`}
                          type="text"
                          value={current.meta_title}
                          onChange={(e) => updateTranslationField('meta_title', e.target.value)}
                          placeholder={dict.editor.metaTitlePlaceholder}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label htmlFor={`${fieldId}-metaDescLabel`} className={labelClass}>{dict.editor.metaDescLabel}</label>
                        <input
                          id={`${fieldId}-metaDescLabel`}
                          type="text"
                          value={current.meta_description}
                          onChange={(e) => updateTranslationField('meta_description', e.target.value)}
                          placeholder={dict.editor.metaDescPlaceholder}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Publishing sidebar: everything that decides where/how the article goes live, in one place */}
                <aside className="space-y-6 rounded-2xl border border-hairline bg-surface-1 p-5 lg:sticky lg:top-[calc(var(--header-height)+24px)]">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor={`${fieldId}-statusLabel`} className={labelClass}>{dict.editor.statusLabel}</label>
                      <select
                        id={`${fieldId}-statusLabel`}
                        value={postData.status}
                        onChange={(e) => setPostData({ ...postData, status: e.target.value as typeof postData.status })}
                        className={inputClass}
                      >
                        <option value="draft">{dict.editor.statusDraft}</option>
                        <option value="published">{dict.editor.statusPublished}</option>
                        <option value="scheduled">{dict.editor.statusScheduled}</option>
                      </select>
                    </div>

                    {postData.status === 'scheduled' && (
                      <div>
                        <label htmlFor={`${fieldId}-scheduledDateLabel`} className={labelClass}>{dict.editor.scheduledDateLabel}</label>
                        <input
                          id={`${fieldId}-scheduledDateLabel`}
                          type="datetime-local"
                          value={postData.scheduled_at}
                          onChange={(e) => setPostData({ ...postData, scheduled_at: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                    )}

                    <div>
                      <label htmlFor={`${fieldId}-categoryLabel`} className={labelClass}>{dict.editor.categoryLabel}</label>
                      <select
                        id={`${fieldId}-categoryLabel`}
                        value={postData.category_id}
                        onChange={(e) => setPostData({ ...postData, category_id: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">{dict.editor.noCategoryOption}</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor={`${fieldId}-sentimentLabel`} className={labelClass}>{dict.editor.sentimentLabel}</label>
                      <select
                        id={`${fieldId}-sentimentLabel`}
                        value={postData.sentiment}
                        onChange={(e) => setPostData({ ...postData, sentiment: e.target.value as typeof postData.sentiment })}
                        className={inputClass}
                      >
                        <option value="bullish">{dict.editor.sentimentBullish}</option>
                        <option value="bearish">{dict.editor.sentimentBearish}</option>
                        <option value="neutral">{dict.editor.sentimentNeutral}</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={postData.is_featured}
                        onChange={(e) => setPostData({ ...postData, is_featured: e.target.checked })}
                        className="w-4 h-4 rounded border-hairline bg-surface-2 accent-accent-blue"
                      />
                      <span className="text-body-sm text-ink">{dict.editor.featuredCheckbox}</span>
                    </label>
                  </div>

                  <div className="space-y-4 border-t border-hairline pt-5">
                    <h3 className="text-sm font-bold text-ink">{dict.editor.imagesHeading}</h3>
                    <div>
                      <label htmlFor={`${fieldId}-coverImageLabel`} className={labelClass}>{dict.editor.coverImageLabel}</label>
                      <input
                        id={`${fieldId}-coverImageLabel`}
                        type="text"
                        value={postData.cover_image_url}
                        onChange={(e) => {
                          setPostData({ ...postData, cover_image_url: e.target.value })
                          setCoverFailedUrl('')
                        }}
                        placeholder="https://..."
                        className={inputClass}
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <label className={clsx('inline-flex cursor-pointer items-center rounded-lg border border-outline-variant px-3 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-blue', coverUploading && 'pointer-events-none opacity-60')}>
                          {coverUploading ? dict.editor.coverUploading : dict.editor.coverUpload}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            disabled={coverUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) void uploadCover(file)
                              e.target.value = ''
                            }}
                          />
                        </label>
                        {coverUploadError && <p role="alert" className="text-[12px] font-medium text-semantic-danger">{coverUploadError}</p>}
                      </div>
                      {/* Portada generada o pegada a mano: el editor tiene que VER que cargo antes de
                          publicar, no fiarse de una cadena de texto. Si falla, se dice por que en vez
                          de dejar un hueco mudo — coverFailedUrl evita reintentar la misma URL rota en
                          cada tecla. */}
                      {postData.cover_image_url && (
                        postData.cover_image_url === coverFailedUrl ? (
                          <p role="alert" className="mt-2 flex items-start gap-1.5 text-[12px] font-medium text-semantic-danger"><StatusIcon kind="error" className="mt-px size-3.5" />{dict.editor.coverImageLoadError}</p>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element -- cover hosts are not known ahead of time (same reason as MediaPreview.tsx)
                          <img
                            src={postData.cover_image_url}
                            alt=""
                            onError={() => setCoverFailedUrl(postData.cover_image_url)}
                            className="mt-2 aspect-[16/9] w-full rounded-lg border border-hairline bg-surface-2 object-cover"
                          />
                        )
                      )}
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-ogImageLabel`} className={labelClass}>{dict.editor.ogImageLabel}</label>
                      <input
                        id={`${fieldId}-ogImageLabel`}
                        type="text"
                        value={postData.og_image_url}
                        onChange={(e) => setPostData({ ...postData, og_image_url: e.target.value })}
                        placeholder={dict.editor.ogImagePlaceholder}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-hairline pt-5">
                    <h3 className="text-sm font-bold text-ink">{dict.editor.sourceHeading}</h3>
                    <div>
                      <label htmlFor={`${fieldId}-sourceLabel`} className={labelClass}>{dict.editor.sourceLabel}</label>
                      <select
                        id={`${fieldId}-sourceLabel`}
                        value={postData.source_id}
                        onChange={(e) => setPostData({ ...postData, source_id: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">{dict.editor.noSourceOption}</option>
                        {sources.map((src) => (
                          <option key={src.id} value={src.id}>{src.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-sourceUrlLabel`} className={labelClass}>{dict.editor.sourceUrlLabel}</label>
                      <input
                        id={`${fieldId}-sourceUrlLabel`}
                        type="text"
                        value={postData.source_url}
                        onChange={(e) => setPostData({ ...postData, source_url: e.target.value })}
                        placeholder="https://..."
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-hairline pt-5">
                    <div>
                      <p id={`${fieldId}-assets`} className={labelClass}>{dict.editor.relatedAssetsLabel}</p>
                      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${fieldId}-assets`}>
                        {assets.map((asset) => (
                          <ToggleChip
                            key={asset.id}
                            selected={postData.asset_ids.includes(String(asset.id))}
                            onToggle={() => setPostData({ ...postData, asset_ids: toggleArrayItem(postData.asset_ids, String(asset.id)) })}
                          >
                            {asset.symbol}
                          </ToggleChip>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p id={`${fieldId}-tags`} className={labelClass}>{dict.editor.tagsLabel}</p>
                      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${fieldId}-tags`}>
                        {tags.map((tag) => (
                          <ToggleChip
                            key={tag.id}
                            selected={postData.tag_ids.includes(String(tag.id))}
                            onToggle={() => setPostData({ ...postData, tag_ids: toggleArrayItem(postData.tag_ids, String(tag.id)) })}
                          >
                            {tag.name}
                          </ToggleChip>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="space-y-3 border-t border-hairline pt-5">
                    <Button type="submit" variant="accent" disabled={saving} aria-busy={saving || undefined} className="w-full">
                      {saving && <Spinner />}
                      {saving
                        ? dict.editor.saving
                        : editingId
                          ? dict.editor.saveChanges
                          : postData.status === 'published'
                            ? dict.editor.publishNow
                            : dict.editor.saveDraft}
                    </Button>
                    {/* role=status siempre montado: si el contenedor naciera junto con el texto,
                        algunos lectores no anunciarian el primer mensaje. */}
                    <p role="status" className={clsx('text-sm font-medium', saveMsg.startsWith('✓') ? 'text-semantic-success' : 'text-semantic-danger', !saveMsg && 'sr-only')}>
                      {saveMsg}
                    </p>
                  </div>
                </aside>
              </div>
                </>
              )}
            </form>
          )}

          {/* POSTS TAB */}
          {activeTab === 'posts' && (
            <div>
              {/* System-wide control, kept visually apart from the per-article actions below it:
                  pausing here stops every future scheduled run, not just one post. */}
              <div
                className={clsx(
                  'mb-6 flex flex-col gap-3 rounded-xl border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between',
                  automation.active ? 'border-semantic-success/30 bg-semantic-success/5' : 'border-semantic-warning/30 bg-semantic-warning/5'
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={clsx(
                      'flex size-8 shrink-0 items-center justify-center rounded-full',
                      automation.active ? 'bg-semantic-success/15 text-semantic-success' : 'bg-semantic-warning/15 text-semantic-warning'
                    )}
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      {automation.active ? 'bolt' : 'pause_circle'}
                    </span>
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">{dict.posts.automationHeading}</p>
                    <p className="text-[12px] text-ink-muted">
                      {automation.loading
                        ? dict.posts.automationLoading
                        : !automation.configured
                          ? dict.posts.automationNotConnected
                          : automation.active
                            ? dict.posts.automationActive
                            : dict.posts.automationPaused}
                    </p>
                  </div>
                </div>
                <Button
                  variant={automation.active ? 'secondary' : 'accent'}
                  size="sm"
                  onClick={handleToggleAutomation}
                  disabled={!automation.configured || automation.loading || automation.toggling || automation.active === null}
                  title={!automation.configured ? dict.posts.automationConfigureTitle : undefined}
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    {automation.active ? 'pause' : 'play_arrow'}
                  </span>
                  {automation.toggling ? dict.posts.automationApplying : automation.active ? dict.posts.automationPause : dict.posts.automationResume}
                </Button>
              </div>

              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-headline font-bold text-ink">{t(dict.posts.articlesHeading, { n: postsList.length })}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleTriggerPipeline}
                    disabled={pipelineRunning}
                    aria-busy={pipelineRunning || undefined}
                  >
                    {pipelineRunning ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">play_arrow</span>
                    )}
                    {pipelineRunning ? dict.posts.runningPipeline : dict.posts.runPipeline}
                  </Button>
                  <Button variant="accent" size="sm" onClick={() => { resetForm(); setActiveTab('editor') }}>
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
                    {dict.posts.newArticle}
                  </Button>
                </div>
              </div>
              <div
                role="status"
                className={clsx(
                  pipelineMsg
                    ? 'mb-4 rounded-lg border p-3 text-sm font-medium'
                    : 'sr-only',
                  pipelineMsg.startsWith('✓')
                    ? 'border-semantic-success/30 bg-semantic-success/10 text-semantic-success'
                    : 'border-semantic-danger/30 bg-semantic-danger/10 text-semantic-danger'
                )}
              >
                {pipelineMsg}
              </div>

              {loadingPosts ? (
                <div className="space-y-2" aria-busy="true">
                  {[1, 2, 3].map((i) => (
                    <div key={i} aria-hidden="true" className="h-[88px] animate-pulse rounded-xl border border-hairline bg-surface-1 motion-reduce:animate-none" />
                  ))}
                </div>
              ) : postsList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-outline-variant py-16 text-center">
                  <span className="material-symbols-outlined mb-3 block text-5xl text-ink-subtle" aria-hidden="true">article</span>
                  <p className="text-body text-ink-muted">{dict.posts.emptyPosts}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {postsList.map((post) => {
                    const href = previewHref(post)
                    return (
                      <div
                        key={post.id}
                        className={clsx(
                          'flex flex-col gap-3 rounded-xl border bg-surface-1 p-4 transition-colors sm:flex-row sm:items-center sm:gap-4',
                          editingId === post.id ? 'border-accent-blue/60' : 'border-hairline hover:border-outline-variant'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            {/* Pastilla con marca de forma ademas del color: publicado = punto lleno,
                                programado = anillo, borrador = anillo punteado. */}
                            <span
                              className={clsx(
                                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold',
                                post.status === 'published'
                                  ? 'border-semantic-success/30 bg-semantic-success/10 text-semantic-success'
                                  : post.status === 'draft'
                                    ? 'border-outline-variant bg-surface-2 text-ink-muted'
                                    : 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue-hover'
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className={clsx(
                                  'size-1.5 rounded-full',
                                  post.status === 'published'
                                    ? 'bg-current'
                                    : post.status === 'draft'
                                      ? 'border border-dashed border-current'
                                      : 'border border-current'
                                )}
                              />
                              {post.status === 'published'
                                ? dict.editor.statusPublished
                                : post.status === 'draft'
                                  ? dict.editor.statusDraft
                                  : dict.editor.statusScheduled}
                            </span>
                            {post.category && <span className="text-[12px] text-ink-muted">{post.category.name}</span>}
                          </div>
                          <p className="truncate text-sm font-bold text-ink" title={post.title}>{post.title}</p>
                          <p className="mt-0.5 text-[12px] tabular-nums text-ink-muted">
                            {post.published_at
                              ? new Date(post.published_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-AR')
                              : dict.posts.noDate}{' '}
                            · {post.view_count} {dict.posts.viewsSuffix}
                          </p>
                          {(() => {
                            // Lo que le falta al artículo: portada, categoría o traducción (el modo Manual solo guarda lo escrito)
                            const f = post.faltantes
                            if (!hayFalta(f) || post.status !== 'published') return null
                            const faltan = [f?.portada && dict.posts.missingCover, f?.categoria && dict.posts.missingCategory, f?.traduccion && dict.posts.missingTranslation].filter(Boolean)
                            const enCurso = post.id in completando
                            return (
                              <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-semantic-warning/30 bg-semantic-warning/[0.07] px-3 py-2 text-[12px] leading-relaxed">
                                <StatusIcon kind="warning" className="size-3.5 text-semantic-warning" />
                                <p className="min-w-0 flex-1 text-ink-muted">
                                  <span className="font-bold text-semantic-warning">{dict.posts.missingLabel}</span> {faltan.join(' · ')}
                                </p>
                                <button
                                  type="button"
                                  disabled={enCurso}
                                  onClick={() => handleCompletar(post.id)}
                                  className={clsx('rounded-md bg-accent-blue/10 px-2.5 py-1 text-xs font-bold text-accent-blue-hover transition-colors hover:bg-accent-blue/20 disabled:cursor-wait disabled:opacity-60', focusRing)}
                                >
                                  {enCurso ? dict.posts.completing : dict.posts.complete}
                                </button>
                              </div>
                            )
                          })()}
                          {(() => {
                            // Motivo visible de por que este borrador no salio solo (columna
                            // pipeline_error). Etiqueta + icono + color: tres canales, no uno.
                            const failure = post.status === 'draft' ? parsePipelineError(post.pipeline_error) : null
                            if (!failure) return null
                            const isChecklist = failure.kind === 'checklist'
                            return (
                              <div
                                className={clsx(
                                  'mt-2.5 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] leading-relaxed',
                                  isChecklist
                                    ? 'border-semantic-warning/30 bg-semantic-warning/[0.07]'
                                    : 'border-semantic-danger/30 bg-semantic-danger/[0.07]'
                                )}
                              >
                                <StatusIcon
                                  kind={isChecklist ? 'warning' : 'error'}
                                  className={clsx('mt-0.5 size-3.5', isChecklist ? 'text-semantic-warning' : 'text-semantic-danger')}
                                />
                                <p className="min-w-0 text-ink-muted">
                                  <span className={clsx('font-bold', isChecklist ? 'text-semantic-warning' : 'text-semantic-danger')}>
                                    {isChecklist ? dict.posts.pipelineChecklist : dict.posts.pipelineFailure}
                                  </span>
                                  {post.pipeline_attempts != null && post.pipeline_attempts > 0 && (
                                    <span className="text-ink-muted"> · {t(dict.posts.pipelineAttempts, { n: post.pipeline_attempts })}</span>
                                  )}
                                  {failure.reason && (
                                    <span className="mt-0.5 line-clamp-2 block break-words" title={failure.reason}>
                                      {failure.reason}
                                    </span>
                                  )}
                                </p>
                              </div>
                            )
                          })()}
                        </div>

                        <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
                          {/* Edit is the action taken on almost every row, so it gets real weight instead of matching the others */}
                          <button
                            type="button"
                            onClick={() => handleEditPost(post.id)}
                            className={clsx('flex items-center gap-1.5 rounded-lg bg-accent-blue/10 px-2.5 py-2 text-accent-blue-hover transition-colors hover:bg-accent-blue/20', focusRing)}
                          >
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
                            <span className="text-xs font-bold">{dict.posts.edit}</span>
                          </button>

                          <span className="mx-1 h-5 w-px bg-hairline" aria-hidden="true" />

                          <button
                            type="button"
                            onClick={() => handleToggleFeatured(post.id, post.is_featured)}
                            aria-pressed={post.is_featured}
                            aria-label={post.is_featured ? dict.posts.removeFeatured : dict.posts.markFeatured}
                            title={post.is_featured ? dict.posts.removeFeatured : dict.posts.markFeatured}
                            className={clsx(
                              'rounded-lg p-2 transition-colors',
                              focusRing,
                              post.is_featured ? 'bg-accent-blue/10 text-accent-blue-hover' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                            )}
                          >
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">star</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(post.id, post.status)}
                            aria-label={post.status === 'published' ? dict.posts.unpublish : dict.posts.publish}
                            title={post.status === 'published' ? dict.posts.unpublish : dict.posts.publish}
                            className={clsx('rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink', focusRing)}
                          >
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                              {post.status === 'published' ? 'unpublished' : 'publish'}
                            </span>
                          </button>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={dict.posts.viewArticle}
                              title={dict.posts.viewArticle}
                              className={clsx('rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-accent-blue-hover', focusRing)}
                            >
                              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">open_in_new</span>
                            </a>
                          ) : (
                            // Sin destino no hay enlace: el antiguo <a href="#"> era enfocable y no
                            // hacia nada. Queda el icono atenuado con su explicacion.
                            <span
                              role="img"
                              aria-label={dict.posts.onlyPublishedPreview}
                              title={dict.posts.onlyPublishedPreview}
                              className="cursor-not-allowed rounded-lg p-2 text-ink-subtle opacity-60"
                            >
                              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">open_in_new</span>
                            </span>
                          )}

                          <span className="mx-1 h-5 w-px bg-hairline" aria-hidden="true" />

                          {/* Destructive, so it stays visually apart from the rest and never blends into a row of neutral icons */}
                          <button
                            type="button"
                            onClick={() => handleDeletePost(post.id)}
                            aria-label={dict.posts.delete}
                            title={dict.posts.delete}
                            className={clsx('rounded-lg p-2 text-semantic-danger transition-colors hover:bg-semantic-danger/10', focusRing)}
                          >
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'subscribers' && <SubscribersPanel />}

          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <CatalogCard
                title={dict.settings.categoriesTitle}
                items={categories.map((c) => ({ id: c.id, label: c.name, sublabel: c.slug }))}
                onDelete={async (id) => {
                  if (!(await deleteCatalogItem('category', id, false))) return
                  setCategories((prev) => prev.filter((c) => c.id !== id))
                }}
                fields={[
                  { key: 'name', placeholder: dict.settings.namePlaceholder, autoSlug: true },
                  { key: 'slug', placeholder: dict.settings.slugPlaceholder, readOnlyDerived: true },
                ]}
                onCreate={async (values) => {
                  const created = await createCatalogItem({ type: 'category', name: values.name, slug: values.slug })
                  if (created) setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
                }}
              />

              <CatalogCard
                title={dict.settings.tagsTitle}
                items={tags.map((t) => ({ id: t.id, label: t.name, sublabel: t.slug }))}
                onDelete={async (id) => {
                  if (!(await deleteCatalogItem('tag', id, true))) return
                  setTags((prev) => prev.filter((t) => t.id !== id))
                }}
                fields={[
                  { key: 'name', placeholder: dict.settings.namePlaceholder, autoSlug: true },
                  { key: 'slug', placeholder: dict.settings.slugPlaceholder, readOnlyDerived: true },
                ]}
                onCreate={async (values) => {
                  const created = await createCatalogItem({ type: 'tag', name: values.name, slug: values.slug })
                  if (created) setTags((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
                }}
              />

              <CatalogCard
                title={dict.settings.assetsTitle}
                items={assets.map((a) => ({ id: a.id, label: a.symbol, sublabel: a.name }))}
                onDelete={async (id) => {
                  if (!(await deleteCatalogItem('asset', id, true))) return
                  setAssets((prev) => prev.filter((a) => a.id !== id))
                }}
                fields={[
                  { key: 'symbol', placeholder: dict.settings.symbolPlaceholder },
                  { key: 'name', placeholder: dict.settings.assetNamePlaceholder },
                  {
                    key: 'tipo_id',
                    placeholder: dict.settings.typePlaceholder,
                    select: initialAssetTypes.map((t) => ({ value: String(t.id), label: t.name })),
                  },
                ]}
                onCreate={async (values) => {
                  const created = await createCatalogItem({
                    type: 'asset',
                    symbol: values.symbol,
                    name: values.name,
                    tipo_id: values.tipo_id,
                  })
                  if (created) setAssets((prev) => [...prev, created].sort((a, b) => a.symbol.localeCompare(b.symbol)))
                }}
              />

              <CatalogCard
                title={dict.settings.sourcesTitle}
                items={sources.map((s) => ({ id: s.id, label: s.name, sublabel: `${s.reliability_score}%` }))}
                onDelete={async (id) => {
                  if (!(await deleteCatalogItem('source', id, false))) return
                  setSources((prev) => prev.filter((s) => s.id !== id))
                }}
                fields={[
                  { key: 'name', placeholder: dict.settings.namePlaceholder },
                  { key: 'url', placeholder: dict.settings.urlPlaceholder },
                  { key: 'reliability_score', placeholder: dict.settings.reliabilityPlaceholder, type: 'number', defaultValue: '50' },
                ]}
                onCreate={async (values) => {
                  const created = await createCatalogItem({
                    type: 'source',
                    name: values.name,
                    url: values.url || undefined,
                    reliability_score: values.reliability_score || 50,
                  })
                  if (created) setSources((prev) => [...prev, created].sort((a, b) => b.reliability_score - a.reliability_score))
                }}
              />
            </div>
          )}
        </div>
      </main>

      <Footer />

      <ConfirmDialog
        open={dialog !== null}
        title={dict.dialog.deleteTitle}
        message={dialog?.message ?? ''}
        confirmLabel={dict.dialog.confirmDelete}
        cancelLabel={dict.dialog.cancel}
        onConfirm={() => closeDialog(true)}
        onCancel={() => closeDialog(false)}
      />
      {notice && <Notice message={notice} closeLabel={dict.dialog.close} onClose={() => setNotice(null)} />}
    </div>
  )
}

// ---- Settings tab building block: a list of catalog rows + a small add form ----

interface CatalogField {
  key: string
  placeholder: string
  type?: 'text' | 'number'
  autoSlug?: boolean
  readOnlyDerived?: boolean
  defaultValue?: string
  select?: { value: string; label: string }[]
}

function CatalogCard({
  title,
  items,
  fields,
  onCreate,
  onDelete,
}: {
  title: string
  items: { id: number; label: string; sublabel: string }[]
  fields: CatalogField[]
  onCreate: (values: Record<string, string>) => Promise<void>
  onDelete: (id: number) => Promise<void>
}) {
  const dict = useDictionary().cms.settings
  const initialValues = Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? '']))
  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const setField = (key: string, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value }
      const autoSlugField = fields.find((f) => f.autoSlug)
      const derivedField = fields.find((f) => f.readOnlyDerived)
      if (autoSlugField?.key === key && derivedField) next[derivedField.key] = generateSlug(value)
      return next
    })
  }

  const handleCreate = async () => {
    if (fields.some((f) => !f.readOnlyDerived && !values[f.key]?.trim() && f.key !== 'url')) return
    setCreating(true)
    try {
      await onCreate(values)
      setValues(initialValues)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await onDelete(id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <h3 className="mb-4 flex items-baseline justify-between gap-3 text-headline font-bold text-ink">
        {title}
        <span className="text-[12px] font-medium tabular-nums text-ink-muted">{items.length}</span>
      </h3>
      <ul className="mb-4 max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {items.length === 0 && <li className="text-body-sm text-ink-muted">{dict.noItemsYet}</li>}
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-2/60 px-3 py-2.5">
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{item.label}</span>
              <span className="block truncate text-xs text-ink-muted">{item.sublabel}</span>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              disabled={deletingId === item.id}
              aria-label={`${dict.delete}: ${item.label}`}
              title={dict.delete}
              className={clsx(
                'shrink-0 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-semantic-danger/10 hover:text-semantic-danger disabled:cursor-not-allowed disabled:opacity-50',
                focusRing
              )}
            >
              {deletingId === item.id ? (
                <Spinner className="size-4" />
              ) : (
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
        {fields.map((field) =>
          field.select ? (
            <select
              key={field.key}
              value={values[field.key]}
              onChange={(e) => setField(field.key, e.target.value)}
              aria-label={field.placeholder}
              className={clsx('min-w-[7rem] flex-1 rounded-lg bg-surface-2 px-2.5 py-2 text-xs text-ink', fieldStateClass)}
            >
              <option value="">{field.placeholder}</option>
              {field.select.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              key={field.key}
              type={field.type ?? 'text'}
              value={values[field.key]}
              onChange={(e) => setField(field.key, e.target.value)}
              placeholder={field.placeholder}
              aria-label={field.placeholder}
              readOnly={field.readOnlyDerived}
              className={clsx(
                'min-w-[6rem] flex-1 rounded-lg px-2.5 py-2 text-xs placeholder:text-ink-subtle',
                fieldStateClass,
                field.readOnlyDerived ? 'border-dashed bg-surface-container-lowest text-ink-muted hover:border-outline-variant' : 'bg-surface-2 text-ink'
              )}
            />
          )
        )}
        <Button type="button" variant="secondary" size="sm" onClick={handleCreate} disabled={creating} aria-busy={creating || undefined}>
          {creating ? <Spinner className="size-3.5" /> : <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>}
          {dict.addItem}
        </Button>
      </div>
    </Card>
  )
}
