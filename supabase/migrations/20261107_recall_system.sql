-- Recall system. Purely additive: one new table, no changes to existing rows.
-- Each row is one follow-up question about a past journal entry, with the score and the comment.
create table if not exists public.recall_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  topic_id text references public.topics(id) on delete set null,
  topic_title text not null,
  entry_logged_on date not null,
  band text not null,
  question text not null,
  answer text not null check (length(trim(answer)) > 0),
  score int not null check (score between 0 and 100),
  comment text not null default '',
  verifier text not null default 'local',
  asked_at timestamptz not null default now()
);

alter table public.recall_questions enable row level security;

create policy "own recall" on public.recall_questions for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists idx_recall_user_asked on public.recall_questions (user_id, asked_at desc);
create index if not exists idx_recall_entry on public.recall_questions (entry_id, asked_at desc);
