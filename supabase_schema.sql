-- Supabase Schema für steuersoftware
-- Ausführen im SQL Editor oder via CLI: supabase db push

create extension if not exists pgcrypto;

-- PROFILE / USER ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  tax_id text,
  vat_id text,
  tax_number text,
  company_form text,
  employees integer,
  location_country text,
  location_state text,
  location_city text,
  industry text,
  founding_year integer,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_upsert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- DOCUMENTS -----------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  date timestamptz not null,
  year smallint not null,
  quarter smallint not null check (quarter between 1 and 4),
  source text,
  status text,
  storage_provider text, -- 'supabase' | 'r2' (null = historisch = 'supabase')
  file_url text,
  text_content text,
  vendor text,
  total_amount numeric(12,2),
  vat_amount numeric(12,2),
  invoice_number text,
  invoice_type text,
  tax_category text,
  ai_suggested_tax_category text,
  flags text[] default array[]::text[],
  anomaly_score real,
  embedding real[],
  insurance_policy_id uuid references public.insurance_policies(id) on delete set null,
  liability_id uuid references public.liabilities(id) on delete set null,
  lexoffice_status text,
  lexoffice_sent_at timestamptz,
  error_message text,
  created_at timestamptz default now()
);

alter table public.documents enable row level security;
create policy "documents_select_own" on public.documents for select using (auth.uid() = user_id);
create policy "documents_ins_own" on public.documents for insert with check (auth.uid() = user_id);
create policy "documents_upd_own" on public.documents for update using (auth.uid() = user_id);
create policy "documents_del_own" on public.documents for delete using (auth.uid() = user_id);

-- RULES ---------------------------------------------------------------------
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

-- FUNDING OPPORTUNITIES (global data) ---------------------------------------
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
  level text,
  land text,
  grant_amount_min numeric(14,2),
  grant_amount_max numeric(14,2),
  coverage_rate_percent numeric(5,2),
  valid_from date,
  valid_to date,
  notes text,
  requires text[],
  disqualified_reason text,
  employee_range_min int,
  employee_range_max int
);

-- Favorites relation (user-specific) ----------------------------------------
create table if not exists public.funding_favorites (
  user_id uuid references public.profiles(id) on delete cascade,
  opportunity_id uuid references public.funding_opportunities(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, opportunity_id)
);

alter table public.funding_favorites enable row level security;
create policy "funding_fav_sel_own" on public.funding_favorites for select using (auth.uid() = user_id);
create policy "funding_fav_mod_own" on public.funding_favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- INSURANCE -----------------------------------------------------------------
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

create table if not exists public.insurance_policy_documents (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references public.insurance_policies(id) on delete cascade,
  file_name text,
  uploaded_at timestamptz default now(),
  text_content text,
  storage_path text -- Pfad im Storage Bucket (rekonstruiert public URL)
);

alter table if not exists public.insurance_policy_documents enable row level security;
create policy if not exists "policy_docs_sel_own" on public.insurance_policy_documents for select using (exists (select 1 from public.insurance_policies p where p.id = policy_id and p.user_id = auth.uid()));
create policy if not exists "policy_docs_ins_own" on public.insurance_policy_documents for insert with check (exists (select 1 from public.insurance_policies p where p.id = policy_id and p.user_id = auth.uid()));
create policy if not exists "policy_docs_upd_own" on public.insurance_policy_documents for update using (exists (select 1 from public.insurance_policies p where p.id = policy_id and p.user_id = auth.uid()));
create policy if not exists "policy_docs_del_own" on public.insurance_policy_documents for delete using (exists (select 1 from public.insurance_policies p where p.id = policy_id and p.user_id = auth.uid()));

create table if not exists public.insurance_claim_documents (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.insurance_claims(id) on delete cascade,
  file_name text,
  uploaded_at timestamptz default now(),
  text_content text
);

