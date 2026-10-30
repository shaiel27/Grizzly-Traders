-- 0007: boletín con doble confirmación y resumen diario.
-- Idempotente: se puede ejecutar más de una vez. NO se aplica desde el código; se corre a mano en el editor SQL de Supabase.

-- ------------------------------------------------------------------------------------------------
-- 1) Suscriptores: estado, consentimiento, idioma y tokens
-- ------------------------------------------------------------------------------------------------
alter table public.subscribers
  add column if not exists status text not null default 'pending',
  add column if not exists locale text not null default 'es',
  add column if not exists consented_at timestamptz,
  add column if not exists consent_text text,
  add column if not exists source_url text,
  add column if not exists ip_hash text,
  add column if not exists token_hash text,
  add column if not exists token_purpose text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists token_sent_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- El alta guarda los correos en minúsculas y las consultas comparan con igualdad exacta.
-- El índice único sobre lower(email) (0001) impide que esto genere colisiones.
update public.subscribers set email = lower(email) where email <> lower(email);

alter table public.subscribers drop constraint if exists subscribers_status_check;
alter table public.subscribers
  add constraint subscribers_status_check check (status in ('pending', 'confirmed', 'unsubscribed'));

alter table public.subscribers drop constraint if exists subscribers_locale_check;
alter table public.subscribers
  add constraint subscribers_locale_check check (locale in ('es', 'en'));

alter table public.subscribers drop constraint if exists subscribers_token_purpose_check;
alter table public.subscribers
  add constraint subscribers_token_purpose_check check (token_purpose is null or token_purpose in ('confirm', 'unsubscribe'));

-- Un token (guardado solo como hash) identifica a un único suscriptor
create unique index if not exists subscribers_token_hash_key on public.subscribers (token_hash) where token_hash is not null;
create index if not exists subscribers_status_idx on public.subscribers (status);

-- Quien ya estaba en la tabla se apuntó con el formulario anterior, sin confirmación ni consentimiento
-- registrado. Esas filas quedan en 'pending' y sin token: no reciben nada hasta que vuelvan a suscribirse y confirmen.

-- ------------------------------------------------------------------------------------------------
-- 2) Cerrar la escritura pública
-- ------------------------------------------------------------------------------------------------
-- Con la política anterior ("Anyone can subscribe") cualquiera podía insertar filas directamente con la llave
-- anónima, incluso con status = 'confirmed' y saltarse la doble confirmación. Desde ahora solo el servidor
-- (llave de servicio) lee y escribe esta tabla.
drop policy if exists "Anyone can subscribe" on public.subscribers;
alter table public.subscribers enable row level security;
revoke all on public.subscribers from anon, authenticated;

-- ------------------------------------------------------------------------------------------------
-- 3) Registro de resúmenes enviados (impide enviar dos veces el mismo día e idioma)
-- ------------------------------------------------------------------------------------------------
create table if not exists public.newsletter_digests (
  digest_date date not null,
  locale text not null check (locale in ('es', 'en')),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  broadcast_id text,
  post_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (digest_date, locale)
);

alter table public.newsletter_digests enable row level security;
revoke all on public.newsletter_digests from anon, authenticated;

-- Si un envío queda en 'sending' por una caída, NO se reintenta solo (evita duplicar el envío a toda la lista).
-- Para reintentarlo a mano, tras comprobar en el proveedor que no salió:
--   update public.newsletter_digests set status = 'failed' where digest_date = 'AAAA-MM-DD' and locale = 'es';
