-- 0015: el pipeline ya no deja filas de error en `posts`. Idempotente.
--
-- Antes, una noticia que fallaba (o resultaba duplicada) dejaba un borrador en `posts` que hacía de «marca» para no volver a procesarla.
-- Ahora esa memoria vive en una tabla ligera, `pipeline_vistos`, que se vacía sola a los 10 días (la ventana que mira el pipeline), y el borrador
-- fallido se borra al momento. `posts` queda solo con artículos de verdad.
--
-- Compatibilidad: `pipeline_claim_post` NO cambia, y el flujo de n8n anterior sigue funcionando con esta migración aplicada (pero deja filas de error
-- hasta que se importe el flujo nuevo). Aplicar esta migración ANTES de importar el flujo nuevo.

create table if not exists public.pipeline_vistos (
  source_url text primary key,
  motivo text not null check (motivo in ('fallo', 'checklist', 'duplicado')),
  intentos integer not null default 1,
  detalle text,
  titulo text,
  visto_en timestamptz not null default now()
);

create index if not exists pipeline_vistos_visto_idx on public.pipeline_vistos (visto_en);

alter table public.pipeline_vistos enable row level security;
-- Sin políticas a propósito: solo la llave de servicio (n8n y el CMS) accede.
revoke all on public.pipeline_vistos from anon, authenticated;

-- 1) Lo que hoy hay guardado como error pasa a la tabla nueva y se borra de `posts`.
--    Nunca se toca una fila con traducciones (sería un artículo con contenido).
insert into public.pipeline_vistos (source_url, motivo, intentos, detalle, titulo, visto_en)
select p.source_url,
       case when p.slug like 'duplicado-%' then 'duplicado'
            when coalesce(p.pipeline_error, '') like 'checklist:%' then 'checklist'
            else 'fallo' end,
       greatest(coalesce(p.pipeline_attempts, 1), case when p.slug like 'duplicado-%' or coalesce(p.pipeline_error, '') like 'checklist:%' then 2 else 1 end),
       left(regexp_replace(coalesce(p.pipeline_error, ''), '^(error|checklist|duplicado): ?', ''), 500),
       left(p.title, 200),
       p.created_at
  from public.posts p
 where p.origen = 'rss'
   and p.status = 'draft'
   and p.source_url is not null
   and (p.slug like 'duplicado-%' or p.pipeline_error is not null)
   and not exists (select 1 from public.posts_translations t where t.post_id = p.id)
on conflict (source_url) do nothing;

delete from public.posts p
 where p.origen = 'rss'
   and p.status = 'draft'
   and not exists (select 1 from public.posts_translations t where t.post_id = p.id)
   and (p.slug like 'duplicado-%'
        or p.pipeline_error is not null
        -- reservas que quedaron a medias por una caída: tras un día ya nadie las está procesando
        or (p.slug like 'pendiente-%' and p.created_at < now() - interval '1 day'));

