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
  v_opponent_id uuid;
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

  v_opponent_id := case
    when v_user_id = v_game.host_id then v_game.guest_id
    else v_game.host_id
  end;

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
  on conflict on constraint online_match_results_pkey do nothing;

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
    and r.opponent_id = v_opponent_id;

  if found then
    return;
  end if;

  return query
  select
    p_game_id,
    v_opponent_id,
    case
      when v_user_id = v_game.host_id then v_guest_username
      else v_host_username
    end,
    count(*)::integer,
    count(*) filter (where m.winner_id = v_user_id)::integer,
    count(*) filter (where m.loser_id = v_user_id)::integer,
    coalesce(sum(case when m.host_id = v_user_id then m.host_score else m.guest_score end), 0)::integer,
    coalesce(sum(case when m.host_id = v_user_id then m.guest_score else m.host_score end), 0)::integer,
    v_inserted
  from public.online_match_results m
  where (
    (m.host_id = v_user_id and m.guest_id = v_opponent_id)
    or (m.guest_id = v_user_id and m.host_id = v_opponent_id)
  );
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

  if found then
    return;
  end if;

  return query
  select
    p_opponent_id,
    coalesce(
      max(case when m.host_id = p_opponent_id then m.host_username else m.guest_username end),
      u.username
    ),
    count(*)::integer,
    count(*) filter (where m.winner_id = v_user_id)::integer,
    count(*) filter (where m.loser_id = v_user_id)::integer,
    coalesce(sum(case when m.host_id = v_user_id then m.host_score else m.guest_score end), 0)::integer,
    coalesce(sum(case when m.host_id = v_user_id then m.guest_score else m.host_score end), 0)::integer,
    (array_agg(m.game_id order by m.created_at desc))[1],
    max(m.created_at)
  from public.online_match_results m
  left join public.users u on u.id = p_opponent_id
  where (
    (m.host_id = v_user_id and m.guest_id = p_opponent_id)
    or (m.guest_id = v_user_id and m.host_id = p_opponent_id)
  )
  group by u.username;
end;
$$;
