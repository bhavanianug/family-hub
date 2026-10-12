-- When applications open (separate from deadline_at)
alter table public.opportunities
  add column if not exists opens_at timestamptz;

create index if not exists opportunities_group_opens_idx
  on public.opportunities (group_id, opens_at);
