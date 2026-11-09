-- Journal: entry kind (research or reflection), the research a reflection belongs to, and the editor font.
-- The app reads and writes these columns, and the Reflect rings and awards depend on entry_kind.
-- Idempotent: safe to run more than once, and safe where the columns already exist.

alter table public.journal_entries
  add column if not exists entry_kind text not null default 'research';

alter table public.journal_entries
  drop constraint if exists journal_entries_entry_kind_check;
alter table public.journal_entries
  add constraint journal_entries_entry_kind_check check (entry_kind in ('research', 'reflection'));

alter table public.journal_entries
  add column if not exists research_entry_id uuid references public.journal_entries(id) on delete set null;

alter table public.journal_entries
  add column if not exists editor_font text not null default 'sans';
