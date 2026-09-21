-- Newsletter subscribers. Run once in the Supabase SQL editor.
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  constraint subscribers_email_format check (position('@' in email) > 1 and length(email) <= 254)
);

create unique index if not exists subscribers_email_lower_key on public.subscribers (lower(email));

alter table public.subscribers enable row level security;

-- Visitors can only add themselves; nobody can read the list through the public API.
drop policy if exists "Anyone can subscribe" on public.subscribers;
create policy "Anyone can subscribe"
  on public.subscribers
  for insert
  to anon, authenticated
  with check (true);
