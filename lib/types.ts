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

export type PostTranslation = {
  id: number
  post_id: string
  locale: 'es' | 'en'
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
  status: 'draft' | 'published' | 'scheduled'
  format: 'article' | 'brief'
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