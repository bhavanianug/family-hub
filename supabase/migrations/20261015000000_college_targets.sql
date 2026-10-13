-- College interest list with admissions band
create type public.college_band as enum (
  'safety',
  'target',
  'reach',
  'far_reach'
);

create table public.college_targets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  band public.college_band not null default 'target',
  source_url text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index college_targets_group_name_idx
  on public.college_targets (group_id, name);

alter table public.college_targets enable row level security;

create policy "Members can view group college targets"
  on public.college_targets for select
  using (public.is_group_member(group_id));

create policy "Members can insert group college targets"
  on public.college_targets for insert
  with check (public.is_group_member(group_id));

create policy "Members can update group college targets"
  on public.college_targets for update
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "Members can delete group college targets"
  on public.college_targets for delete
  using (public.is_group_member(group_id));
