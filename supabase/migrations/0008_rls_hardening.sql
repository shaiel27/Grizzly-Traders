-- 0008: endurecer RLS y permisos. Idempotente. Se corre a mano en el editor SQL de Supabase (o con apply_migration).
--
-- Contexto: toda escritura legítima usa la llave de servicio (el CMS desde el servidor con createEditorClient y
-- n8n con su credencial `supabaseApi`, que guarda la llave de servicio). La llave anónima viaja al navegador, así
-- que nadie con esa llave debe poder escribir, y ningún usuario con sesión debe poder tocar contenido ajeno.
-- La llave de servicio ignora RLS, por eso las políticas "service_role" no hacen falta y no se tocan.

-- ------------------------------------------------------------------------------------------------
-- 1) Políticas de escritura abiertas
-- ------------------------------------------------------------------------------------------------
-- Cualquiera podía crear, cambiar y borrar vínculos de post con activos y tags
drop policy if exists "Public can manage post_activos" on public.post_activos;
drop policy if exists "Public can manage post_tags" on public.post_tags;
-- Duplicadas de "Lectura publica ..."
drop policy if exists "Public read post_activos" on public.post_activos;
drop policy if exists "Public read post_tags" on public.post_tags;

-- Inserciones con la llave anónima que n8n ya no usa
drop policy if exists "n8n inserta eventos" on public.economic_events;
drop policy if exists "n8n inserta runs" on public.pipeline_runs;
drop policy if exists "anon inserta logs" on public.pipeline_logs;
drop policy if exists "authenticated inserta logs" on public.pipeline_logs;
drop policy if exists "Pipeline inserta traducciones" on public.posts_translations;

-- Cualquier usuario con sesión podía editar todos los perfiles y todos los posts: las políticas eran "true" o
-- comparaban con una tabla que cualquier sesión puede leer. El CMS escribe con la llave de servicio.
drop policy if exists "Autores editan su perfil" on public.perfiles_autores;
drop policy if exists "Autores gestionan sus posts" on public.posts;

-- Los logs y las ejecuciones del pipeline son internos
drop policy if exists "authenticated lee logs" on public.pipeline_logs;
drop policy if exists "Authenticated read pipeline runs" on public.pipeline_runs;

-- ------------------------------------------------------------------------------------------------
-- 2) Storage: el bucket es público (las URL de las imágenes no pasan por RLS). Estas políticas solo permitían
--    listar el bucket y que la llave anónima subiera, reemplazara o que cualquier sesión borrara imágenes.
-- ------------------------------------------------------------------------------------------------
drop policy if exists "n8n sube imagenes" on storage.objects;
drop policy if exists "n8n reemplaza imagenes" on storage.objects;
drop policy if exists "cms borra imagenes" on storage.objects;
drop policy if exists "Public read access for post-images" on storage.objects;
drop policy if exists "imagenes publicas" on storage.objects;

-- ------------------------------------------------------------------------------------------------
-- 3) Permisos de tabla: sin escritura para anon ni authenticated (defensa en profundidad si una política vuelve
--    a abrirse por error) y sin ninguna para las tablas internas.
-- ------------------------------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke all on public.pipeline_logs, public.pipeline_runs from anon, authenticated;

-- Las tablas nuevas no heredan permisos de escritura
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;

-- ------------------------------------------------------------------------------------------------
-- 4) Funciones
-- ------------------------------------------------------------------------------------------------
-- increment_view_count (SECURITY DEFINER) la llama ahora el servidor con la llave de servicio
revoke execute on function public.increment_view_count(uuid) from public, anon, authenticated;
revoke execute on function public.publish_scheduled_posts() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

alter function public.set_updated_at() set search_path = '';
alter function public.update_posts_search_vector() set search_path = '';
alter function public.calculate_reading_time(text) set search_path = '';
alter function public.publish_scheduled_posts() set search_path = '';