-- 2) Lo ya tratado en los últimos N horas: artículos + lo visto. Misma forma que la consulta que hacía el flujo sobre `posts`,
--    así el filtro «Descartar ya tratados» no cambia. Una URL que ya es un artículo manda sobre su marca de «visto».
create or replace function public.pipeline_tratados(p_horas integer default 240)
returns table (source_url text, status text, origen text, pipeline_attempts integer, pipeline_error text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.source_url, p.status, p.origen, p.pipeline_attempts::integer, p.pipeline_error, p.created_at
    from public.posts p
   where p.source_url is not null
     and p.created_at >= now() - make_interval(hours => p_horas)
  union all
  select v.source_url, 'draft', 'rss', v.intentos,
         case v.motivo when 'checklist' then 'checklist: ' when 'duplicado' then 'duplicado: ' else 'error: ' end || coalesce(v.detalle, ''),
         v.visto_en
    from public.pipeline_vistos v
   where v.visto_en >= now() - make_interval(hours => p_horas)
     and not exists (select 1 from public.posts p where p.source_url = v.source_url)
$$;

-- 3) Una noticia falló: se recuerda para no insistir y se borra el borrador fallido.
--    Si el borrador ya tiene traducciones (contenido real) no se borra: se queda marcado con el error para revisarlo.
create or replace function public.pipeline_registrar_fallo(p_post_id uuid, p_source_url text, p_titulo text, p_detalle text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motivo text := case when p_motivo in ('checklist', 'duplicado') then p_motivo else 'fallo' end;
begin
  if coalesce(p_source_url, '') <> '' then
    insert into public.pipeline_vistos (source_url, motivo, intentos, detalle, titulo)
    values (p_source_url, v_motivo, case when v_motivo = 'fallo' then 1 else 2 end, left(coalesce(p_detalle, ''), 500), left(coalesce(p_titulo, ''), 200))
    on conflict (source_url) do update
      set intentos = least(public.pipeline_vistos.intentos + 1, 5),
          motivo = excluded.motivo,
          detalle = excluded.detalle,
          visto_en = now();
  end if;

  delete from public.posts p
   where p.origen = 'rss' and p.status = 'draft'
     and (p.id = p_post_id or p.source_url = p_source_url)
     and not exists (select 1 from public.posts_translations t where t.post_id = p.id);

  update public.posts p
     set pipeline_error = left(coalesce(p_detalle, ''), 500)
   where p.origen = 'rss' and p.status = 'draft'
     and (p.id = p_post_id or p.source_url = p_source_url)
     and exists (select 1 from public.posts_translations t where t.post_id = p.id);
end;
$$;

-- 4) Una noticia resultó duplicada de otra ya publicada: solo se recuerda.
create or replace function public.pipeline_registrar_duplicado(p_source_url text, p_titulo text, p_similar text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(p_source_url, '') = '' then return; end if;
  insert into public.pipeline_vistos (source_url, motivo, intentos, detalle, titulo)
  values (p_source_url, 'duplicado', 2, left(coalesce(p_similar, ''), 500), left(coalesce(p_titulo, ''), 200))
  on conflict (source_url) do update set motivo = 'duplicado', intentos = 2, detalle = excluded.detalle, visto_en = now();

  delete from public.posts p
   where p.origen = 'rss' and p.status = 'draft' and p.source_url = p_source_url
     and not exists (select 1 from public.posts_translations t where t.post_id = p.id);
end;
$$;

-- 5) Limpieza diaria: reservas que quedaron a medias (más de `dias` día) y marcas de «visto» de más de 10 días.
create or replace function public.limpiar_errores_pipeline(dias integer default 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  borradas integer;
begin
  with b as (
    delete from public.posts p
     where p.origen = 'rss' and p.status = 'draft'
       and not exists (select 1 from public.posts_translations t where t.post_id = p.id)
       and (p.slug like 'pendiente-%' or p.slug like 'duplicado-%' or p.pipeline_error is not null)
       and p.created_at < now() - make_interval(days => dias)
    returning 1
  )
  select count(*) into borradas from b;

  delete from public.pipeline_vistos where visto_en < now() - interval '10 days';

  if borradas > 0 then
    insert into public.pipeline_logs ("timestamp", fuente, titulo, status, error_message)
    values (now(), 'Limpieza automática', borradas || ' reservas del pipeline sin terminar borradas (más de ' || dias || ' día/s)', 'success', null);
  end if;
  return borradas;
end;
$$;

revoke all on function public.pipeline_tratados(integer) from public, anon, authenticated;
revoke all on function public.pipeline_registrar_fallo(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.pipeline_registrar_duplicado(text, text, text) from public, anon, authenticated;
revoke all on function public.limpiar_errores_pipeline(integer) from public, anon, authenticated;
grant execute on function public.pipeline_tratados(integer) to service_role;
grant execute on function public.pipeline_registrar_fallo(uuid, text, text, text, text) to service_role;
grant execute on function public.pipeline_registrar_duplicado(text, text, text) to service_role;
grant execute on function public.limpiar_errores_pipeline(integer) to service_role;

-- La limpieza diaria (pg_cron) pasa a borrar las reservas a medias a las 24 h
select cron.schedule('limpiar-errores-pipeline', '17 7 * * *', $cron$select public.limpiar_errores_pipeline(1)$cron$);
