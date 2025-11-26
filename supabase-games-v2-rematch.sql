-- Adds rematch metadata to games_v2
ALTER TABLE public.games_v2
  ADD COLUMN IF NOT EXISTS rematch_requested_by_host boolean NOT NULL DEFAULT false;

ALTER TABLE public.games_v2
  ADD COLUMN IF NOT EXISTS rematch_requested_by_guest boolean NOT NULL DEFAULT false;

ALTER TABLE public.games_v2
  ADD COLUMN IF NOT EXISTS rematch_game_id uuid;

ALTER TABLE public.games_v2
  ADD COLUMN IF NOT EXISTS parent_game_id uuid;

-- Optional: index to speed up lookups by rematch_game_id
CREATE INDEX IF NOT EXISTS games_v2_rematch_game_id_idx ON public.games_v2 (rematch_game_id);
