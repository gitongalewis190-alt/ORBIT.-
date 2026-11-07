-- Storage meter. Purely additive: one read-only function. Applied to production 7 Nov 2026.
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
    union all select 'Decision log', coalesce(sum(pg_column_size(d.*)), 0) from decision_log d where d.user_id = uid
    union all select 'Focus sessions', coalesce(sum(pg_column_size(f.*)), 0) from focus_sessions f where f.user_id = uid
    union all select 'Print records', coalesce(sum(pg_column_size(p.*)), 0) from print_records p where p.user_id = uid
    union all select 'Recall questions', coalesce(sum(pg_column_size(q.*)), 0) from recall_questions q where q.user_id = uid
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
