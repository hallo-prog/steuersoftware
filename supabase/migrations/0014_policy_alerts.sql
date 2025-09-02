-- 0014: Policy Alerts
create table if not exists policy_alerts (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references insurance_policies(id) on delete cascade,
  alert_type text not null,
  severity text not null check (severity in ('info','warning','critical')),
  message text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(policy_id, alert_type, message)
);
create index if not exists idx_policy_alerts_policy on policy_alerts(policy_id);
create index if not exists idx_policy_alerts_open on policy_alerts(policy_id) where resolved_at is null;
alter table policy_alerts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'policy_alerts_select' and tablename='policy_alerts') then
    create policy policy_alerts_select on policy_alerts for select using ( true );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'policy_alerts_modify' and tablename='policy_alerts') then
    create policy policy_alerts_modify on policy_alerts for all using ( true ) with check ( true );
  end if;
end $$;
