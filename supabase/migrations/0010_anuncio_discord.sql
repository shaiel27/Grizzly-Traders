-- 0010: recordar qué artículos del CMS ya se anunciaron en Discord. Idempotente.
--
-- El pipeline automático anuncia cada nota al publicarla. Los artículos del CMS (manuales o asistidos) los anuncia el flujo
-- "CMS Completar articulo" cuando termina de completarlos. La columna sirve de candado: el flujo la rellena con un UPDATE
-- condicionado (`anunciado_discord_at is null`) y solo publica en Discord si ese UPDATE cambió una fila, así que un artículo
-- no se anuncia dos veces aunque se guarde varias veces o dos ejecuciones coincidan.
alter table public.posts add column if not exists anunciado_discord_at timestamptz;

-- Lo que ya existe no se anuncia: solo los artículos nuevos nacen con la columna vacía
update public.posts set anunciado_discord_at = now() where anunciado_discord_at is null;
