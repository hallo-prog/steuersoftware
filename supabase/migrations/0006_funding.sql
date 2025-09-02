-- 0006_funding.sql
-- Förderprogramme (global) + Favoriten (user-spezifisch)

create table if not exists public.funding_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text,
  description text,
  eligibility_summary text,
  link text,
  relevance_score real,
  fetched_at timestamptz,
  source_urls text[],
  level text,               -- bund | land | eu | other
  land text,                -- Bundesland falls level = land
  grant_amount_min numeric(14,2),
  grant_amount_max numeric(14,2),
  coverage_rate_percent numeric(5,2),
  valid_from date,
  valid_to date,
  notes text,
  requires text[],          -- Anforderungen (Stichworte)
  disqualified_reason text,
  employee_range_min int,
  employee_range_max int
);

-- Global öffentliche Tabelle (keine RLS nötig, lesen für alle User möglich?)
-- Falls nur angemeldete Benutzer lesen dürfen, RLS aktivieren + Policy:
-- alter table public.funding_opportunities enable row level security;
-- create policy "funding_read_all" on public.funding_opportunities for select using (true);

create table if not exists public.funding_favorites (
  user_id uuid references public.profiles(id) on delete cascade,
  opportunity_id uuid references public.funding_opportunities(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, opportunity_id)
);

alter table public.funding_favorites enable row level security;
create policy "funding_fav_sel_own" on public.funding_favorites for select using (auth.uid() = user_id);
create policy "funding_fav_mod_own" on public.funding_favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
