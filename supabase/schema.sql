create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'room_phase') then
    create type public.room_phase as enum ('lobby', 'focus', 'break', 'ended');
  end if;

  if not exists (select 1 from pg_type where typname = 'participant_status') then
    create type public.participant_status as enum ('focused', 'taking_break', 'needs_reset', 'not_sharing_activity');
  end if;

  if not exists (select 1 from pg_type where typname = 'focus_check_state') then
    create type public.focus_check_state as enum ('clear', 'uncertain', 'needs_reset', 'break', 'skipped');
  end if;
end $$;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null check (room_code ~ '^[A-Z0-9]{6}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text not null default 'Study room' check (char_length(title) between 1 and 80),
  subject text,
  focus_minutes integer not null default 25 check (focus_minutes in (15, 25, 45, 60)),
  break_minutes integer not null default 5 check (break_minutes between 1 and 20),
  phase public.room_phase not null default 'lobby',
  phase_started_at timestamptz,
  phase_ends_at timestamptz,
  cycle_number integer not null default 1 check (cycle_number > 0),
  is_running boolean not null default false
);

create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  goal text check (goal is null or char_length(goal) <= 240),
  status public.participant_status not null default 'not_sharing_activity',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_focus_check_at timestamptz,
  last_focus_check_state public.focus_check_state,
  accountability_pulse_opt_in boolean not null default false,
  unique (room_id, user_id)
);

alter table public.room_members
  add column if not exists accountability_pulse_opt_in boolean not null default false;

create unique index if not exists room_members_room_display_name_unique
  on public.room_members (room_id, lower(display_name));

create table if not exists public.room_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'room_started',
      'focus_started',
      'break_started',
      'break_ended',
      'room_paused',
      'room_ended',
      'shared_reset_started',
      'accountability_pulse_started'
    )
  ),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.room_events drop constraint if exists room_events_event_type_check;
alter table public.room_events add constraint room_events_event_type_check check (
  event_type in (
    'room_started',
    'focus_started',
    'break_started',
    'break_ended',
    'room_paused',
    'room_ended',
    'shared_reset_started',
    'accountability_pulse_started'
  )
);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_members;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_events;
exception when duplicate_object then
  null;
end $$;

create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = target_room_id
      and rm.user_id = auth.uid()
  );
$$;

create or replace function public.is_room_creator(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = target_room_id
      and r.created_by = auth.uid()
  );
$$;

drop policy if exists "members read rooms" on public.rooms;
create policy "members read rooms"
on public.rooms for select to authenticated
using (public.is_room_member(id));

drop policy if exists "creators update rooms" on public.rooms;
create policy "creators update rooms"
on public.rooms for update to authenticated
using (public.is_room_creator(id))
with check (public.is_room_creator(id));

drop policy if exists "members read room members" on public.room_members;
create policy "members read room members"
on public.room_members for select to authenticated
using (public.is_room_member(room_id));

drop policy if exists "users update own room member" on public.room_members;
create policy "users update own room member"
on public.room_members for update to authenticated
using (user_id = auth.uid() and public.is_room_member(room_id))
with check (user_id = auth.uid() and public.is_room_member(room_id));

drop policy if exists "members read room events" on public.room_events;
create policy "members read room events"
on public.room_events for select to authenticated
using (public.is_room_member(room_id));

drop policy if exists "members add allowed room events" on public.room_events;
create policy "members add allowed room events"
on public.room_events for insert to authenticated
with check (
  created_by = auth.uid()
  and public.is_room_member(room_id)
  and event_type in ('shared_reset_started', 'accountability_pulse_started')
);

create or replace function public.generate_room_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  index_value integer;
begin
  for index_value in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  end loop;
  return code;
end;
$$;

create or replace function public.break_minutes_for_focus(focus_input integer)
returns integer
language sql
immutable
as $$
  select case
    when focus_input = 15 then 3
    when focus_input = 25 then 5
    when focus_input in (45, 60) then 10
    else 5
  end;
$$;

