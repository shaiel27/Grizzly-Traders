-- 0009: optimizar las consultas del portal. Idempotente.
--
-- 1) Índices que faltaban (claves foráneas sin índice y la búsqueda del artículo por slug) y los redundantes.
-- 2) Columna `excerpt` en posts y posts_translations: texto plano de ~240 caracteres que mantiene un trigger a
--    partir de `content_html`. Los listados la piden (con el alias `content_html:excerpt`) en vez del HTML completo.
-- 3) RPC `author_stats` para no traer filas solo para contarlas en JavaScript.

-- ------------------------------------------------------------------------------------------------
-- 1) Índices
-- ------------------------------------------------------------------------------------------------
create index if not exists posts_translations_slug_idx on public.posts_translations (slug);
create index if not exists post_activos_asset_id_idx on public.post_activos (asset_id);
create index if not exists post_tags_tag_id_idx on public.post_tags (tag_id);
create index if not exists posts_category_status_published_idx on public.posts (category_id, status, published_at desc);

-- Redundantes: duplican un índice único o son prefijo de otro
drop index if exists public.posts_slug_idx;                         -- posts_slug_key
drop index if exists public.posts_status_idx;                       -- posts_status_published_at_idx
drop index if exists public.posts_category_status_idx;              -- posts_category_status_published_idx
drop index if exists public.posts_translations_locale_slug_idx;     -- posts_translations_locale_slug_key
drop index if exists public.posts_translations_post_id_idx;         -- posts_translations_post_id_locale_key
drop index if exists public.activos_symbol_idx;                     -- activos_symbol_key

-- ------------------------------------------------------------------------------------------------
-- 2) Extracto precalculado
-- ------------------------------------------------------------------------------------------------
alter table public.posts add column if not exists excerpt text;
alter table public.posts_translations add column if not exists excerpt text;

-- Misma limpieza que excerpt() de lib/feed.ts: sin etiquetas, &nbsp; como espacio y espacios colapsados
create or replace function public.html_excerpt(html text, max_chars int default 240)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    btrim(regexp_replace(replace(regexp_replace(coalesce(html, ''), '<[^>]*>', ' ', 'g'), '&nbsp;', ' '), '\s+', ' ', 'g')),
    max_chars
  )
$$;

create or replace function public.set_excerpt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.excerpt := public.html_excerpt(new.content_html);
  return new;
end;
$$;

drop trigger if exists posts_set_excerpt on public.posts;
create trigger posts_set_excerpt
  before insert or update of content_html on public.posts
  for each row execute function public.set_excerpt();

drop trigger if exists posts_translations_set_excerpt on public.posts_translations;
create trigger posts_translations_set_excerpt
  before insert or update of content_html on public.posts_translations
  for each row execute function public.set_excerpt();

-- Relleno de lo existente. Los triggers de usuario se apagan un momento para no tocar `updated_at` de todas las filas.
alter table public.posts disable trigger user;
alter table public.posts_translations disable trigger user;
update public.posts set excerpt = public.html_excerpt(content_html) where excerpt is distinct from public.html_excerpt(content_html);
update public.posts_translations set excerpt = public.html_excerpt(content_html) where excerpt is distinct from public.html_excerpt(content_html);
alter table public.posts enable trigger user;
alter table public.posts_translations enable trigger user;

-- Los triggers los ejecuta quien escribe, no hace falta que anon/authenticated puedan llamar a las funciones
revoke execute on function public.set_excerpt() from public, anon, authenticated;

-- ------------------------------------------------------------------------------------------------
-- 3) Agregados en la base
-- ------------------------------------------------------------------------------------------------
-- Estadísticas de un autor: antes se traían hasta 1000 filas para contarlas en JavaScript
create or replace function public.author_stats(p_author_id bigint)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'posts', (select count(*) from public.posts p where p.author_id = p_author_id and p.status = 'published'),
    'categories', (select count(distinct p.category_id) from public.posts p where p.author_id = p_author_id and p.status = 'published'),
    'assets', (
      select count(distinct pa.asset_id)
      from public.post_activos pa
      join public.posts p on p.id = pa.post_id
      where p.author_id = p_author_id and p.status = 'published'
    )
  )
$$;
grant execute on function public.author_stats(bigint) to anon, authenticated;
