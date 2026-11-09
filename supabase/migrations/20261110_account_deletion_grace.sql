-- Account deletion with a 60 day window.
-- Requesting deletion records a date 60 days ahead and keeps everything. The account can be kept
-- until that date. A daily job (pg_cron) permanently removes accounts whose date has passed.
-- Idempotent: safe to run more than once.

create extension if not exists pg_cron with schema extensions;

create table if not exists public.account_deletions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null,
  export_confirmed boolean not null default false,
  check (scheduled_for > requested_at)
);

alter table public.account_deletions enable row level security;

drop policy if exists "own account deletion" on public.account_deletions;
create policy "own account deletion" on public.account_deletions
  for select to authenticated using ((select auth.uid()) = user_id);

-- Starts the 60 day window. Requires the client to confirm the export was saved.
-- A second request does not move the date: the first one stands.
create or replace function public.request_account_deletion(p_export_confirmed boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  if p_export_confirmed is not true then
    raise exception 'Save your data export before requesting deletion';
  end if;
  insert into public.account_deletions (user_id, requested_at, scheduled_for, export_confirmed)
  values (uid, now(), now() + interval '60 days', true)
  on conflict (user_id) do nothing;
  return (select scheduled_for from public.account_deletions where user_id = uid);
end;
$$;

-- Keeps the account: removes the pending deletion.
create or replace function public.cancel_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from public.account_deletions where user_id = auth.uid();
end;
$$;

-- Permanently removes every account whose 60 day window has passed.
-- Storage copies are removed first, then the auth user, which cascades to every data table.
create or replace function public.purge_due_account_deletions()
returns integer
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  r record;
  n integer := 0;
begin
  for r in select user_id from public.account_deletions where scheduled_for <= now() loop
    begin
      set local storage.allow_delete_query = 'true';
      delete from storage.objects
       where bucket_id = 'print-records'
         and (storage.foldername(name))[1] = r.user_id::text;
    exception when others then
      null;
    end;
    delete from auth.users where id = r.user_id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.request_account_deletion(boolean) from public, anon;
grant execute on function public.request_account_deletion(boolean) to authenticated;
revoke all on function public.cancel_account_deletion() from public, anon;
grant execute on function public.cancel_account_deletion() to authenticated;
revoke all on function public.purge_due_account_deletions() from public, anon, authenticated;

-- The old immediate delete is replaced by the window above.
drop function if exists public.delete_my_account();

-- Runs every night at 02:30 UTC (05:30 Nairobi).
select cron.schedule(
  'orbit-purge-account-deletions',
  '30 2 * * *',
  $$select public.purge_due_account_deletions()$$
);