create or replace function public.room_payload(target_room_id uuid, target_member_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'room', to_jsonb(r),
    'member', to_jsonb(cm),
    'members', coalesce(
      (
        select jsonb_agg(to_jsonb(rm) order by rm.joined_at)
        from public.room_members rm
        where rm.room_id = target_room_id
      ),
      '[]'::jsonb
    ),
    'events', coalesce(
      (
        select jsonb_agg(to_jsonb(e) order by e.created_at desc)
        from (
          select *
          from public.room_events re
          where re.room_id = target_room_id
          order by re.created_at desc
          limit 20
        ) e
      ),
      '[]'::jsonb
    )
  )
  from public.rooms r
  join public.room_members cm on cm.id = target_member_id
  where r.id = target_room_id;
$$;

create or replace function public.create_live_room(
  display_name_input text,
  goal_input text,
  title_input text default 'Study room',
  subject_input text default null,
  focus_minutes_input integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_room_id uuid;
  new_member_id uuid;
  candidate_code text;
  attempt_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Anonymous sign-in is required.';
  end if;

  if char_length(trim(display_name_input)) = 0 then
    raise exception 'Display name is required.';
  end if;

  if focus_minutes_input not in (15, 25, 45, 60) then
    raise exception 'Focus duration must be 15, 25, 45, or 60 minutes.';
  end if;

  loop
    candidate_code := public.generate_room_code();
    attempt_count := attempt_count + 1;
    begin
      insert into public.rooms (
        room_code,
        created_by,
        title,
        subject,
        focus_minutes,
        break_minutes,
        phase,
        is_running
      )
      values (
        candidate_code,
        auth.uid(),
        left(coalesce(nullif(trim(title_input), ''), 'Study room'), 80),
        nullif(trim(coalesce(subject_input, '')), ''),
        focus_minutes_input,
        public.break_minutes_for_focus(focus_minutes_input),
        'lobby',
        false
      )
      returning id into new_room_id;
      exit;
    exception when unique_violation then
      if attempt_count >= 8 then
        raise exception 'Could not generate a unique room code. Please try again.';
      end if;
    end;
  end loop;

  insert into public.room_members (room_id, user_id, display_name, goal, status)
  values (
    new_room_id,
    auth.uid(),
    left(trim(display_name_input), 40),
    left(coalesce(nullif(trim(goal_input), ''), 'Finish one focused study task'), 240),
    'focused'
  )
  returning id into new_member_id;

  insert into public.room_events (room_id, created_by, event_type)
  values (new_room_id, auth.uid(), 'room_started');

  return public.room_payload(new_room_id, new_member_id);
end;
$$;

create or replace function public.join_live_room(
  room_code_input text,
  display_name_input text,
  goal_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms%rowtype;
  member_id uuid;
  normalized_name text := left(trim(display_name_input), 40);
begin
  if auth.uid() is null then
    raise exception 'Anonymous sign-in is required.';
  end if;

  if char_length(normalized_name) = 0 then
    raise exception 'Display name is required.';
  end if;

  select *
  into target_room
  from public.rooms
  where room_code = upper(trim(room_code_input));

  if target_room.id is null then
    raise exception 'Room code not found.';
  end if;

  select id into member_id
  from public.room_members
  where room_id = target_room.id and user_id = auth.uid();

  if member_id is null and exists (
    select 1 from public.room_members
    where room_id = target_room.id
      and lower(display_name) = lower(normalized_name)
      and user_id <> auth.uid()
  ) then
    raise exception 'That display name is already in this room. Add an initial or nickname.';
  end if;

  if member_id is null then
    insert into public.room_members (room_id, user_id, display_name, goal, status)
    values (
      target_room.id,
      auth.uid(),
      normalized_name,
      left(coalesce(nullif(trim(goal_input), ''), 'Finish one focused study task'), 240),
      'focused'
    )
    returning id into member_id;
  else
    update public.room_members
    set display_name = normalized_name,
        goal = left(coalesce(nullif(trim(goal_input), ''), goal), 240),
        last_seen_at = now()
    where id = member_id;
  end if;

  return public.room_payload(target_room.id, member_id);
end;
$$;

create or replace function public.start_pomodoro(room_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member_id uuid;
begin
  if not public.is_room_creator(room_id_input) then
    raise exception 'Only the room creator can start the timer.';
  end if;

  update public.rooms
  set phase = 'focus',
      phase_started_at = now(),
      phase_ends_at = now() + (focus_minutes || ' minutes')::interval,
      is_running = true
  where id = room_id_input;

  insert into public.room_events (room_id, created_by, event_type)
  values (room_id_input, auth.uid(), 'focus_started');

  select id into member_id from public.room_members where room_id = room_id_input and user_id = auth.uid();
  return public.room_payload(room_id_input, member_id);
end;
$$;

create or replace function public.pause_pomodoro(room_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_creator(room_id_input) then
    raise exception 'Only the room creator can pause the timer.';
  end if;

  update public.rooms set is_running = false where id = room_id_input;
  insert into public.room_events (room_id, created_by, event_type)
  values (room_id_input, auth.uid(), 'room_paused');
end;
$$;

create or replace function public.resume_pomodoro(room_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_room public.rooms%rowtype;
  remaining interval;
begin
  if not public.is_room_creator(room_id_input) then
    raise exception 'Only the room creator can resume the timer.';
  end if;

  select * into current_room from public.rooms where id = room_id_input;
  remaining := greatest(current_room.phase_ends_at - now(), interval '0 seconds');

  update public.rooms
  set is_running = true,
      phase_started_at = now(),
      phase_ends_at = now() + remaining
  where id = room_id_input;
end;
$$;

create or replace function public.start_break(room_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_creator(room_id_input) then
    raise exception 'Only the room creator can start break.';
  end if;

  update public.rooms
  set phase = 'break',
      phase_started_at = now(),
      phase_ends_at = now() + (break_minutes || ' minutes')::interval,
      is_running = true
  where id = room_id_input;

  update public.room_members
  set status = 'taking_break'
  where room_id = room_id_input and status <> 'not_sharing_activity';

  insert into public.room_events (room_id, created_by, event_type)
  values (room_id_input, auth.uid(), 'break_started');
end;
$$;

create or replace function public.end_break(room_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_creator(room_id_input) then
    raise exception 'Only the room creator can end break.';
  end if;

  update public.rooms
  set phase = 'focus',
      phase_started_at = now(),
      phase_ends_at = now() + (focus_minutes || ' minutes')::interval,
      cycle_number = cycle_number + 1,
      is_running = true
  where id = room_id_input;

  update public.room_members
  set status = 'focused'
  where room_id = room_id_input and status <> 'not_sharing_activity';

  insert into public.room_events (room_id, created_by, event_type)
  values (room_id_input, auth.uid(), 'break_ended');
end;
$$;

create or replace function public.end_room(room_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_creator(room_id_input) then
    raise exception 'Only the room creator can end the room.';
  end if;

  update public.rooms
  set phase = 'ended',
      phase_ends_at = now(),
      is_running = false
  where id = room_id_input;

  insert into public.room_events (room_id, created_by, event_type)
  values (room_id_input, auth.uid(), 'room_ended');
end;
$$;

create or replace function public.heartbeat_room_member(room_id_input uuid, status_input public.participant_status default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.room_members
  set last_seen_at = now(),
      status = coalesce(status_input, status)
  where room_id = room_id_input
    and user_id = auth.uid();
end;
$$;

grant execute on function public.create_live_room(text, text, text, text, integer) to authenticated;
grant execute on function public.join_live_room(text, text, text) to authenticated;
grant execute on function public.start_pomodoro(uuid) to authenticated;
grant execute on function public.pause_pomodoro(uuid) to authenticated;
grant execute on function public.resume_pomodoro(uuid) to authenticated;
grant execute on function public.start_break(uuid) to authenticated;
grant execute on function public.end_break(uuid) to authenticated;
grant execute on function public.end_room(uuid) to authenticated;
grant execute on function public.heartbeat_room_member(uuid, public.participant_status) to authenticated;
