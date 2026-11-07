-- Resonance weaves. A bridge the learner chose to write about.
-- The field itself is computed from journal entries. This stores the choice.
create table if not exists public.resonance_weaves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null check (length(trim(prompt)) > 0),
  topics text[] not null default '{}',
  shared text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.resonance_weaves enable row level security;

drop policy if exists "own resonance weaves" on public.resonance_weaves;
create policy "own resonance weaves" on public.resonance_weaves
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists idx_resonance_weaves_user
  on public.resonance_weaves (user_id, created_at desc);

grant select, insert, update, delete on public.resonance_weaves to authenticated;

-- Storage meter now counts the features added after the first meter.
create or replace function public.my_storage_usage()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  with parts(name, bytes) as (
    select 'Journal entries', coalesce(sum(pg_column_size(j.*)), 0) from journal_entries j where j.user_id = uid
    union all select 'Topics you added', coalesce(sum(pg_column_size(t.*)), 0) from topics t where t.user_id = uid
    union all select 'Subfields you added', coalesce(sum(pg_column_size(s.*)), 0) from subfields s where s.user_id = uid
    union all select 'Assignments', coalesce(sum(pg_column_size(a.*)), 0) from assignments a where a.user_id = uid
    union all select 'Reviews', coalesce(sum(pg_column_size(r.*)), 0) from reviews r where r.user_id = uid
    union all select 'Review history', coalesce(sum(pg_column_size(e.*)), 0) from review_events e where e.user_id = uid
    union all select 'Decision log', coalesce(sum(pg_column_size(d.*)), 0) from decision_log d where d.user_id = uid
    union all select 'Focus sessions', coalesce(sum(pg_column_size(f.*)), 0) from focus_sessions f where f.user_id = uid
    union all select 'Print records', coalesce(sum(pg_column_size(p.*)), 0) from print_records p where p.user_id = uid
    union all select 'Recall questions', coalesce(sum(pg_column_size(q.*)), 0) from recall_questions q where q.user_id = uid
    union all select 'Attention', coalesce(sum(pg_column_size(m.*)), 0) from attention_messages m where m.user_id = uid
    union all select 'Atlas', coalesce(sum(pg_column_size(c.*)), 0) from atlas_concepts c where c.user_id = uid
    union all select 'Resonance', coalesce(sum(pg_column_size(w.*)), 0) from resonance_weaves w where w.user_id = uid
    union all select 'Settings and profile', coalesce(sum(pg_column_size(pr.*)), 0) from profiles pr where pr.user_id = uid
  )
  select jsonb_build_object(
    'used_bytes', coalesce(sum(bytes), 0),
    'project_bytes', pg_database_size(current_database()),
    'limit_bytes', 524288000,
    'parts', coalesce(jsonb_agg(jsonb_build_object('name', name, 'bytes', bytes) order by bytes desc), '[]'::jsonb)
  )
  into result
  from parts;

  return result;
end;
$$;

revoke all on function public.my_storage_usage() from public, anon;
grant execute on function public.my_storage_usage() to authenticated;
