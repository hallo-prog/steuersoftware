-- Migration: Tasks & Audit Events
-- Creates tasks table for AI-generated and user tasks linked to documents.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  title text not null,
  description text,
  priority text check (priority in ('low','normal','high','critical')) default 'normal',
  status text check (status in ('open','in_progress','done','cancelled','auto_executed')) default 'open',
  source text check (source in ('ai','user','system')) default 'ai',
  due_date date,
  auto_action jsonb, -- { "type":"email", "template":"payment_confirmation", "suggested": true }
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;
create policy if not exists "tasks_sel_own" on public.tasks for select using (auth.uid() = user_id);
create policy if not exists "tasks_ins_own" on public.tasks for insert with check (auth.uid() = user_id);
create policy if not exists "tasks_upd_own" on public.tasks for update using (auth.uid() = user_id);
create policy if not exists "tasks_del_own" on public.tasks for delete using (auth.uid() = user_id);

create index if not exists idx_tasks_user_status_due on public.tasks(user_id, status, due_date);
create index if not exists idx_tasks_document on public.tasks(document_id);

-- Simple audit events for traceability
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  correlation_id text,
  actor_type text check (actor_type in ('user','system','ai')) default 'system',
  event_type text not null,
  payload_json jsonb,
  created_at timestamptz default now()
);

alter table public.audit_events enable row level security;
create policy if not exists "audit_sel_own" on public.audit_events for select using (auth.uid() = user_id);
create policy if not exists "audit_ins_own" on public.audit_events for insert with check (auth.uid() = user_id);

create index if not exists idx_audit_user_event on public.audit_events(user_id, event_type, created_at desc);
create index if not exists idx_audit_corr on public.audit_events(correlation_id);

-- Trigger to keep tasks.updated_at fresh
create or replace function public.set_tasks_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_tasks_updated on public.tasks;
create trigger trg_tasks_updated before update on public.tasks
for each row execute function public.set_tasks_updated_at();
