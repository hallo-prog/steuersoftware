-- Migration 0001_init.sql
-- Basistabellen & Policies (aus supabase_schema.sql extrahierter Kern)
create extension if not exists pgcrypto;

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

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  date timestamptz not null,
  year smallint not null,
  quarter smallint not null check (quarter between 1 and 4),
  source text,
  status text,
  storage_provider text,
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
  insurance_policy_id uuid,
  liability_id uuid,
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

create index if not exists idx_documents_user_date on public.documents(user_id, date desc);
create index if not exists idx_documents_invoice_number on public.documents(invoice_number);
create index if not exists idx_documents_liability on public.documents(liability_id);

-- Weitere Tabellen (rules, liabilities, insurance, contacts, etc.) könnten in separaten Migrations folgen.
