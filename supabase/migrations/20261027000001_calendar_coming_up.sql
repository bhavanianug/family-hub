-- Coming up: kind, importance, optional person (null = everyone)
do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'calendar_event_kind'
  ) then
    create type public.calendar_event_kind as enum (
      'test',
      'event',
      'appointment',
      'deadline',
      'other'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'calendar_importance'
  ) then
    create type public.calendar_importance as enum (
      'normal',
      'important'
    );
  end if;
end $$;

alter table public.calendar_events
  add column if not exists kind public.calendar_event_kind not null default 'other',
  add column if not exists importance public.calendar_importance not null default 'normal',
  add column if not exists person_id uuid references public.people (id) on delete set null,
  add column if not exists location text;

create index if not exists calendar_events_group_person_idx
  on public.calendar_events (group_id, person_id);

comment on column public.calendar_events.person_id is
  'Who this is for; null means everyone in the group';
comment on column public.calendar_events.importance is
  'normal or important — important stands out on Coming up';
