-- Chat History Tables
create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Neue Unterhaltung',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  role text not null check (role in ('user','model')),
  content text not null,
  raw_content text,
  created_at timestamptz not null default now()
);

create index if not exists chat_threads_user_id_idx on chat_threads(user_id);
create index if not exists chat_messages_thread_id_created_at_idx on chat_messages(thread_id, created_at);

-- Update trigger for updated_at
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;$$ language plpgsql;

drop trigger if exists trg_chat_threads_updated on chat_threads;
create trigger trg_chat_threads_updated before update on chat_threads
for each row execute function set_updated_at();

-- RLS Policies
alter table chat_threads enable row level security;
alter table chat_messages enable row level security;

-- Threads: owner can do all
create policy chat_threads_select on chat_threads for select using (auth.uid() = user_id);
create policy chat_threads_modify on chat_threads for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Messages: link through thread
create policy chat_messages_select on chat_messages for select using (
  exists (select 1 from chat_threads t where t.id = thread_id and t.user_id = auth.uid())
);
create policy chat_messages_modify on chat_messages for all using (
  exists (select 1 from chat_threads t where t.id = thread_id and t.user_id = auth.uid())
 ) with check (
  exists (select 1 from chat_threads t where t.id = thread_id and t.user_id = auth.uid())
 );
