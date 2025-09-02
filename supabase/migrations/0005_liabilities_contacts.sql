-- 0005_liabilities_contacts.sql
-- Liabilities & zugehörige Dokumente + Contacts

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
create policy "liab_sel_own" on public.liabilities for select using (auth.uid() = user_id);
create policy "liab_ins_own" on public.liabilities for insert with check (auth.uid() = user_id);
create policy "liab_upd_own" on public.liabilities for update using (auth.uid() = user_id);
create policy "liab_del_own" on public.liabilities for delete using (auth.uid() = user_id);

create table if not exists public.liability_documents (
  id uuid primary key default gen_random_uuid(),
  liability_id uuid references public.liabilities(id) on delete cascade,
  file_name text,
  uploaded_at timestamptz default now(),
  text_content text
);

alter table public.liability_documents enable row level security;
create policy "liab_docs_sel_own" on public.liability_documents for select using (exists (select 1 from public.liabilities l where l.id = liability_id and l.user_id = auth.uid()));
create policy "liab_docs_ins_own" on public.liability_documents for insert with check (exists (select 1 from public.liabilities l where l.id = liability_id and l.user_id = auth.uid()));
create policy "liab_docs_upd_own" on public.liability_documents for update using (exists (select 1 from public.liabilities l where l.id = liability_id and l.user_id = auth.uid()));
create policy "liab_docs_del_own" on public.liability_documents for delete using (exists (select 1 from public.liabilities l where l.id = liability_id and l.user_id = auth.uid()));

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
create policy "contacts_sel_own" on public.contacts for select using (auth.uid() = user_id);
create policy "contacts_ins_own" on public.contacts for insert with check (auth.uid() = user_id);
create policy "contacts_upd_own" on public.contacts for update using (auth.uid() = user_id);
create policy "contacts_del_own" on public.contacts for delete using (auth.uid() = user_id);
