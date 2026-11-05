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

-- ===== Version 2 =====
alter table subfields add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop policy if exists "read subfields" on subfields;
create policy "read library and own subfields" on subfields for select to authenticated
  using (user_id is null or user_id = auth.uid());
create policy "insert own subfields" on subfields for insert to authenticated
  with check (user_id = auth.uid());
create policy "delete own subfields" on subfields for delete to authenticated
  using (user_id = auth.uid());

alter table journal_entries add column if not exists word_count int not null default 0;

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  daily_minutes int not null default 90 check (daily_minutes between 15 and 480),
  word_goal int not null default 150 check (word_goal between 20 and 2000),
  weekly_entry_goal int not null default 5 check (weekly_entry_goal between 1 and 7),
  theme text not null default 'light' check (theme in ('light', 'dark', 'system')),
  sound_on boolean not null default true,
  sound_volume int not null default 70 check (sound_volume between 0 and 100),
  timezone text not null default 'Africa/Nairobi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null,
  unlocked_on timestamptz not null default now(),
  primary key (user_id, badge_key)
);

alter table profiles enable row level security;
alter table user_badges enable row level security;

create policy "own profile" on profiles for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own badges" on user_badges for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== Version 3: tags, freezes, focus sessions, age, onboarding, delete account =====
alter table journal_entries add column if not exists tags text[] not null default '{}';
alter table profiles add column if not exists onboarded boolean not null default false;
alter table profiles add column if not exists age int check (age is null or age between 5 and 120);

create table if not exists streak_freezes (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
create table if not exists focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  minutes int not null check (minutes > 0 and minutes <= 480),
  created_at timestamptz not null default now()
);
alter table streak_freezes enable row level security;
alter table focus_sessions enable row level security;
create policy "own freezes" on streak_freezes for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own focus sessions" on focus_sessions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_focus_user_day on focus_sessions(user_id, day);

create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function delete_my_account() from public;
grant execute on function delete_my_account() to authenticated;

-- ===== Version 4: personal profile details =====
alter table profiles add column if not exists full_name text;
alter table profiles add column if not exists date_of_birth date;
alter table profiles add column if not exists location text;
alter table profiles add column if not exists school_or_work text;
alter table profiles add column if not exists learning_goal text;
alter table profiles add column if not exists bio text;
