-- Recall model. Adds memory columns beside the existing SM-2 columns.
-- review_events is the history. reviews remains the current row per topic.

alter table public.reviews
  add column if not exists stability numeric,
  add column if not exists difficulty numeric,
  add column if not exists last_reviewed_on date;

create table if not exists public.review_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id text not null references public.topics(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  confidence int,
  grade int not null,
  observed_recall int not null,
  elapsed_days numeric not null default 0,
  stability_before numeric,
  difficulty_before numeric,
  k_used numeric not null,
  stability_after numeric not null,
  difficulty_after numeric not null,
  derived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint review_events_grade check (grade between 1 and 4),
  constraint review_events_observed check (observed_recall in (0, 1))
);

alter table public.review_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'review_events' and policyname = 'own review events'
  ) then
    create policy "own review events" on public.review_events
      for all
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id
        and exists (
          select 1 from public.journal_entries j
          where j.id = review_events.id and j.user_id = (select auth.uid())
        ));
  end if;
end $$;

create index if not exists review_events_user_time on public.review_events (user_id, reviewed_at);
