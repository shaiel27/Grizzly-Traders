-- 0011: fuentes públicas nuevas del pipeline (opción A: solo fuentes de dominio público o reutilización libre). Idempotente.
--
-- El flujo atribuye cada nota con `posts.source_id` (atribución estructurada que el sitio muestra como «Fuente oficial: …»).
-- Los ids están fijados en n8n/pipeline-noticias.json (mapa `fuente -> id`), así que se insertan con id explícito.
insert into public.fuentes (id, name, url, reliability_score)
values
  (12, 'Banco Central Europeo', 'https://www.ecb.europa.eu', 50),
  (13, 'EIA (Administración de Información Energética de EE. UU.)', 'https://www.eia.gov', 50),
  (14, 'BEA (Oficina de Análisis Económico de EE. UU.)', 'https://www.bea.gov', 50)
on conflict (id) do nothing;

-- La secuencia sigue al máximo id para que un alta posterior no choque con los ids fijados a mano
do $$
declare secuencia text := pg_get_serial_sequence('public.fuentes', 'id');
begin
  if secuencia is not null then
    perform setval(secuencia, greatest((select max(id) from public.fuentes), 14));
  end if;
end $$;
