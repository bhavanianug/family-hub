-- Family Hub: auth profiles, groups, and core domain tables with RLS

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.generate_invite_code()
returns text
language sql
volatile
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

-- Shared account container (household / family circle)
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default public.generate_invite_code(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.group_role as enum ('owner', 'parent', 'teen', 'member');

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.group_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (group_id, user_id),
  unique (user_id)
);

create index group_members_user_id_idx on public.group_members (user_id);
create index group_members_group_id_idx on public.group_members (group_id);

-- People in a group (profiles can exist before they have a login)
create table public.people (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  person_type text not null default 'teen'
    check (person_type in ('teen', 'parent', 'other')),
  grade text,
  interests text[] not null default '{}',
  location text default 'Chicago, IL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index people_group_id_idx on public.people (group_id);

-- ---------------------------------------------------------------------------
-- Helpers for RLS
-- ---------------------------------------------------------------------------

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
  );
$$;

create or replace function public.user_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select gm.group_id
  from public.group_members gm
  where gm.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Domain: calendar + opportunities
-- ---------------------------------------------------------------------------

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index calendar_events_group_starts_idx
  on public.calendar_events (group_id, starts_at);

create type public.opportunity_source_type as enum ('manual', 'url', 'scraper');
create type public.opportunity_type as enum (
  'internship',
  'program',
  'volunteer',
  'competition',
  'research',
  'museum',
  'scholarship',
  'other'
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null,
  organization text,
  opportunity_type public.opportunity_type not null default 'other',
  description text,
  location text,
  source_type public.opportunity_source_type not null default 'manual',
  source_url text,
  external_id text,
  deadline_at timestamptz,
  eligibility text,
  last_verified_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index opportunities_group_deadline_idx
  on public.opportunities (group_id, deadline_at);

create type public.tracking_status as enum (
  'saved',
  'in_progress',
  'submitted',
  'accepted',
  'declined',
  'withdrawn'
);

create table public.opportunity_tracking (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  status public.tracking_status not null default 'saved',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, person_id)
);

create index opportunity_tracking_person_idx
  on public.opportunity_tracking (person_id);

create type public.scrape_run_status as enum (
  'success',
  'blocked',
  'changed',
  'empty',
  'error'
);

