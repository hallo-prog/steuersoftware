-- 0012_feature_flags.sql
-- Einfache Feature Flags pro User
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  flag text not null,
  enabled boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, flag)
);

alter table public.feature_flags enable row level security;
create policy "feature_flags_sel_own" on public.feature_flags for select using (auth.uid() = user_id);
create policy "feature_flags_ins_own" on public.feature_flags for insert with check (auth.uid() = user_id);
create policy "feature_flags_upd_own" on public.feature_flags for update using (auth.uid() = user_id);
create policy "feature_flags_del_own" on public.feature_flags for delete using (auth.uid() = user_id);
create index if not exists idx_feature_flags_user on public.feature_flags(user_id);

create or replace function public.set_feature_flags_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;
create trigger trg_feature_flags_updated before update on public.feature_flags
for each row execute function public.set_feature_flags_updated_at();
