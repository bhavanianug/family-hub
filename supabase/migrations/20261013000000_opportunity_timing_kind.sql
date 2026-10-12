-- Summer vs year-round / ongoing programs
create type public.opportunity_timing_kind as enum (
  'summer',
  'ongoing',
  'other'
);

alter table public.opportunities
  add column if not exists timing_kind public.opportunity_timing_kind
  not null default 'other';

create index if not exists opportunities_group_timing_kind_idx
  on public.opportunities (group_id, timing_kind);
