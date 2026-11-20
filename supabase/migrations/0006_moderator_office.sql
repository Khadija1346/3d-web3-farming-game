-- Moderator Office: all writes go through server functions using the service-role credential.
-- No browser/client policies are granted on these tables.
create table if not exists public.staff_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'moderator', 'support')),
  active boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('abuse', 'cheating', 'impersonation', 'scam', 'other')),
  details text not null check (char_length(details) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_moderation_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  suspended_until timestamptz,
  reason text,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid references auth.users(id) on delete set null,
  report_id uuid references public.moderation_reports(id) on delete set null,
  action text not null check (action in ('report_reviewed', 'report_resolved', 'report_dismissed', 'player_suspended', 'player_unsuspended')),
  reason text not null check (char_length(reason) between 3 and 1000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists moderation_reports_status_created_idx
  on public.moderation_reports (status, created_at desc);
create index if not exists moderation_reports_target_idx
  on public.moderation_reports (target_user_id, created_at desc);
create index if not exists moderation_actions_created_idx
  on public.moderation_actions (created_at desc);
create index if not exists moderation_actions_target_idx
  on public.moderation_actions (target_user_id, created_at desc);

create or replace function public.set_moderation_report_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists moderation_reports_set_updated_at on public.moderation_reports;
create trigger moderation_reports_set_updated_at
before update on public.moderation_reports
for each row execute function public.set_moderation_report_updated_at();

alter table public.staff_roles enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.player_moderation_state enable row level security;
alter table public.moderation_actions enable row level security;

-- Intentionally no anon/authenticated policies: clients cannot grant roles, alter reports,
-- suspend players, or write/delete audit events. Use Netlify server functions only.
