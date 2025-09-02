-- 0004_insurance.sql
-- Insurance Policies, Claims & zugehörige Dokumente

create table if not exists public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  type text,
  insurer text,
  policy_number text,
  start_date date,
  end_date date,
  payment_interval text,
  premium_amount numeric(12,2),
  coverage_summary text,
  coverage_items text[],
  exclusions text[],
  contact_phone text,
  contact_email text,
  risk_score real,
  risk_gaps text[],
  risk_recommendation text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.insurance_policies enable row level security;
create policy "policies_sel_own" on public.insurance_policies for select using (auth.uid() = user_id);
create policy "policies_ins_own" on public.insurance_policies for insert with check (auth.uid() = user_id);
create policy "policies_upd_own" on public.insurance_policies for update using (auth.uid() = user_id);
create policy "policies_del_own" on public.insurance_policies for delete using (auth.uid() = user_id);
create index if not exists idx_policies_user on public.insurance_policies(user_id);

create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_policies_updated before update on public.insurance_policies
for each row execute function public.set_updated_at();

create table if not exists public.insurance_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  policy_id uuid references public.insurance_policies(id) on delete cascade,
  type text,
  title text not null,
  description text,
  ai_summary text,
  ai_recommendation text,
  status text,
  created_at timestamptz default now()
);

alter table public.insurance_claims enable row level security;
create policy "claims_sel_own" on public.insurance_claims for select using (auth.uid() = user_id);
create policy "claims_ins_own" on public.insurance_claims for insert with check (auth.uid() = user_id);
create policy "claims_upd_own" on public.insurance_claims for update using (auth.uid() = user_id);
create policy "claims_del_own" on public.insurance_claims for delete using (auth.uid() = user_id);
create index if not exists idx_claims_policy on public.insurance_claims(policy_id);

create table if not exists public.insurance_policy_documents (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references public.insurance_policies(id) on delete cascade,
  file_name text,
  uploaded_at timestamptz default now(),
  text_content text
);

alter table public.insurance_policy_documents enable row level security;
create policy "policy_docs_sel_own" on public.insurance_policy_documents for select using (exists (select 1 from public.insurance_policies p where p.id = policy_id and p.user_id = auth.uid()));
create policy "policy_docs_ins_own" on public.insurance_policy_documents for insert with check (exists (select 1 from public.insurance_policies p where p.id = policy_id and p.user_id = auth.uid()));
create policy "policy_docs_upd_own" on public.insurance_policy_documents for update using (exists (select 1 from public.insurance_policies p where p.id = policy_id and p.user_id = auth.uid()));
create policy "policy_docs_del_own" on public.insurance_policy_documents for delete using (exists (select 1 from public.insurance_policies p where p.id = policy_id and p.user_id = auth.uid()));

create table if not exists public.insurance_claim_documents (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.insurance_claims(id) on delete cascade,
  file_name text,
  uploaded_at timestamptz default now(),
  text_content text
);

alter table public.insurance_claim_documents enable row level security;
create policy "claim_docs_sel_own" on public.insurance_claim_documents for select using (exists (select 1 from public.insurance_claims c join public.insurance_policies p on p.id = c.policy_id where c.id = claim_id and p.user_id = auth.uid()));
create policy "claim_docs_ins_own" on public.insurance_claim_documents for insert with check (exists (select 1 from public.insurance_claims c join public.insurance_policies p on p.id = c.policy_id where c.id = claim_id and p.user_id = auth.uid()));
create policy "claim_docs_upd_own" on public.insurance_claim_documents for update using (exists (select 1 from public.insurance_claims c join public.insurance_policies p on p.id = c.policy_id where c.id = claim_id and p.user_id = auth.uid()));
create policy "claim_docs_del_own" on public.insurance_claim_documents for delete using (exists (select 1 from public.insurance_claims c join public.insurance_policies p on p.id = c.policy_id where c.id = claim_id and p.user_id = auth.uid()));
