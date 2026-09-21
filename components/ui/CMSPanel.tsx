'use client'

import { useState } from 'react'
import { Header, Button, Card, Footer } from '@/components/ui'
import type { Category, Tag, Asset, Source } from '@/lib/types'

interface CMSPanelProps {
  initialCategories: Category[]
  initialTags: Tag[]
  initialAssets: Asset[]
  initialSources: Source[]
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
}

export function CMSPanel({ initialCategories, initialTags, initialAssets, initialSources }: CMSPanelProps) {
  const [activeTab, setActiveTab] = useState<'editor' | 'posts' | 'settings'>('editor')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [pipelineRunning, setPipelineRunning] = useState(false)
  const [pipelineMsg, setPipelineMsg] = useState('')
  const [postsList, setPostsList] = useState<PostListItem[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)

  const [postData, setPostData] = useState({
    title: '',
    slug: '',
    content_html: '',
    locale: 'es' as 'es' | 'en',
    meta_title: '',
    meta_description: '',
    og_image_url: '',
    sentiment: 'neutral' as 'bullish' | 'bearish' | 'neutral',
    cover_image_url: '',
    source_url: '',
    source_id: '',
    status: 'draft' as 'draft' | 'published' | 'scheduled',
    scheduled_at: '',
    category_id: '',
    asset_ids: [] as string[],
    tag_ids: [] as string[],
    is_featured: false,
  })

  const [translations, setTranslations] = useState<Record<string, { title: string; content_html: string; meta_title: string; meta_description: string; slug: string }>>({
    es: { title: '', content_html: '', meta_title: '', meta_description: '', slug: '' },
    en: { title: '', content_html: '', meta_title: '', meta_description: '', slug: '' },
  })

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

  // Auto-generate slug from title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const handleTitleChange = (title: string, locale: 'es' | 'en') => {
    const slug = generateSlug(title)
    setTranslations((prev) => ({
      ...prev,
      [locale]: { ...prev[locale], title, slug },
    }))
    if (locale === postData.locale) {
      setPostData((prev) => ({ ...prev, title, slug }))
    }
  }

  const handleContentChange = (content: string, locale: 'es' | 'en') => {
    setTranslations((prev) => ({
      ...prev,
      [locale]: { ...prev[locale], content_html: content },
    }))
    if (locale === postData.locale) {
      setPostData((prev) => ({ ...prev, content_html: content }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!postData.title || !postData.content_html) {
      setSaveMsg('Título y contenido son requeridos')
      return
    }

    setSaving(true)
    setSaveMsg('')

    try {
      const payload = {
        ...postData,
        title: translations[postData.locale].title || postData.title,
        slug: translations[postData.locale].slug || postData.slug,
        content_html: translations[postData.locale].content_html || postData.content_html,
        meta_title: translations[postData.locale].meta_title || postData.meta_title,
        meta_description: translations[postData.locale].meta_description || postData.meta_description,
      }

      const res = await fetch('/api/posts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (data.success) {
        setSaveMsg(`✓ ${data.message}`)
        // Reset form after successful publish
        if (postData.status === 'published') {
          setPostData({
            title: '', slug: '', content_html: '', locale: 'es',
            meta_title: '', meta_description: '', og_image_url: '',
            sentiment: 'neutral', cover_image_url: '', source_url: '',
            source_id: '', status: 'draft', scheduled_at: '',
            category_id: '', asset_ids: [], tag_ids: [], is_featured: false,
          })
          setTranslations({
            es: { title: '', content_html: '', meta_title: '', meta_description: '', slug: '' },
            en: { title: '', content_html: '', meta_title: '', meta_description: '', slug: '' },
          })
        }
      } else {
        setSaveMsg(`✗ ${data.error}`)
      }
    } catch (err) {
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

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Header />

      <main className="flex-1 pt-[104px] pb-24">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-2 mb-8 w-fit">
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

          {/* EDITOR TAB */}
          {activeTab === 'editor' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Locale Switcher */}
              <div className="flex items-center gap-3">
                <span className="text-micro font-bold text-ink-muted uppercase tracking-wider">Idioma:</span>
                {(['es', 'en'] as const).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setActiveTab('editor')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      postData.locale === loc
                        ? 'bg-accent-blue text-white'
                        : 'bg-surface-2 text-ink-muted hover:text-ink'
                    }`}
                  >
                    {loc === 'es' ? 'Español' : 'English'}
                  </button>
                ))}
              </div>

              {/* Title */}
              <div>
                <label className="text-micro font-bold text-ink-muted uppercase tracking-wider block mb-2">Título</label>
                <input
                  type="text"
                  value={translations[postData.locale].title}
                  onChange={(e) => handleTitleChange(e.target.value, postData.locale)}
                  placeholder="Título del artículo..."
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface-2 px-4 py-3 text-lg font-bold text-ink placeholder:text-ink-subtle focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none"
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-micro font-bold text-ink-muted uppercase tracking-wider block mb-2">Contenido (HTML)</label>
                <textarea
                  value={translations[postData.locale].content_html}
                  onChange={(e) => handleContentChange(e.target.value, postData.locale)}
                  placeholder="<p>Escribe tu artículo aquí...</p>"
                  rows={15}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface-2 px-4 py-3 text-sm text-ink font-mono placeholder:text-ink-subtle focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none resize-y"
                />
              </div>

              {/* Meta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-micro font-bold text-ink-muted uppercase tracking-wider block mb-2">Meta Title</label>
                  <input
                    type="text"
                    value={translations[postData.locale].meta_title}
                    onChange={(e) => setTranslations((prev) => ({ ...prev, [postData.locale]: { ...prev[postData.locale], meta_title: e.target.value } }))}
                    placeholder="SEO title..."
                    className="w-full rounded-xl border border-outline-variant/40 bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-micro font-bold text-ink-muted uppercase tracking-wider block mb-2">Meta Description</label>
                  <input
                    type="text"
                    value={translations[postData.locale].meta_description}
                    onChange={(e) => setTranslations((prev) => ({ ...prev, [postData.locale]: { ...prev[postData.locale], meta_description: e.target.value } }))}
                    placeholder="SEO description..."
                    className="w-full rounded-xl border border-outline-variant/40 bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none"
                  />
                </div>
              </div>

              {/* Sentiment + Status + Category */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-micro font-bold text-ink-muted uppercase tracking-wider block mb-2">Sentimiento</label>
                  <select
                    value={postData.sentiment}
                    onChange={(e) => setPostData({ ...postData, sentiment: e.target.value as typeof postData.sentiment })}
                    className="w-full rounded-xl border border-outline-variant/40 bg-surface-2 px-4 py-2.5 text-sm text-ink focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none"
                  >
                    <option value="bullish">Alcista</option>
                    <option value="bearish">Bajista</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>
                <div>
                  <label className="text-micro font-bold text-ink-muted uppercase tracking-wider block mb-2">Estado</label>
                  <select
                    value={postData.status}
                    onChange={(e) => setPostData({ ...postData, status: e.target.value as typeof postData.status })}
                    className="w-full rounded-xl border border-outline-variant/40 bg-surface-2 px-4 py-2.5 text-sm text-ink focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none"
                  >
                    <option value="draft">Borrador</option>
                    <option value="published">Publicado</option>
                    <option value="scheduled">Programado</option>
                  </select>
                </div>
                <div>
                  <label className="text-micro font-bold text-ink-muted uppercase tracking-wider block mb-2">Categoría</label>
                  <select
                    value={postData.category_id}
                    onChange={(e) => setPostData({ ...postData, category_id: e.target.value })}
                    className="w-full rounded-xl border border-outline-variant/40 bg-surface-2 px-4 py-2.5 text-sm text-ink focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none"
                  >
                    <option value="">Sin categoría</option>
                    {initialCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-micro font-bold text-ink-muted uppercase tracking-wider block mb-2">Cover Image URL</label>
                  <input
                    type="text"
                    value={postData.cover_image_url}
                    onChange={(e) => setPostData({ ...postData, cover_image_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-outline-variant/40 bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-micro font-bold text-ink-muted uppercase tracking-wider block mb-2">Source URL</label>
                  <input
                    type="text"
                    value={postData.source_url}
                    onChange={(e) => setPostData({ ...postData, source_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-outline-variant/40 bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none"
                  />
                </div>
              </div>

              {/* Assets */}
              <div>
                <label className="text-micro font-bold text-ink-muted uppercase tracking-wider block mb-2">Activos relacionados</label>
                <div className="flex flex-wrap gap-2">
                  {initialAssets.map((asset) => (
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
                <label className="text-micro font-bold text-ink-muted uppercase tracking-wider block mb-2">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {initialTags.map((tag) => (
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
                  {saving ? 'Guardando...' : postData.status === 'published' ? 'Publicar Ahora' : 'Guardar Borrador'}
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
                  <Button variant="accent" size="sm" onClick={() => setActiveTab('editor')}>
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
                  {postsList.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest hover:border-outline-variant transition-colors"
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
                          href={post.status === 'published' ? `/articulos/${post.slug}` : '#'}
                          target={post.status === 'published' ? '_blank' : undefined}
                          className="p-2 rounded-lg text-ink-muted hover:text-accent-blue transition-colors"
                          title="Ver artículo"
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
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <h3 className="text-headline font-bold text-ink mb-4">Categorías</h3>
                <div className="space-y-2">
                  {initialCategories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-2/50">
                      <span className="text-sm font-medium text-ink">{cat.name}</span>
                      <span className="text-xs text-ink-muted">{cat.slug}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <h3 className="text-headline font-bold text-ink mb-4">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {initialTags.map((tag) => (
                    <span key={tag.id} className="px-3 py-1.5 rounded-lg bg-surface-2 text-xs font-medium text-ink-muted">
                      {tag.name}
                    </span>
                  ))}
                </div>
              </Card>
              <Card>
                <h3 className="text-headline font-bold text-ink mb-4">Activos</h3>
                <div className="flex flex-wrap gap-2">
                  {initialAssets.map((asset) => (
                    <span key={asset.id} className="px-3 py-1.5 rounded-lg bg-surface-2 text-xs font-bold text-ink-muted">
                      {asset.symbol}
                    </span>
                  ))}
                </div>
              </Card>
              <Card>
                <h3 className="text-headline font-bold text-ink mb-4">Fuentes</h3>
                <div className="space-y-2">
                  {initialSources.map((src) => (
                    <div key={src.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-2/50">
                      <span className="text-sm font-medium text-ink">{src.name}</span>
                      <span className="text-xs text-ink-muted">{src.reliability_score}%</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
