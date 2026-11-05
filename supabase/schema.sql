-- ORBIT schema v1
-- Run once in the Supabase SQL editor, then run supabase/seed.sql.

create table if not exists fields (
  id text primary key,
  name text not null
);

create table if not exists subfields (
  id text primary key,
  field_id text not null references fields(id) on delete cascade,
  name text not null
);

create table if not exists topics (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references auth.users(id) on delete cascade,   -- null = library topic
  subfield_id text not null references subfields(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  difficulty text not null default 'intermediate'
    check (difficulty in ('beginner', 'intermediate', 'advanced')),
  prerequisite_id text references topics(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists field_links (
  field_a text not null references fields(id) on delete cascade,
  field_b text not null references fields(id) on delete cascade,
  primary key (field_a, field_b)
);

create table if not exists topic_controls (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id text not null references topics(id) on delete cascade,
  state text not null check (state in ('normal', 'show_more', 'show_less', 'archived', 'removed')),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id text not null references topics(id) on delete cascade,
  assigned_on date not null,
  due_on date not null,
  est_minutes int not null check (est_minutes > 0),
  mode text not null,
  status text not null default 'generated'
    check (status in ('generated', 'accepted', 'rejected', 'completed', 'deferred')),
  created_at timestamptz not null default now()
);

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id text references topics(id) on delete set null,
  assignment_id uuid references assignments(id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  key_points text[] not null default '{}',
  confidence int check (confidence between 0 and 5),
  minutes_spent int check (minutes_spent is null or minutes_spent >= 0),
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id text not null references topics(id) on delete cascade,
  due_on date not null,
  interval_days int not null default 1,
  ease numeric not null default 2.5,
  reps int not null default 0,
  primary key (user_id, topic_id)
);

create table if not exists decision_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,
  topic_id text references topics(id) on delete set null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_topics_subfield on topics(subfield_id);
create index if not exists idx_topics_owner on topics(user_id);
create index if not exists idx_subfields_field on subfields(field_id);
create index if not exists idx_assign_user_day on assignments(user_id, assigned_on);
create index if not exists idx_journal_user on journal_entries(user_id, created_at desc);
create index if not exists idx_reviews_due on reviews(user_id, due_on);
create index if not exists idx_decision_user on decision_log(user_id, created_at desc);

-- Row level security: library is readable by everyone signed in,
-- every personal row is private to its owner.
alter table fields enable row level security;
alter table subfields enable row level security;
alter table field_links enable row level security;

create policy "read fields" on fields for select to authenticated using (true);
create policy "read subfields" on subfields for select to authenticated using (true);
create policy "read field_links" on field_links for select to authenticated using (true);

alter table topics enable row level security;
create policy "read library and own topics" on topics for select to authenticated
  using (user_id is null or user_id = auth.uid());
create policy "insert own topics" on topics for insert to authenticated
  with check (user_id = auth.uid());
create policy "update own topics" on topics for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own topics" on topics for delete to authenticated
  using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['assignments', 'journal_entries', 'reviews', 'decision_log', 'topic_controls'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "own rows" on %I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;