alter table if not exists public.insurance_claim_documents enable row level security;
create policy if not exists "claim_docs_sel_own" on public.insurance_claim_documents for select using (exists (select 1 from public.insurance_claims c join public.insurance_policies p on p.id = c.policy_id where c.id = claim_id and p.user_id = auth.uid()));
create policy if not exists "claim_docs_ins_own" on public.insurance_claim_documents for insert with check (exists (select 1 from public.insurance_claims c join public.insurance_policies p on p.id = c.policy_id where c.id = claim_id and p.user_id = auth.uid()));
create policy if not exists "claim_docs_upd_own" on public.insurance_claim_documents for update using (exists (select 1 from public.insurance_claims c join public.insurance_policies p on p.id = c.policy_id where c.id = claim_id and p.user_id = auth.uid()));
create policy if not exists "claim_docs_del_own" on public.insurance_claim_documents for delete using (exists (select 1 from public.insurance_claims c join public.insurance_policies p on p.id = c.policy_id where c.id = claim_id and p.user_id = auth.uid()));

-- DEADLINES (user-specific) -------------------------------------------------
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

-- INDEXES -------------------------------------------------------------------
create index if not exists idx_documents_user_date on public.documents(user_id, date desc);
create index if not exists idx_documents_invoice_number on public.documents(invoice_number);
create index if not exists idx_policies_user on public.insurance_policies(user_id);
create index if not exists idx_claims_policy on public.insurance_claims(policy_id);
create index if not exists idx_rules_user on public.rules(user_id);
create index if not exists idx_documents_liability on public.documents(liability_id);

-- TRIGGER to keep policies.updated_at fresh ---------------------------------
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_policies_updated before update on public.insurance_policies
for each row execute function public.set_updated_at();

-- DONE ----------------------------------------------------------------------

-- VERBINDLICHKEITEN (Liabilities) OPTIONAL (noch nicht im UI mit DB verdrahtet)
create table if not exists public.liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  creditor text,
  contract_number text,
  start_date date,
  end_date date,
  payment_interval text,
  outstanding_amount numeric(14,2),
  original_amount numeric(14,2),
  interest_rate_percent numeric(6,3),
  category text,
  notes text,
  tags text[],
  contact_email text,
  contact_phone text,
  ai_risk_score real,
  ai_recommendation text,
  ai_summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.liabilities enable row level security;
create policy if not exists "liab_sel_own" on public.liabilities for select using (auth.uid() = user_id);
create policy if not exists "liab_ins_own" on public.liabilities for insert with check (auth.uid() = user_id);
create policy if not exists "liab_upd_own" on public.liabilities for update using (auth.uid() = user_id);
create policy if not exists "liab_del_own" on public.liabilities for delete using (auth.uid() = user_id);

create table if not exists public.liability_documents (
  id uuid primary key default gen_random_uuid(),
  liability_id uuid references public.liabilities(id) on delete cascade,
  file_name text,
  uploaded_at timestamptz default now(),
  text_content text
);

alter table public.liability_documents enable row level security;
create policy if not exists "liab_docs_sel_own" on public.liability_documents for select using (exists (select 1 from public.liabilities l where l.id = liability_id and l.user_id = auth.uid()));
create policy if not exists "liab_docs_ins_own" on public.liability_documents for insert with check (exists (select 1 from public.liabilities l where l.id = liability_id and l.user_id = auth.uid()));
create policy if not exists "liab_docs_upd_own" on public.liability_documents for update using (exists (select 1 from public.liabilities l where l.id = liability_id and l.user_id = auth.uid()));
create policy if not exists "liab_docs_del_own" on public.liability_documents for delete using (exists (select 1 from public.liabilities l where l.id = liability_id and l.user_id = auth.uid()));

-- Kontakte (aggregiert / optional persistiert für KI Anreicherung)
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  type text,
  email text,
  phone text,
  source_ids text[],
  tags text[],
  last_document_date date,
  notes text,
  ai_summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.contacts enable row level security;
create policy if not exists "contacts_sel_own" on public.contacts for select using (auth.uid() = user_id);
create policy if not exists "contacts_ins_own" on public.contacts for insert with check (auth.uid() = user_id);
create policy if not exists "contacts_upd_own" on public.contacts for update using (auth.uid() = user_id);
create policy if not exists "contacts_del_own" on public.contacts for delete using (auth.uid() = user_id);

