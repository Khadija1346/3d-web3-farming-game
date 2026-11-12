-- GARRIVERSE initial PostgreSQL schema for Supabase.
-- Apply through the Supabase SQL Editor. No client-side write policies are granted.
create extension if not exists pgcrypto;

create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Farmer' check (char_length(display_name) between 1 and 32),
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_game_states (
  user_id uuid primary key references public.player_profiles(user_id) on delete cascade,
  schema_version integer not null default 1 check (schema_version >= 1),
  state jsonb not null default '{}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint player_game_states_state_object check (jsonb_typeof(state) = 'object')
);

create table if not exists public.game_action_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  action_type text not null check (char_length(action_type) between 1 and 64),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists player_profiles_leaderboard_idx
  on public.player_profiles (xp desc, level desc, updated_at asc);
create index if not exists game_action_events_user_created_idx
  on public.game_action_events (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists player_profiles_set_updated_at on public.player_profiles;
create trigger player_profiles_set_updated_at
before update on public.player_profiles
for each row execute function public.set_updated_at();

drop trigger if exists player_game_states_set_updated_at on public.player_game_states;
create trigger player_game_states_set_updated_at
before update on public.player_game_states
for each row execute function public.set_updated_at();

create or replace function public.create_garriverse_player()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.player_profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 32), ''),
      'Farmer'
    )
  )
  on conflict (user_id) do nothing;

  insert into public.player_game_states (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_garriverse on auth.users;
create trigger on_auth_user_created_garriverse
after insert on auth.users
for each row execute function public.create_garriverse_player();

alter table public.player_profiles enable row level security;
alter table public.player_game_states enable row level security;
alter table public.game_action_events enable row level security;

-- Profiles can be read for public leaderboard display; only trusted server code writes.
drop policy if exists "Anyone can read leaderboard profiles" on public.player_profiles;
create policy "Anyone can read leaderboard profiles"
on public.player_profiles for select
to anon, authenticated
using (true);

-- No direct client policies for game state or action events.
-- Netlify server functions will use a server-only credential after auth/session verification.
create or replace view public.player_leaderboard
with (security_invoker = true)
as
select
  user_id,
  display_name,
  xp,
  level,
  rank() over (order by xp desc, level desc, updated_at asc) as rank
from public.player_profiles;

grant select on public.player_leaderboard to anon, authenticated;
