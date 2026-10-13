-- Reason for interest on each college target
alter table public.college_targets
  add column if not exists why_this_college text;
