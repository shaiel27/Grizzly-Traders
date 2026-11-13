-- 0017: guarda en cada artículo el identificador de su publicación en X (@grizzlytraders). Idempotente.
--
-- Lo escribe el pipeline de n8n al publicar en X (nodo «X - Guardar id»): sirve para saber qué artículos ya salieron en X y no repetirlos.
-- Nullable: los artículos anteriores (y los que no se eligen para X) quedan en null. Si esta migración no está aplicada, la publicación en X sigue
-- funcionando y solo falla (sin efecto en el sitio) el guardado del identificador.
alter table public.posts
  add column if not exists x_post_id text,
  add column if not exists x_publicado_at timestamptz;

-- Un mismo post de X no puede estar asociado a dos artículos
create unique index if not exists posts_x_post_id_uidx on public.posts (x_post_id) where x_post_id is not null;
