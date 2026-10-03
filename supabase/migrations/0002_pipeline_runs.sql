-- Una fila por corrida del pipeline de noticias de n8n (execution_id de n8n), para poder ver
-- cuanto tardo cada corrida y cruzarla con pipeline_logs (fuente/titulo/status por candidato).
-- Ya aplicada en Supabase vía Management API esta sesión; este archivo documenta el esquema.
create table if not exists public.pipeline_runs (
  execution_id text primary key,
  started_at timestamptz not null,
  finished_at timestamptz
);

create index if not exists pipeline_runs_started_at_idx on public.pipeline_runs (started_at);

alter table public.pipeline_runs enable row level security;

drop policy if exists "Service role full access pipeline runs" on public.pipeline_runs;
create policy "Service role full access pipeline runs"
  on public.pipeline_runs
  for all
  to service_role
  using (true)
  with check (true);

-- n8n escribe con la anon key (mismo patrón que economic_events y posts).
drop policy if exists "Public insert pipeline runs" on public.pipeline_runs;
create policy "Public insert pipeline runs"
  on public.pipeline_runs
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public update pipeline runs" on public.pipeline_runs;
create policy "Public update pipeline runs"
  on public.pipeline_runs
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated read pipeline runs" on public.pipeline_runs;
create policy "Authenticated read pipeline runs"
  on public.pipeline_runs
  for select
  to authenticated
  using (true);
