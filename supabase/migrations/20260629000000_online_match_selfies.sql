alter table public.games_v2
  add column if not exists selfie_summary_seen_by_host boolean not null default false,
  add column if not exists selfie_summary_seen_by_guest boolean not null default false;

create table if not exists public.online_match_selfies (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games_v2(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('host', 'guest')),
  claim integer not null,
  image_data text not null check (
    image_data like 'data:image/jpeg;base64,%'
    and length(image_data) <= 200000
  ),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists online_match_selfies_game_id_idx
  on public.online_match_selfies (game_id, created_at);

create index if not exists online_match_selfies_expires_at_idx
  on public.online_match_selfies (expires_at);

alter table public.online_match_selfies enable row level security;

create or replace function public.can_send_online_match_selfie(
  p_game_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) < 3
  from public.online_match_selfies
  where game_id = p_game_id
    and sender_id = auth.uid();
$$;

revoke all on function public.can_send_online_match_selfie(uuid) from public;
grant execute on function public.can_send_online_match_selfie(uuid) to authenticated;

drop policy if exists "online_match_selfies_select_participants" on public.online_match_selfies;
create policy "online_match_selfies_select_participants"
on public.online_match_selfies
for select
to authenticated
using (
  exists (
    select 1
    from public.games_v2 game
    where game.id = online_match_selfies.game_id
      and (game.host_id = auth.uid() or game.guest_id = auth.uid())
      and coalesce(game.matchmaking_type, 'friend') <> 'random'
      and (
        online_match_selfies.expires_at is null
        or online_match_selfies.expires_at > now()
      )
  )
);

drop policy if exists "online_match_selfies_insert_sender" on public.online_match_selfies;
create policy "online_match_selfies_insert_sender"
on public.online_match_selfies
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.can_send_online_match_selfie(game_id)
  and exists (
    select 1
    from public.games_v2 game
    where game.id = online_match_selfies.game_id
      and coalesce(game.matchmaking_type, 'friend') <> 'random'
      and (
        (online_match_selfies.sender_role = 'host' and game.host_id = auth.uid())
        or
        (online_match_selfies.sender_role = 'guest' and game.guest_id = auth.uid())
      )
  )
);

drop policy if exists "online_match_selfies_delete_participants" on public.online_match_selfies;
create policy "online_match_selfies_delete_participants"
on public.online_match_selfies
for delete
to authenticated
using (
  exists (
    select 1
    from public.games_v2 game
    where game.id = online_match_selfies.game_id
      and (game.host_id = auth.uid() or game.guest_id = auth.uid())
  )
);

grant select, insert, delete on public.online_match_selfies to authenticated;

create or replace function public.expire_finished_online_match_selfies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'finished' and old.status is distinct from 'finished' then
    update public.online_match_selfies
    set expires_at = now() + interval '24 hours'
    where game_id = new.id
      and expires_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists expire_finished_online_match_selfies_trigger on public.games_v2;
create trigger expire_finished_online_match_selfies_trigger
after update of status on public.games_v2
for each row
execute function public.expire_finished_online_match_selfies();
