-- Advisor fixes (applied to production 7 Nov 2026).
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

drop policy if exists "own rows" on public.assignments;
create policy "own rows" on public.assignments for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own rows" on public.decision_log;
create policy "own rows" on public.decision_log for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own focus sessions" on public.focus_sessions;
create policy "own focus sessions" on public.focus_sessions for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own rows" on public.journal_entries;
create policy "own rows" on public.journal_entries for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own print records" on public.print_records;
create policy "own print records" on public.print_records for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own rows" on public.reviews;
create policy "own rows" on public.reviews for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own freezes" on public.streak_freezes;
create policy "own freezes" on public.streak_freezes for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own rows" on public.topic_controls;
create policy "own rows" on public.topic_controls for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own badges" on public.user_badges;
create policy "own badges" on public.user_badges for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "delete own subfields" on public.subfields;
create policy "delete own subfields" on public.subfields for delete using (user_id = (select auth.uid()));
drop policy if exists "insert own subfields" on public.subfields;
create policy "insert own subfields" on public.subfields for insert with check (user_id = (select auth.uid()));
drop policy if exists "read library and own subfields" on public.subfields;
create policy "read library and own subfields" on public.subfields for select using (user_id is null or user_id = (select auth.uid()));

drop policy if exists "delete own topics" on public.topics;
create policy "delete own topics" on public.topics for delete using (user_id = (select auth.uid()));
drop policy if exists "insert own topics" on public.topics;
create policy "insert own topics" on public.topics for insert with check (user_id = (select auth.uid()));
drop policy if exists "read library and own topics" on public.topics;
create policy "read library and own topics" on public.topics for select using (user_id is null or user_id = (select auth.uid()));
drop policy if exists "update own topics" on public.topics;
create policy "update own topics" on public.topics for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create index if not exists assignments_topic_id_idx on public.assignments (topic_id);
create index if not exists decision_log_topic_id_idx on public.decision_log (topic_id);
create index if not exists field_links_field_b_idx on public.field_links (field_b);
create index if not exists journal_entries_assignment_id_idx on public.journal_entries (assignment_id);
create index if not exists journal_entries_topic_id_idx on public.journal_entries (topic_id);
create index if not exists reviews_topic_id_idx on public.reviews (topic_id);
create index if not exists subfields_user_id_idx on public.subfields (user_id);
create index if not exists topic_controls_topic_id_idx on public.topic_controls (topic_id);
create index if not exists topics_prerequisite_id_idx on public.topics (prerequisite_id);
