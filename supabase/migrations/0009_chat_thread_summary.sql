-- Add summary column for rolling chat summaries
alter table chat_threads add column if not exists summary text;

