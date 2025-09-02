-- 0011_policy_versions_risk_claim_events.sql
-- Policy Versionierung, Risk Assessments Historie & Claim Events + Status Machine Vorbereitung

-- Policy Versions (Historisierung jeder Änderung)
create table if not exists public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references public.insurance_policies(id) on delete cascade,
  snapshot_json jsonb not null,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz default now()
);

alter table public.policy_versions enable row level security;
create policy "policy_versions_sel_own" on public.policy_versions for select using (
  exists (select 1 from public.insurance_policies p where p.id = policy_id and p.user_id = auth.uid())
);
create policy "policy_versions_ins_own" on public.policy_versions for insert with check (
  exists (select 1 from public.insurance_policies p where p.id = policy_id and p.user_id = auth.uid())
);
create index if not exists idx_policy_versions_policy on public.policy_versions(policy_id);

-- Risk Assessments Historie
create table if not exists public.policy_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references public.insurance_policies(id) on delete cascade,
  risk_score real check (risk_score between 0 and 1),
  risk_gaps text[],
  recommendation text,
  model text,
  created_at timestamptz default now()
);

alter table public.policy_risk_assessments enable row level security;
create policy "policy_risk_sel_own" on public.policy_risk_assessments for select using (
  exists (select 1 from public.insurance_policies p where p.id = policy_id and p.user_id = auth.uid())
);
create policy "policy_risk_ins_own" on public.policy_risk_assessments for insert with check (
  exists (select 1 from public.insurance_policies p where p.id = policy_id and p.user_id = auth.uid())
);
create index if not exists idx_policy_risk_policy on public.policy_risk_assessments(policy_id);

-- Claim Events (Status Timeline / Audit)
create table if not exists public.claim_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.insurance_claims(id) on delete cascade,
  event_type text not null,
  payload_json jsonb,
  created_at timestamptz default now()
);

alter table public.claim_events enable row level security;
create policy "claim_events_sel_own" on public.claim_events for select using (
  exists (select 1 from public.insurance_claims c join public.insurance_policies p on p.id = c.policy_id where c.id = claim_id and p.user_id = auth.uid())
);
create policy "claim_events_ins_own" on public.claim_events for insert with check (
  exists (select 1 from public.insurance_claims c join public.insurance_policies p on p.id = c.policy_id where c.id = claim_id and p.user_id = auth.uid())
);
create index if not exists idx_claim_events_claim on public.claim_events(claim_id);
