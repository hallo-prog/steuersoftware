-- 0003_rules_deadlines.sql
-- Rules & Deadlines Tabellen + RLS Policies

create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  condition_type text not null,
  condition_value text not null,
  invoice_type text not null,
  result_category text not null,
  created_at timestamptz default now()
);

alter table public.rules enable row level security;
create policy "rules_sel_own" on public.rules for select using (auth.uid() = user_id);
create policy "rules_ins_own" on public.rules for insert with check (auth.uid() = user_id);
create policy "rules_upd_own" on public.rules for update using (auth.uid() = user_id);
create policy "rules_del_own" on public.rules for delete using (auth.uid() = user_id);
create index if not exists idx_rules_user on public.rules(user_id);

create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  due_date date not null,
  created_at timestamptz default now()
);

alter table public.deadlines enable row level security;
create policy "deadlines_sel_own" on public.deadlines for select using (auth.uid() = user_id);
create policy "deadlines_mod_own" on public.deadlines for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
