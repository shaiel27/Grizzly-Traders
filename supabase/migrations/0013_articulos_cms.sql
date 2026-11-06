-- 0013: lista de artículos del CMS por ámbitos y limpieza automática de los restos de error del pipeline. Idempotente.
--
-- 1) Índice para la lista por ámbito (origen, estado, fecha): la lista ahora filtra en el servidor y se pagina.
-- 2) limpiar_errores_pipeline(dias): borra los restos de error del pipeline con más de `dias` días y lo deja anotado en pipeline_logs.
--    «Resto de error» = borrador del pipeline (origen 'rss', status 'draft') con slug «pendiente-…» (reserva sin terminar), «duplicado-…»
--    (noticia duplicada) o un pipeline_error guardado. Nunca toca artículos publicados ni escritos en el CMS.
--    Esas filas hacen de marca de «esta noticia ya se trató» (el pipeline mira 10 días atrás y las fuentes tienen ventana de 7 días o de 24 h),
--    por eso no se borran al instante sino a los 7 días: una noticia así de antigua ya no entra por la ventana de fechas del pipeline.
-- 3) Programación diaria con pg_cron (ya instalado: lo usa publish-scheduled-posts).

create index if not exists posts_origen_status_created_idx on public.posts (origen, status, created_at desc);

create or replace function public.limpiar_errores_pipeline(dias integer default 7)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  borradas integer;
begin
  if dias is null or dias < 1 then
    raise exception 'dias debe ser al menos 1';
  end if;

  delete from public.posts p
  where p.origen = 'rss'
    and p.status = 'draft'
    and p.created_at < now() - make_interval(days => dias)
    and (p.slug like 'pendiente-%' or p.slug like 'duplicado-%' or p.pipeline_error is not null);
  get diagnostics borradas = row_count;

  if borradas > 0 then
    insert into public.pipeline_logs ("timestamp", fuente, titulo, status, error_message)
    values (now(), 'Limpieza automática', borradas || ' restos de error borrados (más de ' || dias || ' días)', 'success', null);
  end if;

  return borradas;
end;
$$;

-- Solo la base (pg_cron) y la llave de servicio del CMS pueden ejecutarla; ni el público ni los usuarios autenticados
revoke all on function public.limpiar_errores_pipeline(integer) from public, anon, authenticated;

-- Cada día a las 07:17 UTC (03:17 en Caracas). Volver a ejecutar la migración actualiza el trabajo en vez de duplicarlo.
select cron.schedule('limpiar-errores-pipeline', '17 7 * * *', $$select public.limpiar_errores_pipeline(7)$$);
