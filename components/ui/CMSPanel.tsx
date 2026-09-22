'use client'

import { useState } from 'react'
import { Header, Button, Card, Footer } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
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

// Auto-generate a slug from a title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const inputClass =
  'w-full rounded-xl border border-outline-variant/40 bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none'
const labelClass = 'text-micro font-bold text-ink-muted uppercase tracking-wider block mb-2'

export function CMSPanel({ initialCategories, initialTags, initialAssets, initialSources, initialAssetTypes }: CMSPanelProps) {
  const [activeTab, setActiveTab] = useState<'editor' | 'posts' | 'settings'>('editor')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [pipelineRunning, setPipelineRunning] = useState(false)
  const [pipelineMsg, setPipelineMsg] = useState('')
  const [postsList, setPostsList] = useState<PostListItem[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [postData, setPostData] = useState(EMPTY_POST_DATA)
  const [translations, setTranslations] = useState<Record<Locale, TranslationDraft>>(EMPTY_TRANSLATIONS)

  // Catalogs start from the server snapshot; settings CRUD keeps its own copy in sync locally
  const [categories, setCategories] = useState(initialCategories)
  const [tags, setTags] = useState(initialTags)
  const [assets, setAssets] = useState(initialAssets)
  const [sources, setSources] = useState(initialSources)

  const current = translations[postData.locale]

  // Load posts list
  const loadPosts = async () => {
    setLoadingPosts(true)
    try {
      const res = await fetch('/api/posts/list')
      if (res.status === 401 || res.status === 403) {
        window.location.assign('/login')
        return
      }
      const data = await res.json()
      if (data.success) setPostsList(data.data)
    } catch (e) {
      console.error('Failed to load posts:', e)
    } finally {
      setLoadingPosts(false)
    }
  }

  const selectTab = (tab: 'editor' | 'posts' | 'settings') => {
    setActiveTab(tab)
    if (tab === 'posts') loadPosts()
  }

  const resetForm = () => {
    setPostData(EMPTY_POST_DATA)
    setTranslations(EMPTY_TRANSLATIONS)
    setEditingId(null)
    setSaveMsg('')
  }

  const handleTitleChange = (title: string) => {
    setTranslations((prev) => ({
      ...prev,
      [postData.locale]: { ...prev[postData.locale], title, slug: generateSlug(title) },
    }))
  }

  const updateTranslationField = (field: keyof TranslationDraft, value: string) => {
    setTranslations((prev) => ({ ...prev, [postData.locale]: { ...prev[postData.locale], [field]: value } }))
  }

  // Load a post's full data into the editor for editing
  const handleEditPost = async (id: string) => {
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
        window.alert(data.error ?? 'No se pudo cargar el artículo')
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
      const availableLocale = post.translations.find((t) => t.locale === 'es') ? 'es' : (post.translations[0]?.locale ?? 'es')

      setTranslations(nextTranslations)
      setPostData({
        locale: availableLocale,
        sentiment: (post.sentiment as 'bullish' | 'bearish' | 'neutral') ?? 'neutral',
        cover_image_url: post.cover_image_url ?? '',
        og_image_url: post.og_image_url ?? '',
        source_url: post.source_url ?? '',
        source_id: post.source_id ? String(post.source_id) : '',
        status: post.status,
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
      window.alert('Error de conexión')
    } finally {
      setLoadingEdit(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!current.title || !current.content_html) {
      setSaveMsg('✗ Título y contenido son requeridos')
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
        setSaveMsg(`✓ ${data.message}`)
        if (!editingId && postData.status === 'published') resetForm()
      } else {
        setSaveMsg(`✗ ${data.error}`)
      }
    } catch {
      setSaveMsg('✗ Error de conexión')
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
        window.alert(data?.error ?? 'No se pudo completar la acción')
        return
      }
      loadPosts()
    } catch (e) {
      console.error('Manage request error:', e)
      window.alert('Error de conexión')
    }
  }

  const handleDeletePost = async (id: string) => {
    if (!confirm('¿Eliminar este artículo?')) return
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
        setPipelineMsg(`✓ Pipeline ejecutado. ID: ${data.executionId || 'N/A'}`)
        setTimeout(() => loadPosts(), 5000)
      } else {
        setPipelineMsg(`✗ ${data.error}`)
      }
    } catch {
      setPipelineMsg('✗ Error de conexión')
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
      window.alert(data.error ?? 'No se pudo crear el elemento')
      return null
    }
    return data.data
  }

  const deleteCatalogItem = async (type: string, id: number, warnAboutUsage: boolean) => {
    const message = warnAboutUsage
      ? '¿Eliminar? Los artículos que lo usan lo perderán.'
      : '¿Eliminar este elemento?'
    if (!confirm(message)) return false
    const res = await fetch(`/api/catalog?type=${type}&id=${id}`, { method: 'DELETE' })
    if (res.status === 401 || res.status === 403) {
      window.location.assign('/login')
      return false
    }
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.success) {
      window.alert(data?.error ?? 'No se pudo eliminar')
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

      <main className="flex-1 pt-[104px] pb-24">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8">
          {/* Tabs */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-2 w-fit">
              {([
                { key: 'editor', label: 'Editor', icon: 'edit' },
                { key: 'posts', label: 'Artículos', icon: 'article' },
                { key: 'settings', label: 'Configuración', icon: 'settings' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => selectTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                    activeTab === tab.key
                      ? 'bg-surface-container-lowest text-ink shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="text-body-sm text-ink-muted transition-colors hover:text-ink"
            >
              Cerrar sesión
            </button>
          </div>

          {/* EDITOR TAB */}
          {activeTab === 'editor' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {editingId && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-accent-blue/30 bg-accent-blue/5 px-4 py-3">
                  <span className="text-body-sm text-ink">
                    <span className="material-symbols-outlined text-[16px] align-text-bottom mr-1.5">edit_note</span>
                    Editando artículo existente
                  </span>
                  <button type="button" onClick={resetForm} className="text-body-sm font-bold text-accent-blue hover:underline">
                    Cancelar y crear nuevo
                  </button>
                </div>
              )}

              {loadingEdit && (
                <div className="rounded-xl border border-outline-variant/40 bg-surface-2 px-4 py-3 text-body-sm text-ink-muted">
                  Cargando artículo...
                </div>
              )}

              {/* Locale Switcher */}
              <div className="flex items-center gap-3">
                <span className={labelClass.replace('block mb-2', '')}>Idioma:</span>
                {(['es', 'en'] as const).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setPostData((prev) => ({ ...prev, locale: loc }))}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      postData.locale === loc
                        ? 'bg-accent-blue text-white'
                        : 'bg-surface-2 text-ink-muted hover:text-ink'
                    }`}
                  >
                    {loc === 'es' ? 'Español' : 'English'}
                    {translations[loc].title && loc !== postData.locale && (
                      <span className="ml-1.5 text-[10px] opacity-70">●</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Title */}
              <div>
                <label className={labelClass}>Título</label>
                <input
                  type="text"
                  value={current.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Título del artículo..."
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface-2 px-4 py-3 text-lg font-bold text-ink placeholder:text-ink-subtle focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none"
                />
                {current.slug && <p className="mt-1.5 text-[11px] text-ink-subtle">/articulos/{current.slug}</p>}
              </div>

              {/* Content */}
              <div>
                <label className={labelClass}>Contenido (HTML)</label>
                <textarea
                  value={current.content_html}
                  onChange={(e) => updateTranslationField('content_html', e.target.value)}
                  placeholder="<p>Escribe tu artículo aquí...</p>"
                  rows={15}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface-2 px-4 py-3 text-sm text-ink font-mono placeholder:text-ink-subtle focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none resize-y"
                />
              </div>

              {/* Meta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Meta Title</label>
                  <input
                    type="text"
                    value={current.meta_title}
                    onChange={(e) => updateTranslationField('meta_title', e.target.value)}
                    placeholder="SEO title..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Meta Description</label>
                  <input
                    type="text"
                    value={current.meta_description}
                    onChange={(e) => updateTranslationField('meta_description', e.target.value)}
                    placeholder="SEO description..."
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Sentiment + Status + Category */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Sentimiento</label>
                  <select
                    value={postData.sentiment}
                    onChange={(e) => setPostData({ ...postData, sentiment: e.target.value as typeof postData.sentiment })}
                    className={inputClass}
                  >
                    <option value="bullish">Alcista</option>
                    <option value="bearish">Bajista</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Estado</label>
                  <select
                    value={postData.status}
                    onChange={(e) => setPostData({ ...postData, status: e.target.value as typeof postData.status })}
                    className={inputClass}
                  >
                    <option value="draft">Borrador</option>
                    <option value="published">Publicado</option>
                    <option value="scheduled">Programado</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Categoría</label>
                  <select
                    value={postData.category_id}
                    onChange={(e) => setPostData({ ...postData, category_id: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {postData.status === 'scheduled' && (
                <div>
                  <label className={labelClass}>Fecha de publicación</label>
                  <input
                    type="datetime-local"
                    value={postData.scheduled_at}
                    onChange={(e) => setPostData({ ...postData, scheduled_at: e.target.value })}
                    className={`${inputClass} max-w-xs`}
                  />
                </div>
              )}

              {/* Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Cover Image URL</label>
                  <input
                    type="text"
                    value={postData.cover_image_url}
                    onChange={(e) => setPostData({ ...postData, cover_image_url: e.target.value })}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>OG Image URL</label>
                  <input
                    type="text"
                    value={postData.og_image_url}
                    onChange={(e) => setPostData({ ...postData, og_image_url: e.target.value })}
                    placeholder="https://... (para compartir en redes)"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Source */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Fuente</label>
                  <select
                    value={postData.source_id}
                    onChange={(e) => setPostData({ ...postData, source_id: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Sin fuente</option>
                    {sources.map((src) => (
                      <option key={src.id} value={src.id}>{src.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Source URL</label>
                  <input
                    type="text"
                    value={postData.source_url}
                    onChange={(e) => setPostData({ ...postData, source_url: e.target.value })}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Assets */}
              <div>
                <label className={labelClass}>Activos relacionados</label>
                <div className="flex flex-wrap gap-2">
                  {assets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setPostData({ ...postData, asset_ids: toggleArrayItem(postData.asset_ids, String(asset.id)) })}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                        postData.asset_ids.includes(String(asset.id))
                          ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                          : 'border-outline-variant/40 bg-surface-2/50 text-ink-muted hover:text-ink'
                      }`}
                    >
                      {asset.symbol}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className={labelClass}>Tags</label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setPostData({ ...postData, tag_ids: toggleArrayItem(postData.tag_ids, String(tag.id)) })}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                        postData.tag_ids.includes(String(tag.id))
                          ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                          : 'border-outline-variant/40 bg-surface-2/50 text-ink-muted hover:text-ink'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Featured */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={postData.is_featured}
                  onChange={(e) => setPostData({ ...postData, is_featured: e.target.checked })}
                  className="w-5 h-5 rounded border-hairline bg-surface-2 accent-accent-blue"
                />
                <span className="text-body text-ink">Marcar como destacado</span>
              </label>

              {/* Submit */}
              <div className="flex items-center gap-4 pt-4 border-t border-outline-variant/40">
                <Button type="submit" variant="accent" disabled={saving}>
                  {saving
                    ? 'Guardando...'
                    : editingId
                      ? 'Guardar cambios'
                      : postData.status === 'published'
                        ? 'Publicar Ahora'
                        : 'Guardar Borrador'}
                </Button>
                {saveMsg && (
                  <span className={`text-sm font-medium ${saveMsg.startsWith('✓') ? 'text-semantic-success' : 'text-semantic-danger'}`}>
                    {saveMsg}
                  </span>
                )}
              </div>
            </form>
          )}

          {/* POSTS TAB */}
          {activeTab === 'posts' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-headline font-bold text-ink">Artículos ({postsList.length})</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleTriggerPipeline}
                    disabled={pipelineRunning}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {pipelineRunning ? 'hourglass_empty' : 'play_arrow'}
                    </span>
                    {pipelineRunning ? 'Ejecutando...' : 'Ejecutar Pipeline'}
                  </Button>
                  <Button variant="accent" size="sm" onClick={() => { resetForm(); setActiveTab('editor') }}>
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Nuevo Artículo
                  </Button>
                </div>
              </div>
              {pipelineMsg && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${
                  pipelineMsg.startsWith('✓') ? 'bg-semantic-success/10 text-semantic-success' : 'bg-semantic-danger/10 text-semantic-danger'
                }`}>
                  {pipelineMsg}
                </div>
              )}

              {loadingPosts ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-surface-2 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : postsList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-outline-variant/40 py-16 text-center">
                  <span className="material-symbols-outlined text-5xl text-ink-subtle mb-3 block">article</span>
                  <p className="text-body text-ink-muted">No hay artículos. Crea tu primer artículo en la pestaña Editor.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {postsList.map((post) => {
                    const href = previewHref(post)
                    return (
                      <div
                        key={post.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border bg-surface-container-lowest transition-colors ${
                          editingId === post.id ? 'border-accent-blue/50' : 'border-outline-variant/30 hover:border-outline-variant'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              post.status === 'published'
                                ? 'bg-semantic-success/15 text-semantic-success'
                                : post.status === 'draft'
                                ? 'bg-surface-2 text-ink-muted'
                                : 'bg-accent-blue/15 text-accent-blue'
                            }`}>
                              {post.status === 'published' ? 'Publicado' : post.status === 'draft' ? 'Borrador' : 'Programado'}
                            </span>
                            {post.category && (
                              <span className="text-[10px] text-ink-muted">{post.category.name}</span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-ink truncate">{post.title}</p>
                          <p className="text-[11px] text-ink-muted">
                            {post.published_at ? new Date(post.published_at).toLocaleDateString('es-AR') : 'Sin fecha'} · {post.view_count} vistas
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleEditPost(post.id)}
                            className="p-2 rounded-lg text-ink-muted hover:text-accent-blue transition-colors"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleToggleFeatured(post.id, post.is_featured)}
                            className={`p-2 rounded-lg transition-colors ${
                              post.is_featured ? 'text-accent-blue bg-accent-blue/10' : 'text-ink-muted hover:text-ink'
                            }`}
                            title={post.is_featured ? 'Quitar destacado' : 'Marcar destacado'}
                          >
                            <span className="material-symbols-outlined text-[18px]">star</span>
                          </button>
                          <button
                            onClick={() => handleToggleStatus(post.id, post.status)}
                            className="p-2 rounded-lg text-ink-muted hover:text-ink transition-colors"
                            title={post.status === 'published' ? 'Despublicar' : 'Publicar'}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {post.status === 'published' ? 'unpublished' : 'publish'}
                            </span>
                          </button>
                          <a
                            href={href ?? '#'}
                            target={href ? '_blank' : undefined}
                            rel={href ? 'noreferrer' : undefined}
                            aria-disabled={!href}
                            className={`p-2 rounded-lg transition-colors ${href ? 'text-ink-muted hover:text-accent-blue' : 'text-ink-subtle pointer-events-none'}`}
                            title={href ? 'Ver artículo' : 'Solo disponible para artículos publicados'}
                          >
                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                          </a>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="p-2 rounded-lg text-ink-muted hover:text-semantic-danger transition-colors"
                            title="Eliminar"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
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
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <CatalogCard
                title="Categorías"
                items={categories.map((c) => ({ id: c.id, label: c.name, sublabel: c.slug }))}
                onDelete={async (id) => {
                  if (!(await deleteCatalogItem('category', id, false))) return
                  setCategories((prev) => prev.filter((c) => c.id !== id))
                }}
                fields={[
                  { key: 'name', placeholder: 'Nombre', autoSlug: true },
                  { key: 'slug', placeholder: 'slug', readOnlyDerived: true },
                ]}
                onCreate={async (values) => {
                  const created = await createCatalogItem({ type: 'category', name: values.name, slug: values.slug })
                  if (created) setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
                }}
              />

              <CatalogCard
                title="Tags"
                items={tags.map((t) => ({ id: t.id, label: t.name, sublabel: t.slug }))}
                onDelete={async (id) => {
                  if (!(await deleteCatalogItem('tag', id, true))) return
                  setTags((prev) => prev.filter((t) => t.id !== id))
                }}
                fields={[
                  { key: 'name', placeholder: 'Nombre', autoSlug: true },
                  { key: 'slug', placeholder: 'slug', readOnlyDerived: true },
                ]}
                onCreate={async (values) => {
                  const created = await createCatalogItem({ type: 'tag', name: values.name, slug: values.slug })
                  if (created) setTags((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
                }}
              />

              <CatalogCard
                title="Activos"
                items={assets.map((a) => ({ id: a.id, label: a.symbol, sublabel: a.name }))}
                onDelete={async (id) => {
                  if (!(await deleteCatalogItem('asset', id, true))) return
                  setAssets((prev) => prev.filter((a) => a.id !== id))
                }}
                fields={[
                  { key: 'symbol', placeholder: 'Símbolo (ej. BTC)' },
                  { key: 'name', placeholder: 'Nombre (ej. Bitcoin)' },
                  {
                    key: 'tipo_id',
                    placeholder: 'Tipo',
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
                title="Fuentes"
                items={sources.map((s) => ({ id: s.id, label: s.name, sublabel: `${s.reliability_score}%` }))}
                onDelete={async (id) => {
                  if (!(await deleteCatalogItem('source', id, false))) return
                  setSources((prev) => prev.filter((s) => s.id !== id))
                }}
                fields={[
                  { key: 'name', placeholder: 'Nombre' },
                  { key: 'url', placeholder: 'https:// (opcional)' },
                  { key: 'reliability_score', placeholder: 'Confiabilidad 0-100', type: 'number', defaultValue: '50' },
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
      <h3 className="text-headline font-bold text-ink mb-4">{title}</h3>
      <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
        {items.length === 0 && <p className="text-body-sm text-ink-muted">Todavía no hay elementos.</p>}
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-surface-2/50">
            <div className="min-w-0">
              <span className="block text-sm font-medium text-ink truncate">{item.label}</span>
              <span className="block text-xs text-ink-muted truncate">{item.sublabel}</span>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              disabled={deletingId === item.id}
              className="shrink-0 p-1.5 rounded-lg text-ink-muted hover:text-semantic-danger transition-colors disabled:opacity-50"
              title="Eliminar"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-outline-variant/30">
        {fields.map((field) =>
          field.select ? (
            <select
              key={field.key}
              value={values[field.key]}
              onChange={(e) => setField(field.key, e.target.value)}
              className="flex-1 min-w-[7rem] rounded-lg border border-outline-variant/40 bg-surface-2 px-2.5 py-2 text-xs text-ink focus:border-accent-blue focus:outline-none"
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
              readOnly={field.readOnlyDerived}
              className={`flex-1 min-w-[6rem] rounded-lg border border-outline-variant/40 px-2.5 py-2 text-xs text-ink placeholder:text-ink-subtle focus:border-accent-blue focus:outline-none ${
                field.readOnlyDerived ? 'bg-surface-container-lowest text-ink-subtle' : 'bg-surface-2'
              }`}
            />
          )
        )}
        <Button type="button" variant="secondary" size="sm" onClick={handleCreate} disabled={creating}>
          <span className="material-symbols-outlined text-[16px]">add</span>
        </Button>
      </div>
    </Card>
  )
}
