create extension if not exists pgcrypto;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null,
  session_id uuid not null,
  event_type text not null,
  mode text null,
  match_id uuid null,
  online_game_id text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_event_type_created_at_idx
  on public.analytics_events (event_type, created_at desc);

create index if not exists analytics_events_user_id_created_at_idx
  on public.analytics_events (user_id, created_at desc);

create index if not exists analytics_events_mode_created_at_idx
  on public.analytics_events (mode, created_at desc);

create index if not exists analytics_events_online_game_id_idx
  on public.analytics_events (online_game_id);

alter table public.analytics_events enable row level security;

drop policy if exists analytics_events_insert on public.analytics_events;

create policy analytics_events_insert
  on public.analytics_events
  for insert
  to anon, authenticated
  with check (
    (auth.uid() is not null and (user_id is null or user_id = auth.uid()))
    or
    (auth.uid() is null and user_id is null)
  );

grant insert on public.analytics_events to anon, authenticated;
revoke select on public.analytics_events from anon, authenticated;
