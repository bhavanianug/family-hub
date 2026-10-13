-- Application deadline fields for college targets
alter table public.college_targets
  add column if not exists deadline_early_action date,
  add column if not exists deadline_early_decision date,
  add column if not exists deadline_regular date,
  add column if not exists application_timing text,
  add column if not exists deadlines_updated_at timestamptz;
