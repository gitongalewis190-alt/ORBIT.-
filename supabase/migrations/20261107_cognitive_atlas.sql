-- Cognitive Atlas. Additive only. Existing journal, review, and award rows are not changed.

create table if not exists public.atlas_concepts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  description text,
  category text not null default 'concept',
  discipline text,
  status text not null default 'candidate',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name),
  constraint atlas_concepts_category check (category in (
    'concept', 'principle', 'theory', 'definition', 'process', 'operation', 'method',
    'event', 'model', 'question', 'application', 'example', 'discovery', 'discipline'
  )),
  constraint atlas_concepts_status check (status in ('candidate', 'verified', 'archived'))
);

create table if not exists public.atlas_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references public.atlas_concepts(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  unique (user_id, normalized_alias)
);

create table if not exists public.atlas_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references public.atlas_concepts(id) on delete cascade,
  claim_text text not null,
  claim_type text not null default 'note',
  source_span text,
  verification text not null default 'candidate',
  confidence numeric,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint atlas_claims_verification check (verification in ('candidate', 'verified', 'rejected'))
);

create table if not exists public.atlas_edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.atlas_concepts(id) on delete cascade,
  target_id uuid not null references public.atlas_concepts(id) on delete cascade,
  relationship text not null,
  confidence numeric,
  verification text not null default 'candidate',
  origin text not null default 'compiler',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, source_id, target_id, relationship),
  constraint atlas_edges_not_self check (source_id <> target_id),
  constraint atlas_edges_relationship check (relationship in (
    'prerequisite_of', 'part_of', 'contains', 'causes', 'influences', 'analogous_to',
    'contrasts_with', 'applies_to', 'derived_from', 'depends_on', 'example_of', 'related_to'
  )),
  constraint atlas_edges_verification check (verification in ('candidate', 'verified', 'rejected'))
);

create table if not exists public.atlas_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references public.atlas_concepts(id) on delete cascade,
  journal_entry_id uuid references public.journal_entries(id) on delete cascade,
  claim_id uuid references public.atlas_claims(id) on delete set null,
  kind text not null default 'journal',
  created_at timestamptz not null default now(),
  unique (user_id, concept_id, journal_entry_id)
);

create table if not exists public.atlas_mastery (
  concept_id uuid primary key references public.atlas_concepts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  recall numeric,
  explanation numeric,
  application numeric,
  transfer numeric,
  retention numeric,
  n_recall integer not null default 0,
  n_explanation integer not null default 0,
  n_application integer not null default 0,
  n_transfer integer not null default 0,
  n_retention integer not null default 0,
  uncertainty numeric,
  last_assessed timestamptz,
  algorithm_version text not null default 'm1',
  constraint atlas_mastery_bounds check (
    (recall is null or (recall >= 0 and recall <= 1)) and
    (explanation is null or (explanation >= 0 and explanation <= 1)) and
    (application is null or (application >= 0 and application <= 1)) and
    (transfer is null or (transfer >= 0 and transfer <= 1)) and
    (retention is null or (retention >= 0 and retention <= 1))
  )
);

create table if not exists public.atlas_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references public.atlas_concepts(id) on delete cascade,
  kind text not null,
  title text not null,
  prompt text not null,
  difficulty text not null default 'steady',
  rubric jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint atlas_challenges_kind check (kind in ('reconstruction', 'explanation', 'application', 'transfer', 'critique')),
  constraint atlas_challenges_status check (status in ('open', 'answered', 'dismissed'))
);

create unique index if not exists atlas_challenges_one_open
  on public.atlas_challenges (user_id, concept_id, kind)
  where status = 'open';

create table if not exists public.atlas_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid references public.atlas_challenges(id) on delete set null,
  concept_id uuid not null references public.atlas_concepts(id) on delete cascade,
  response text not null,
  predicted numeric,
  score numeric,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint atlas_assessments_score check (score is null or (score >= 0 and score <= 1)),
  constraint atlas_assessments_predicted check (predicted is null or (predicted >= 0 and predicted <= 1))
);

