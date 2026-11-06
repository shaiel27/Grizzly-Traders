-- 0012: fuentes nuevas del pipeline (EDGAR, OCC, FDIC y GlobeNewswire). Idempotente.
--
-- Los ids están fijados en n8n/pipeline-noticias.json (mapa `fuente -> id` en tres nodos), así que se insertan con id explícito.
-- «Fuente oficial: …» es la atribución estructurada que el sitio muestra junto a cada nota.
insert into public.fuentes (id, name, url, reliability_score)
values
  (15, 'Filings de empresas (SEC EDGAR)', 'https://www.sec.gov/edgar', 60),
  (16, 'OCC (Oficina del Contralor de la Moneda de EE. UU.)', 'https://www.occ.gov', 50),
  (17, 'FDIC (Corporación Federal de Seguro de Depósitos de EE. UU.)', 'https://www.fdic.gov', 50),
  (18, 'GlobeNewswire (comunicados de empresas)', 'https://www.globenewswire.com', 60)
on conflict (id) do nothing;

do $$
declare secuencia text := pg_get_serial_sequence('public.fuentes', 'id');
begin
  if secuencia is not null then
    perform setval(secuencia, greatest((select max(id) from public.fuentes), 18));
  end if;
end $$;