create table public.scrape_sources (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete cascade,
  name text not null,
  base_url text not null,
  is_active boolean not null default true,
  last_run_status public.scrape_run_status,
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auth signup: create a group OR join via invite_code in user metadata
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group_id uuid;
  display text;
  invite text;
  member_role public.group_role;
  person_kind text;
begin
  display := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1),
    'Member'
  );

  invite := nullif(upper(trim(new.raw_user_meta_data ->> 'invite_code')), '');

  member_role := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'group_role'), '')::public.group_role,
    case when invite is null then 'owner'::public.group_role else 'member'::public.group_role end
  );

  person_kind := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'person_type'), ''),
    case when invite is null then 'teen' else 'parent' end
  );

  if person_kind not in ('teen', 'parent', 'other') then
    person_kind := 'parent';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, display);

  if invite is not null then
    select g.id into new_group_id
    from public.groups g
    where g.invite_code = invite;

    if new_group_id is null then
      raise exception 'Invalid group invite code';
    end if;

    if member_role = 'owner' then
      member_role := 'member';
    end if;
  else
    insert into public.groups (name)
    values (display || '''s Group')
    returning id into new_group_id;
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (new_group_id, new.id, member_role);

  insert into public.people (group_id, user_id, display_name, person_type, location)
  values (new_group_id, new.id, display, person_kind, 'Chicago, IL');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.join_group_with_invite(invite text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
  current_group_id uuid;
  member_count int;
  normalized text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  normalized := nullif(upper(trim(invite)), '');
  if normalized is null then
    raise exception 'Invite code is required';
  end if;

  select g.id into target_group_id
  from public.groups g
  where g.invite_code = normalized;

  if target_group_id is null then
    raise exception 'Invalid group invite code';
  end if;

  if public.is_group_member(target_group_id) then
    return target_group_id;
  end if;

  select gm.group_id into current_group_id
  from public.group_members gm
  where gm.user_id = auth.uid()
  limit 1;

  if current_group_id is not null then
    select count(*) into member_count
    from public.group_members gm
    where gm.group_id = current_group_id;

    if member_count > 1 then
      raise exception 'Leave your current group before joining another';
    end if;

    delete from public.group_members
    where group_id = current_group_id
      and user_id = auth.uid();

    delete from public.groups
    where id = current_group_id;
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target_group_id, auth.uid(), 'member');

  update public.people
  set group_id = target_group_id,
      updated_at = now()
  where user_id = auth.uid();

  if not found then
    insert into public.people (group_id, user_id, display_name, person_type, location)
    select
      target_group_id,
      auth.uid(),
      p.display_name,
      'parent',
      'Chicago, IL'
    from public.profiles p
    where p.id = auth.uid();
  end if;

  return target_group_id;
end;
$$;

create or replace function public.rotate_group_invite_code(target_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if not public.is_group_member(target_group_id) then
    raise exception 'Not a group member';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and gm.role in ('owner', 'parent')
  ) then
    raise exception 'Only owners or parents can rotate the invite code';
  end if;

  new_code := public.generate_invite_code();

  update public.groups
  set invite_code = new_code,
      updated_at = now()
  where id = target_group_id;

  return new_code;
end;
$$;

grant execute on function public.join_group_with_invite(text) to authenticated;
grant execute on function public.rotate_group_invite_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.people enable row level security;
alter table public.calendar_events enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_tracking enable row level security;
alter table public.scrape_sources enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Members can view their groups"
  on public.groups for select
  using (public.is_group_member(id));

create policy "Members can update their groups"
  on public.groups for update
  using (public.is_group_member(id))
  with check (public.is_group_member(id));

create policy "Members can view group membership"
  on public.group_members for select
  using (public.is_group_member(group_id));

create policy "Members can view people in their group"
  on public.people for select
  using (public.is_group_member(group_id));

create policy "Members can insert people in their group"
  on public.people for insert
  with check (public.is_group_member(group_id));

create policy "Members can update people in their group"
  on public.people for update
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "Members can delete people in their group"
  on public.people for delete
  using (public.is_group_member(group_id));

create policy "Members can view group calendar events"
  on public.calendar_events for select
  using (public.is_group_member(group_id));

create policy "Members can insert group calendar events"
  on public.calendar_events for insert
  with check (public.is_group_member(group_id));

create policy "Members can update group calendar events"
  on public.calendar_events for update
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "Members can delete group calendar events"
  on public.calendar_events for delete
  using (public.is_group_member(group_id));

create policy "Members can view group opportunities"
  on public.opportunities for select
  using (public.is_group_member(group_id));

create policy "Members can insert group opportunities"
  on public.opportunities for insert
  with check (public.is_group_member(group_id));

create policy "Members can update group opportunities"
  on public.opportunities for update
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "Members can delete group opportunities"
  on public.opportunities for delete
  using (public.is_group_member(group_id));

create policy "Members can view opportunity tracking"
  on public.opportunity_tracking for select
  using (
    exists (
      select 1
      from public.opportunities o
      where o.id = opportunity_id
        and public.is_group_member(o.group_id)
    )
  );

create policy "Members can insert opportunity tracking"
  on public.opportunity_tracking for insert
  with check (
    exists (
      select 1
      from public.opportunities o
      where o.id = opportunity_id
        and public.is_group_member(o.group_id)
    )
  );

create policy "Members can update opportunity tracking"
  on public.opportunity_tracking for update
  using (
    exists (
      select 1
      from public.opportunities o
      where o.id = opportunity_id
        and public.is_group_member(o.group_id)
    )
  )
  with check (
    exists (
      select 1
      from public.opportunities o
      where o.id = opportunity_id
        and public.is_group_member(o.group_id)
    )
  );

create policy "Members can delete opportunity tracking"
  on public.opportunity_tracking for delete
  using (
    exists (
      select 1
      from public.opportunities o
      where o.id = opportunity_id
        and public.is_group_member(o.group_id)
    )
  );

create policy "Members can view scrape sources"
  on public.scrape_sources for select
  using (
    group_id is null
    or public.is_group_member(group_id)
  );

create policy "Members can manage group scrape sources"
  on public.scrape_sources for all
  using (group_id is not null and public.is_group_member(group_id))
  with check (group_id is not null and public.is_group_member(group_id));