create table if not exists public.atlas_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_entry_id uuid references public.journal_entries(id) on delete cascade,
  job_type text not null default 'compile',
  status text not null default 'queued',
  attempts integer not null default 0,
  error text,
  idempotency_key text not null unique,
  processing_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_jobs_status check (status in ('queued', 'running', 'done', 'failed'))
);

create table if not exists public.atlas_discoveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_ids uuid[] not null default '{}',
  discovery_type text not null,
  title text not null,
  explanation text not null,
  score numeric,
  verification text not null default 'candidate',
  feedback text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, title),
  constraint atlas_discoveries_verification check (verification in ('candidate', 'verified', 'rejected'))
);

create table if not exists public.atlas_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.atlas_concepts enable row level security;
alter table public.atlas_aliases enable row level security;
alter table public.atlas_claims enable row level security;
alter table public.atlas_edges enable row level security;
alter table public.atlas_evidence enable row level security;
alter table public.atlas_mastery enable row level security;
alter table public.atlas_challenges enable row level security;
alter table public.atlas_assessments enable row level security;
alter table public.atlas_processing_jobs enable row level security;
alter table public.atlas_discoveries enable row level security;
alter table public.atlas_feedback enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'atlas_concepts' and policyname = 'own atlas concepts') then
    create policy "own atlas concepts" on public.atlas_concepts for all
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'atlas_aliases' and policyname = 'own atlas aliases') then
    create policy "own atlas aliases" on public.atlas_aliases for all
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id
        and exists (select 1 from public.atlas_concepts c where c.id = concept_id and c.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'atlas_claims' and policyname = 'own atlas claims') then
    create policy "own atlas claims" on public.atlas_claims for all
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id
        and exists (select 1 from public.atlas_concepts c where c.id = concept_id and c.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'atlas_edges' and policyname = 'own atlas edges') then
    create policy "own atlas edges" on public.atlas_edges for all
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id
        and exists (select 1 from public.atlas_concepts c where c.id = source_id and c.user_id = (select auth.uid()))
        and exists (select 1 from public.atlas_concepts c where c.id = target_id and c.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'atlas_evidence' and policyname = 'own atlas evidence') then
    create policy "own atlas evidence" on public.atlas_evidence for all
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id
        and exists (select 1 from public.atlas_concepts c where c.id = concept_id and c.user_id = (select auth.uid()))
        and (journal_entry_id is null or exists (select 1 from public.journal_entries j where j.id = journal_entry_id and j.user_id = (select auth.uid()))));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'atlas_mastery' and policyname = 'own atlas mastery') then
    create policy "own atlas mastery" on public.atlas_mastery for all
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id
        and exists (select 1 from public.atlas_concepts c where c.id = concept_id and c.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'atlas_challenges' and policyname = 'own atlas challenges') then
    create policy "own atlas challenges" on public.atlas_challenges for all
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id
        and exists (select 1 from public.atlas_concepts c where c.id = concept_id and c.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'atlas_assessments' and policyname = 'own atlas assessments') then
    create policy "own atlas assessments" on public.atlas_assessments for all
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id
        and exists (select 1 from public.atlas_concepts c where c.id = concept_id and c.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'atlas_processing_jobs' and policyname = 'own atlas jobs') then
    create policy "own atlas jobs" on public.atlas_processing_jobs for all
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id
        and (source_entry_id is null or exists (select 1 from public.journal_entries j where j.id = source_entry_id and j.user_id = (select auth.uid()))));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'atlas_discoveries' and policyname = 'own atlas discoveries') then
    create policy "own atlas discoveries" on public.atlas_discoveries for all
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'atlas_feedback' and policyname = 'own atlas feedback') then
    create policy "own atlas feedback" on public.atlas_feedback for all
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end $$;

create index if not exists atlas_concepts_user on public.atlas_concepts (user_id, status);
create index if not exists atlas_edges_source on public.atlas_edges (source_id);
create index if not exists atlas_edges_target on public.atlas_edges (target_id);
create index if not exists atlas_evidence_entry on public.atlas_evidence (journal_entry_id);
create index if not exists atlas_jobs_status on public.atlas_processing_jobs (user_id, status);
create index if not exists atlas_assessments_concept on public.atlas_assessments (concept_id, created_at desc);
create index if not exists atlas_discoveries_user on public.atlas_discoveries (user_id, verification);
