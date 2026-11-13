-- 0016: CNBC y PR Newswire como fuentes del pipeline. Idempotente.
--
-- Los ids están fijados en n8n/pipeline-noticias.json (mapa `fuente -> id` en dos nodos), así que se insertan con id explícito.
-- APLICAR ANTES de importar el flujo: si el flujo manda un source_id que no existe, el alta del artículo falla por la clave foránea.
-- Ambas se añaden por decisión informada del usuario; sus términos y riesgos están en docs/fuentes.md.
insert into public.fuentes (id, name, url, reliability_score)
values
  (19, 'CNBC', 'https://www.cnbc.com', 80),
  (20, 'PR Newswire (comunicados de empresas)', 'https://www.prnewswire.com', 60)
on conflict (id) do nothing;

do $$
declare secuencia text := pg_get_serial_sequence('public.fuentes', 'id');
begin
  if secuencia is not null then
    perform setval(secuencia, greatest((select max(id) from public.fuentes), 20));
  end if;
end $$;
