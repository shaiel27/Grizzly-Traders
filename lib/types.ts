export type Category = {
  id: number
  name: string
  slug: string
  created_at: string
  updated_at: string
}

export type AssetType = {
  id: number
  name: string
  slug: string
  created_at: string
  updated_at: string
}

export type Asset = {
  id: number
  symbol: string
  name: string
  tipo_id: number
  created_at: string
  updated_at: string
  tipo?: AssetType
}

export type AuthorProfile = {
  id: number
  slug: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  role: string | null
  // Traducción al inglés (null = sin traducir: se muestra el texto base en español)
  bio_en?: string | null
  role_en?: string | null
  // false = no aparece en el listado /autor (p. ej. el perfil de la marca)
  listed?: boolean
  twitter_url: string | null
  linkedin_url: string | null
  website_url: string | null
  created_at: string
  updated_at: string
}

export type Source = {
  id: number
  name: string
  url: string | null
  logo_url: string | null
  reliability_score: number
  created_at: string
  updated_at: string
}

export type Tag = {
  id: number
  name: string
  slug: string
  created_at: string
}

// Modelo A: `posts` guarda el original EN SU IDIOMA y `posts.original_locale` dice cuál es.
// Nada en el frontend puede volver a dar por hecho que el original está en español.
export type PostLocale = 'es' | 'en'

// De dónde salió el artículo: `rss` = pipeline automatizado (firma la marca), `cms` = editorial
// humano (firma la persona). Columna de trazabilidad, independiente del autor.
export type PostOrigin = 'rss' | 'cms'

export type PostTranslation = {
  id: number
  post_id: string
  locale: PostLocale
  title: string
  slug: string
  content_html: string
  meta_title: string | null
  meta_description: string | null
  created_at: string
  updated_at: string
}

export type Post = {
  id: string
  title: string
  slug: string
  content_html: string
  meta_title: string | null
  meta_description: string | null
  og_image_url: string | null
  twitter_card: string
  sentiment: 'bullish' | 'bearish' | 'neutral'
  cover_image_url: string | null
  source_url: string | null
  source_id: number | null
  // true = redactado con asistencia de IA por el pipeline: la página debe avisarlo (guía de cumplimiento, P2 #7)
  ai_assisted?: boolean | null
  status: 'draft' | 'published' | 'scheduled'
  format: 'article' | 'brief'
  // Idioma de los campos base (title/slug/content_html) de ESTA fila. `text not null default 'es'`
  // en la DB con CHECK ('es','en'); la cascada de lib/feed.ts lo usa como segundo escalón.
  original_locale: PostLocale
  origen: PostOrigin
  embedding: unknown | null
  search_vector: unknown | null
  view_count: number
  reading_time_minutes: number | null
  is_featured: boolean
  author_id: string | null
  category_id: number | null
  published_at: string | null
  scheduled_at: string | null
  created_at: string
  updated_at: string
  author?: AuthorProfile
  category?: Category
  source?: Source
  assets?: Asset[]
  tags?: Tag[]
  translations?: PostTranslation[]
}

export type PostWithRelations = Omit<
  Post,
  'author' | 'category' | 'source' | 'assets' | 'tags' | 'translations'
> & {
  author: AuthorProfile | null
  category: Category | null
  source: Source | null
  assets: Asset[]
  tags: Tag[]
  translations: PostTranslation[]
}