-- 0013: Coverage Items, Exclusions, Claim Attachments, Dossier Snapshots, User Terms
-- Idempotente Erstellung, falls Tabellen bereits existieren wird nichts überschrieben.

create table if not exists coverage_items (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references insurance_policies(id) on delete cascade,
  label text not null,
  limit_amount numeric,
  deductible_amount numeric,
  created_at timestamptz default now()
);
create index if not exists idx_coverage_items_policy on coverage_items(policy_id);

create table if not exists exclusions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references insurance_policies(id) on delete cascade,
  label text not null,
  created_at timestamptz default now()
);
create index if not exists idx_exclusions_policy on exclusions(policy_id);

-- Claim Attachments
create table if not exists claim_attachments (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade,
  kind text check (kind in ('note','hinweis','korrespondenz','media','dokument')),
  title text,
  content text,
  storage_path text,
  mime_type text,
  meta jsonb,
  created_at timestamptz default now(),
  created_by uuid references profiles(id)
);
create index if not exists idx_claim_att_claim on claim_attachments(claim_id);

-- Claim Dossier Snapshots
create table if not exists claim_dossier_snapshots (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade,
  snapshot_json jsonb not null,
  model text,
  generated_at timestamptz default now()
);
create index if not exists idx_claim_dossier_claim on claim_dossier_snapshots(claim_id);

-- User Terms Documents (AGB)
create table if not exists user_terms_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  file_name text,
  storage_path text,
  extracted_text text,
  uploaded_at timestamptz default now()
);
create index if not exists idx_user_terms_user on user_terms_documents(user_id);

-- Basic RLS placeholders (anpassen später)
alter table coverage_items enable row level security;
alter table exclusions enable row level security;
alter table claim_attachments enable row level security;
alter table claim_dossier_snapshots enable row level security;
alter table user_terms_documents enable row level security;

-- Simple policies (assumes policies & claims have user_id column; adjust if necessary)
-- NOTE: Falls insurance_policies / claims keine user_id Spalte besitzen, müssen Policies später ergänzt werden.
do $$ begin
  execute 'create policy "coverage_items_owner" on coverage_items for all using (exists (select 1 from insurance_policies p where p.id = coverage_items.policy_id))';
exception when duplicate_object then null; end $$;
do $$ begin
  execute 'create policy "exclusions_owner" on exclusions for all using (exists (select 1 from insurance_policies p where p.id = exclusions.policy_id))';
exception when duplicate_object then null; end $$;
do $$ begin
  execute 'create policy "claim_attachments_owner" on claim_attachments for all using (exists (select 1 from claims c where c.id = claim_attachments.claim_id))';
exception when duplicate_object then null; end $$;
do $$ begin
  execute 'create policy "claim_dossier_snapshots_owner" on claim_dossier_snapshots for all using (exists (select 1 from claims c where c.id = claim_dossier_snapshots.claim_id))';
exception when duplicate_object then null; end $$;
do $$ begin
  execute 'create policy "user_terms_documents_owner" on user_terms_documents for all using (auth.uid() = user_terms_documents.user_id)';
exception when duplicate_object then null; end $$;
