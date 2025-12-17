-- Edge-triggered push notification for new game requests

-- Ensure pg_net extension is available for outbound HTTP
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_challenge_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  edge_base_url text;
  edge_url text;
  turn_secret text;
begin
  -- Only fire for inserts with pending status and a linked game
  if (tg_op <> 'INSERT') then
    return new;
  end if;

  if new.status is distinct from 'pending' then
    return new;
  end if;

  if new.game_id is null then
    return new;
  end if;

  -- Base URL for Edge Functions, e.g. https://<project>.functions.supabase.co
  edge_base_url := current_setting('app.edge_functions_base_url', true);

  if edge_base_url is null or edge_base_url = '' then
    raise warning '[notify_challenge_request] app.edge_functions_base_url is not set';
    return new;
  end if;

  edge_url := rtrim(edge_base_url, '/') || '/push-game-request';

  turn_secret := current_setting('app.turn_secret', true);

  perform
    net.http_post(
      url := edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Turn-Secret', turn_secret
      ),
      body := jsonb_build_object(
        'targetUserId', new.recipient_id,
        'gameId', new.game_id,
        'senderUserId', new.challenger_id
      )
    );

  return new;
end;
$$;

drop trigger if exists notify_challenge_request_trigger on public.challenges;

create trigger notify_challenge_request_trigger
after insert on public.challenges
for each row
execute function public.notify_challenge_request();

