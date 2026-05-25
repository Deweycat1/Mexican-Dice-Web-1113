create table if not exists public.player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  games_played integer not null default 0 check (games_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  quick_play_games integer not null default 0 check (quick_play_games >= 0),
  quick_play_wins integer not null default 0 check (quick_play_wins >= 0),
  quick_play_losses integer not null default 0 check (quick_play_losses >= 0),
  online_games integer not null default 0 check (online_games >= 0),
  online_wins integer not null default 0 check (online_wins >= 0),
  online_losses integer not null default 0 check (online_losses >= 0),
  survival_runs integer not null default 0 check (survival_runs >= 0),
  survival_total_streak integer not null default 0 check (survival_total_streak >= 0),
  survival_best integer not null default 0 check (survival_best >= 0),
  current_win_streak integer not null default 0 check (current_win_streak >= 0),
  longest_win_streak integer not null default 0 check (longest_win_streak >= 0),
  current_loss_streak integer not null default 0 check (current_loss_streak >= 0),
  longest_loss_streak integer not null default 0 check (longest_loss_streak >= 0),
  rolls_total integer not null default 0 check (rolls_total >= 0),
  claims_total integer not null default 0 check (claims_total >= 0),
  truthful_claims integer not null default 0 check (truthful_claims >= 0),
  bluff_claims integer not null default 0 check (bluff_claims >= 0),
  bluff_calls_total integer not null default 0 check (bluff_calls_total >= 0),
  bluff_calls_correct integer not null default 0 check (bluff_calls_correct >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_roll_counts (
  user_id uuid not null references auth.users(id) on delete cascade,
  roll text not null,
  total_count integer not null default 0 check (total_count >= 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, roll)
);

create table if not exists public.player_claim_counts (
  user_id uuid not null references auth.users(id) on delete cascade,
  claim text not null,
  total_count integer not null default 0 check (total_count >= 0),
  truthful_count integer not null default 0 check (truthful_count >= 0),
  bluff_count integer not null default 0 check (bluff_count >= 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, claim)
);

create index if not exists player_stats_updated_at_idx
  on public.player_stats (updated_at desc);

create index if not exists player_roll_counts_roll_idx
  on public.player_roll_counts (roll, total_count desc);

create index if not exists player_claim_counts_claim_idx
  on public.player_claim_counts (claim, total_count desc);

alter table public.player_stats enable row level security;
alter table public.player_roll_counts enable row level security;
alter table public.player_claim_counts enable row level security;

drop policy if exists player_stats_select_self on public.player_stats;
create policy player_stats_select_self
  on public.player_stats
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists player_roll_counts_select_self on public.player_roll_counts;
create policy player_roll_counts_select_self
  on public.player_roll_counts
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists player_claim_counts_select_self on public.player_claim_counts;
create policy player_claim_counts_select_self
  on public.player_claim_counts
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on public.player_stats from anon, authenticated;
revoke all on public.player_roll_counts from anon, authenticated;
revoke all on public.player_claim_counts from anon, authenticated;

grant select on public.player_stats to authenticated;
grant select on public.player_roll_counts to authenticated;
grant select on public.player_claim_counts to authenticated;

create or replace function public.ensure_player_stats_row(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.player_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.is_valid_dice_code(p_code text)
returns boolean
language sql
immutable
as $$
  select p_code = any(array[
    '11', '21', '31', '41', '51', '61',
    '22', '32', '42', '52', '62',
    '33', '43', '53', '63',
    '44', '54', '64',
    '55', '65',
    '66'
  ]);
$$;

create or replace function public.record_player_roll(p_roll text)
returns void
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

  if p_roll is null or not coalesce(public.is_valid_dice_code(p_roll), false) then
    raise exception 'Invalid roll code: %', p_roll;
  end if;

  perform public.ensure_player_stats_row(v_user_id);

  insert into public.player_roll_counts (user_id, roll, total_count)
  values (v_user_id, p_roll, 1)
  on conflict (user_id, roll)
  do update set
    total_count = public.player_roll_counts.total_count + 1,
    last_seen_at = now();

  update public.player_stats
  set
    rolls_total = rolls_total + 1,
    updated_at = now()
  where user_id = v_user_id;
end;
$$;

create or replace function public.record_player_claim(
  p_claim text,
  p_truthful boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_truthful_delta integer := case when p_truthful is true then 1 else 0 end;
  v_bluff_delta integer := case when p_truthful is false then 1 else 0 end;
begin
  if v_user_id is null then
    return;
  end if;

  if p_claim is null or not coalesce(public.is_valid_dice_code(p_claim), false) then
    raise exception 'Invalid claim code: %', p_claim;
  end if;

  perform public.ensure_player_stats_row(v_user_id);

  insert into public.player_claim_counts (
    user_id,
    claim,
    total_count,
    truthful_count,
    bluff_count
  )
  values (
    v_user_id,
    p_claim,
    1,
    v_truthful_delta,
    v_bluff_delta
  )
  on conflict (user_id, claim)
  do update set
    total_count = public.player_claim_counts.total_count + 1,
    truthful_count = public.player_claim_counts.truthful_count + v_truthful_delta,
    bluff_count = public.player_claim_counts.bluff_count + v_bluff_delta,
    last_seen_at = now();

  update public.player_stats
  set
    claims_total = claims_total + 1,
    truthful_claims = truthful_claims + v_truthful_delta,
    bluff_claims = bluff_claims + v_bluff_delta,
    updated_at = now()
  where user_id = v_user_id;
end;
$$;

create or replace function public.record_player_bluff_call(p_correct boolean)
returns void
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

  if p_correct is null then
    raise exception 'p_correct is required';
  end if;

  perform public.ensure_player_stats_row(v_user_id);

  update public.player_stats
  set
    bluff_calls_total = bluff_calls_total + 1,
    bluff_calls_correct = bluff_calls_correct + case when p_correct then 1 else 0 end,
    updated_at = now()
  where user_id = v_user_id;
end;
$$;

create or replace function public.record_player_match_result(
  p_mode text,
  p_won boolean
)
returns void
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

  if p_mode is null or p_mode not in ('quick_play', 'online') then
    raise exception 'Invalid match result mode: %', p_mode;
  end if;

  if p_won is null then
    raise exception 'p_won is required';
  end if;

  perform public.ensure_player_stats_row(v_user_id);

  update public.player_stats
  set
    games_played = games_played + 1,
    wins = wins + case when p_won then 1 else 0 end,
    losses = losses + case when p_won then 0 else 1 end,
    quick_play_games = quick_play_games + case when p_mode = 'quick_play' then 1 else 0 end,
    quick_play_wins = quick_play_wins + case when p_mode = 'quick_play' and p_won then 1 else 0 end,
    quick_play_losses = quick_play_losses + case when p_mode = 'quick_play' and not p_won then 1 else 0 end,
    online_games = online_games + case when p_mode = 'online' then 1 else 0 end,
    online_wins = online_wins + case when p_mode = 'online' and p_won then 1 else 0 end,
    online_losses = online_losses + case when p_mode = 'online' and not p_won then 1 else 0 end,
    current_win_streak = case when p_won then current_win_streak + 1 else 0 end,
    longest_win_streak = case
      when p_won then greatest(longest_win_streak, current_win_streak + 1)
      else longest_win_streak
    end,
    current_loss_streak = case when p_won then 0 else current_loss_streak + 1 end,
    longest_loss_streak = case
      when p_won then longest_loss_streak
      else greatest(longest_loss_streak, current_loss_streak + 1)
    end,
    updated_at = now()
  where user_id = v_user_id;
end;
$$;

create or replace function public.record_player_survival_run(p_streak integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_streak integer := greatest(coalesce(p_streak, 0), 0);
begin
  if v_user_id is null then
    return;
  end if;

  perform public.ensure_player_stats_row(v_user_id);

  update public.player_stats
  set
    games_played = games_played + 1,
    survival_runs = survival_runs + 1,
    survival_total_streak = survival_total_streak + v_streak,
    survival_best = greatest(survival_best, v_streak),
    updated_at = now()
  where user_id = v_user_id;
end;
$$;

create or replace function public.get_my_player_stats()
returns table (
  user_id uuid,
  games_played integer,
  wins integer,
  losses integer,
  quick_play_games integer,
  quick_play_wins integer,
  quick_play_losses integer,
  online_games integer,
  online_wins integer,
  online_losses integer,
  survival_runs integer,
  survival_total_streak integer,
  survival_best integer,
  average_survival_streak numeric,
  current_win_streak integer,
  longest_win_streak integer,
  current_loss_streak integer,
  longest_loss_streak integer,
  rolls_total integer,
  claims_total integer,
  truthful_claims integer,
  bluff_claims integer,
  honesty_rate numeric,
  bluff_calls_total integer,
  bluff_calls_correct integer,
  bluff_call_accuracy numeric,
  favorite_roll text,
  favorite_roll_count integer,
  favorite_claim text,
  favorite_claim_count integer,
  rolls_21 integer,
  rolls_31 integer,
  rolls_41 integer,
  claims_21 integer,
  claims_31 integer,
  claims_41 integer
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

  perform public.ensure_player_stats_row(v_user_id);

  return query
  select
    ps.user_id,
    ps.games_played,
    ps.wins,
    ps.losses,
    ps.quick_play_games,
    ps.quick_play_wins,
    ps.quick_play_losses,
    ps.online_games,
    ps.online_wins,
    ps.online_losses,
    ps.survival_runs,
    ps.survival_total_streak,
    ps.survival_best,
    case
      when ps.survival_runs > 0 then ps.survival_total_streak::numeric / ps.survival_runs
      else 0
    end as average_survival_streak,
    ps.current_win_streak,
    ps.longest_win_streak,
    ps.current_loss_streak,
    ps.longest_loss_streak,
    ps.rolls_total,
    ps.claims_total,
    ps.truthful_claims,
    ps.bluff_claims,
    case
      when ps.claims_total > 0 then ps.truthful_claims::numeric / ps.claims_total
      else 0
    end as honesty_rate,
    ps.bluff_calls_total,
    ps.bluff_calls_correct,
    case
      when ps.bluff_calls_total > 0 then ps.bluff_calls_correct::numeric / ps.bluff_calls_total
      else 0
    end as bluff_call_accuracy,
    fav_roll.roll as favorite_roll,
    coalesce(fav_roll.total_count, 0) as favorite_roll_count,
    fav_claim.claim as favorite_claim,
    coalesce(fav_claim.total_count, 0) as favorite_claim_count,
    coalesce(roll_21.total_count, 0) as rolls_21,
    coalesce(roll_31.total_count, 0) as rolls_31,
    coalesce(roll_41.total_count, 0) as rolls_41,
    coalesce(claim_21.total_count, 0) as claims_21,
    coalesce(claim_31.total_count, 0) as claims_31,
    coalesce(claim_41.total_count, 0) as claims_41
  from public.player_stats ps
  left join lateral (
    select prc.roll, prc.total_count
    from public.player_roll_counts prc
    where prc.user_id = ps.user_id
    order by prc.total_count desc, prc.roll asc
    limit 1
  ) fav_roll on true
  left join lateral (
    select pcc.claim, pcc.total_count
    from public.player_claim_counts pcc
    where pcc.user_id = ps.user_id
    order by pcc.total_count desc, pcc.claim asc
    limit 1
  ) fav_claim on true
  left join public.player_roll_counts roll_21
    on roll_21.user_id = ps.user_id and roll_21.roll = '21'
  left join public.player_roll_counts roll_31
    on roll_31.user_id = ps.user_id and roll_31.roll = '31'
  left join public.player_roll_counts roll_41
    on roll_41.user_id = ps.user_id and roll_41.roll = '41'
  left join public.player_claim_counts claim_21
    on claim_21.user_id = ps.user_id and claim_21.claim = '21'
  left join public.player_claim_counts claim_31
    on claim_31.user_id = ps.user_id and claim_31.claim = '31'
  left join public.player_claim_counts claim_41
    on claim_41.user_id = ps.user_id and claim_41.claim = '41'
  where ps.user_id = v_user_id;
end;
$$;

revoke all on function public.ensure_player_stats_row(uuid) from public;
revoke all on function public.is_valid_dice_code(text) from public;
revoke all on function public.record_player_roll(text) from public;
revoke all on function public.record_player_claim(text, boolean) from public;
revoke all on function public.record_player_bluff_call(boolean) from public;
revoke all on function public.record_player_match_result(text, boolean) from public;
revoke all on function public.record_player_survival_run(integer) from public;
revoke all on function public.get_my_player_stats() from public;

grant execute on function public.record_player_roll(text) to authenticated;
grant execute on function public.record_player_claim(text, boolean) to authenticated;
grant execute on function public.record_player_bluff_call(boolean) to authenticated;
grant execute on function public.record_player_match_result(text, boolean) to authenticated;
grant execute on function public.record_player_survival_run(integer) to authenticated;
grant execute on function public.get_my_player_stats() to authenticated;
