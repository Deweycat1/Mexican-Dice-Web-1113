create table if not exists public.online_match_results (
  game_id uuid primary key references public.games_v2(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid not null references auth.users(id) on delete cascade,
  winner_id uuid not null references auth.users(id) on delete cascade,
  loser_id uuid not null references auth.users(id) on delete cascade,
  host_username text,
  guest_username text,
  winner_username text,
  loser_username text,
  host_score integer not null check (host_score >= 0),
  guest_score integer not null check (guest_score >= 0),
  final_blow jsonb,
  created_at timestamptz not null default now(),
  check (host_id <> guest_id),
  check (winner_id <> loser_id)
);

create table if not exists public.online_opponent_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid not null references auth.users(id) on delete cascade,
  opponent_username text,
  games_played integer not null default 0 check (games_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  points_for integer not null default 0 check (points_for >= 0),
  points_against integer not null default 0 check (points_against >= 0),
  last_game_id uuid references public.games_v2(id) on delete set null,
  last_played_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, opponent_id),
  check (user_id <> opponent_id)
);

create index if not exists online_match_results_host_id_idx
  on public.online_match_results (host_id, created_at desc);

create index if not exists online_match_results_guest_id_idx
  on public.online_match_results (guest_id, created_at desc);

create index if not exists online_opponent_records_user_updated_idx
  on public.online_opponent_records (user_id, updated_at desc);

alter table public.online_match_results enable row level security;
alter table public.online_opponent_records enable row level security;

drop policy if exists online_match_results_select_participants on public.online_match_results;
create policy online_match_results_select_participants
  on public.online_match_results
  for select
  to authenticated
  using (auth.uid() = host_id or auth.uid() = guest_id);

drop policy if exists online_opponent_records_select_self on public.online_opponent_records;
create policy online_opponent_records_select_self
  on public.online_opponent_records
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.online_match_results from anon, authenticated;
revoke all on public.online_opponent_records from anon, authenticated;

grant select on public.online_match_results to authenticated;
grant select on public.online_opponent_records to authenticated;

create or replace function public.upsert_online_opponent_record(
  p_user_id uuid,
  p_opponent_id uuid,
  p_opponent_username text,
  p_won boolean,
  p_points_for integer,
  p_points_against integer,
  p_game_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null
    or p_opponent_id is null
    or p_user_id = p_opponent_id
    or p_won is null
    or p_game_id is null then
    raise exception 'Invalid opponent record input';
  end if;

  insert into public.online_opponent_records (
    user_id,
    opponent_id,
    opponent_username,
    games_played,
    wins,
    losses,
    points_for,
    points_against,
    last_game_id,
    last_played_at
  )
  values (
    p_user_id,
    p_opponent_id,
    p_opponent_username,
    1,
    case when p_won then 1 else 0 end,
    case when p_won then 0 else 1 end,
    greatest(coalesce(p_points_for, 0), 0),
    greatest(coalesce(p_points_against, 0), 0),
    p_game_id,
    now()
  )
  on conflict (user_id, opponent_id)
  do update set
    opponent_username = excluded.opponent_username,
    games_played = public.online_opponent_records.games_played + 1,
    wins = public.online_opponent_records.wins + case when p_won then 1 else 0 end,
    losses = public.online_opponent_records.losses + case when p_won then 0 else 1 end,
    points_for = public.online_opponent_records.points_for + greatest(coalesce(p_points_for, 0), 0),
    points_against = public.online_opponent_records.points_against + greatest(coalesce(p_points_against, 0), 0),
    last_game_id = excluded.last_game_id,
    last_played_at = now(),
    updated_at = now();
end;
$$;

create or replace function public.finalize_online_match_result(p_game_id uuid)
returns table (
  game_id uuid,
  opponent_id uuid,
  opponent_username text,
  games_played integer,
  wins integer,
  losses integer,
  points_for integer,
  points_against integer,
  inserted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_game record;
  v_host_username text;
  v_guest_username text;
  v_winner_id uuid;
  v_loser_id uuid;
  v_winner_username text;
  v_loser_username text;
  v_final_blow jsonb;
  v_inserted boolean := false;
  v_inserted_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_game
  from public.games_v2
  where id = p_game_id;

  if not found then
    raise exception 'Game not found';
  end if;

  if v_user_id <> v_game.host_id and v_user_id <> v_game.guest_id then
    raise exception 'Only match participants can finalize this match';
  end if;

  if v_game.status <> 'finished' then
    raise exception 'Game is not finished';
  end if;

  if v_game.host_id is null or v_game.guest_id is null then
    raise exception 'Game must have both players';
  end if;

  if v_game.host_score = v_game.guest_score then
    raise exception 'Cannot finalize a tied online match';
  end if;

  select username
  into v_host_username
  from public.users
  where id = v_game.host_id;

  select username
  into v_guest_username
  from public.users
  where id = v_game.guest_id;

  if v_game.host_score > v_game.guest_score then
    v_winner_id := v_game.host_id;
    v_loser_id := v_game.guest_id;
    v_winner_username := v_host_username;
    v_loser_username := v_guest_username;
  else
    v_winner_id := v_game.guest_id;
    v_loser_id := v_game.host_id;
    v_winner_username := v_guest_username;
    v_loser_username := v_host_username;
  end if;

  v_final_blow := jsonb_build_object(
    'callerRole', v_game.round_state ->> 'lastBluffCaller',
    'defenderToldTruth', v_game.round_state -> 'lastBluffDefenderTruth',
    'claim', v_game.last_claim,
    'hostScore', v_game.host_score,
    'guestScore', v_game.guest_score
  );

  insert into public.online_match_results (
    game_id,
    host_id,
    guest_id,
    winner_id,
    loser_id,
    host_username,
    guest_username,
    winner_username,
    loser_username,
    host_score,
    guest_score,
    final_blow
  )
  values (
    v_game.id,
    v_game.host_id,
    v_game.guest_id,
    v_winner_id,
    v_loser_id,
    v_host_username,
    v_guest_username,
    v_winner_username,
    v_loser_username,
    v_game.host_score,
    v_game.guest_score,
    v_final_blow
  )
  on conflict (game_id) do nothing;

  get diagnostics v_inserted_count = row_count;
  v_inserted := v_inserted_count > 0;

  if v_inserted then
    perform public.upsert_online_opponent_record(
      v_game.host_id,
      v_game.guest_id,
      v_guest_username,
      v_winner_id = v_game.host_id,
      v_game.host_score,
      v_game.guest_score,
      v_game.id
    );

    perform public.upsert_online_opponent_record(
      v_game.guest_id,
      v_game.host_id,
      v_host_username,
      v_winner_id = v_game.guest_id,
      v_game.guest_score,
      v_game.host_score,
      v_game.id
    );
  end if;

  return query
  select
    p_game_id,
    r.opponent_id,
    r.opponent_username,
    r.games_played,
    r.wins,
    r.losses,
    r.points_for,
    r.points_against,
    v_inserted
  from public.online_opponent_records r
  where r.user_id = v_user_id
    and r.opponent_id = case
      when v_user_id = v_game.host_id then v_game.guest_id
      else v_game.host_id
    end;
end;
$$;

create or replace function public.get_my_online_record_vs(p_opponent_id uuid)
returns table (
  opponent_id uuid,
  opponent_username text,
  games_played integer,
  wins integer,
  losses integer,
  points_for integer,
  points_against integer,
  last_game_id uuid,
  last_played_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return;
  end if;

  return query
  select
    r.opponent_id,
    r.opponent_username,
    r.games_played,
    r.wins,
    r.losses,
    r.points_for,
    r.points_against,
    r.last_game_id,
    r.last_played_at
  from public.online_opponent_records r
  where r.user_id = v_user_id
    and r.opponent_id = p_opponent_id;
end;
$$;

revoke all on function public.upsert_online_opponent_record(uuid, uuid, text, boolean, integer, integer, uuid) from public;
revoke all on function public.finalize_online_match_result(uuid) from public;
revoke all on function public.get_my_online_record_vs(uuid) from public;

grant execute on function public.finalize_online_match_result(uuid) to authenticated;
grant execute on function public.get_my_online_record_vs(uuid) to authenticated;
