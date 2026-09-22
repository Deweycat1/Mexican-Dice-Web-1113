-- ============================================================================
-- SECURITY HARDENING
-- Inferno / Mexican Dice
-- ============================================================================
-- Every statement in this migration is idempotent (CREATE OR REPLACE,
-- DROP ... IF EXISTS, guarded DO blocks), so it is safe to re-run.
--
-- Sections:
--   1a. challenges      - INSERT policy must use WITH CHECK (FOR INSERT USING is
--                         rejected by Postgres); re-declare UPDATE/DELETE.
--   1b. city_visits     - enable RLS (no client reads this table; only the
--                         service role may touch it).
--   1c. resolve_bluff   - legacy RPC rewritten: ignores p_claim, uses
--                         games.current_claim, checks participant / turn /
--                         status, locks the row, advances current_player.
--   1d. games           - legacy UPDATE policy tightened + trigger so
--                         player1_id / player2_id cannot be reassigned.
--   1e. games_v2        - stopgap BEFORE UPDATE trigger (see header there).
--   1f. selfies         - DELETE restricted to the selfie's sender.
--   1g. search_path     - pin search_path on every SECURITY DEFINER function
--                         in public that lacks it.
-- ============================================================================


-- ============================================================================
-- 1a. challenges: fix INSERT policy, re-declare UPDATE / DELETE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  game_id uuid,
  status text NOT NULL DEFAULT 'pending', -- pending, accepted, declined
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_recipient_id ON public.challenges (recipient_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenger_id ON public.challenges (challenger_id);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS challenges_select_self ON public.challenges;
CREATE POLICY challenges_select_self ON public.challenges
  FOR SELECT
  TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = recipient_id);

-- INSERT policies only take WITH CHECK; `FOR INSERT USING (...)` is a syntax error.
DROP POLICY IF EXISTS challenges_insert_challenger ON public.challenges;
CREATE POLICY challenges_insert_challenger ON public.challenges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = challenger_id
    AND challenger_id <> recipient_id
    AND status = 'pending'
  );

-- Only the recipient may update, and only to accept/decline (ids stay fixed).
DROP POLICY IF EXISTS challenges_update_recipient ON public.challenges;
CREATE POLICY challenges_update_recipient ON public.challenges
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (
    auth.uid() = recipient_id
    AND status IN ('pending', 'accepted', 'declined')
  );

DROP POLICY IF EXISTS challenges_delete_self ON public.challenges;
CREATE POLICY challenges_delete_self ON public.challenges
  FOR DELETE
  TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = recipient_id);


-- ============================================================================
-- 1b. city_visits: enable RLS. No client code references this table, so no
--     policies are declared: anon/authenticated get nothing, the service role
--     (which bypasses RLS) can still upsert.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.city_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  region text,
  country text NOT NULL,
  visit_count integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS city_visits_city_country_idx
  ON public.city_visits (city, country);

ALTER TABLE public.city_visits ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 1c. Legacy resolve_bluff RPC (games + game_rolls_hidden)
-- ============================================================================
-- Changes vs. the original (supabase-phase3-security.sql):
--   * p_claim is IGNORED. The claim under dispute is games.current_claim, which
--     the defender wrote through the games UPDATE policy; trusting the caller's
--     p_claim let a caller "resolve" against a claim that was never made.
--   * Requires: caller is a participant, status = 'active', current_claim IS
--     NOT NULL, and current_player is the caller's role (only the player whose
--     turn it is can call the previous claim).
--   * Locks the game row (SELECT ... FOR UPDATE) so two concurrent calls cannot
--     both resolve the same claim.
--   * Sets current_player explicitly: after a bluff is resolved the caller
--     rolls next (matches src/engine/coreGame.ts callBluff -> currentPlayer =
--     caller). The old function left it unchanged via a no-op CASE.
--   * Penalty: 2 points when either the claim or the actual roll is 21
--     (Mexican) or the claim was a reverse against a Mexican; otherwise 1.
--
-- The signature is kept as (UUID, INTEGER) so CREATE OR REPLACE swaps the body
-- in place and existing clients (src/legacy-multiplayer/hiddenRolls.ts) keep
-- working.
CREATE OR REPLACE FUNCTION public.resolve_bluff(
  p_game_id UUID,
  p_claim INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game RECORD;
  v_actual_roll TEXT;
  v_claim INTEGER;
  v_caller_id UUID;
  v_caller_role TEXT;
  v_defender_id UUID;
  v_caller_is_player1 BOOLEAN;
  v_outcome INTEGER;  -- +1 if defender lied, -1 if defender told truth
  v_penalty INTEGER;  -- 1 or 2 points
  v_new_player1_score INTEGER;
  v_new_player2_score INTEGER;
  v_winner TEXT;
BEGIN
  -- p_claim is intentionally unused (kept only for signature compatibility);
  -- games.current_claim is the claim being called.

  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Lock the row for the duration of the transaction.
  SELECT * INTO v_game
  FROM public.games
  WHERE id = p_game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_game.player1_id IS NULL OR v_game.player2_id IS NULL THEN
    RAISE EXCEPTION 'Game has no opponent yet' USING ERRCODE = '22023';
  END IF;

  IF v_caller_id <> v_game.player1_id AND v_caller_id <> v_game.player2_id THEN
    RAISE EXCEPTION 'Not a participant in this game' USING ERRCODE = '42501';
  END IF;

  IF v_game.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Game is not active' USING ERRCODE = '22023';
  END IF;

  v_caller_is_player1 := (v_caller_id = v_game.player1_id);
  v_caller_role := CASE WHEN v_caller_is_player1 THEN 'player1' ELSE 'player2' END;
  v_defender_id := CASE WHEN v_caller_is_player1 THEN v_game.player2_id ELSE v_game.player1_id END;

  IF v_game.current_player IS DISTINCT FROM v_caller_role THEN
    RAISE EXCEPTION 'Not your turn' USING ERRCODE = '42501';
  END IF;

  IF v_game.current_claim IS NULL THEN
    RAISE EXCEPTION 'No claim to call' USING ERRCODE = '22023';
  END IF;

  -- current_claim is stored as text in the legacy table; tolerate integer too.
  BEGIN
    v_claim := (v_game.current_claim)::TEXT::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid current_claim on game' USING ERRCODE = '22023';
  END;

  -- Actual roll: most recent hidden roll by the defender for this game.
  SELECT roll_value INTO v_actual_roll
  FROM public.game_rolls_hidden
  WHERE game_id = p_game_id AND roller_id = v_defender_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_actual_roll IS NULL THEN
    RAISE EXCEPTION 'No roll found to verify' USING ERRCODE = 'P0002';
  END IF;

  IF v_actual_roll::INTEGER = v_claim THEN
    v_outcome := -1;  -- Defender told truth, caller loses
  ELSE
    v_outcome := 1;   -- Defender lied, defender loses
  END IF;

  IF v_claim = 21 OR v_actual_roll = '21' OR v_game.last_action = 'reverseVsMexican' THEN
    v_penalty := 2;
  ELSE
    v_penalty := 1;
  END IF;

  IF v_outcome = 1 THEN
    -- Defender loses points
    IF v_caller_is_player1 THEN
      v_new_player1_score := v_game.player1_score;
      v_new_player2_score := GREATEST(0, v_game.player2_score - v_penalty);
    ELSE
      v_new_player1_score := GREATEST(0, v_game.player1_score - v_penalty);
      v_new_player2_score := v_game.player2_score;
    END IF;
  ELSE
    -- Caller loses points
    IF v_caller_is_player1 THEN
      v_new_player1_score := GREATEST(0, v_game.player1_score - v_penalty);
      v_new_player2_score := v_game.player2_score;
    ELSE
      v_new_player1_score := v_game.player1_score;
      v_new_player2_score := GREATEST(0, v_game.player2_score - v_penalty);
    END IF;
  END IF;

  IF v_new_player1_score = 0 THEN
    v_winner := 'player2';
  ELSIF v_new_player2_score = 0 THEN
    v_winner := 'player1';
  ELSE
    v_winner := NULL;
  END IF;

  UPDATE public.games
  SET
    player1_score = v_new_player1_score,
    player2_score = v_new_player2_score,
    -- The caller rolls next; nobody's turn once the game is over.
    current_player = CASE WHEN v_winner IS NULL THEN v_caller_role ELSE v_game.current_player END,
    current_claim = NULL,
    current_roll = v_actual_roll,  -- Reveal the actual roll after bluff
    baseline_claim = NULL,
    last_action = 'normal',
    status = CASE WHEN v_winner IS NOT NULL THEN 'finished' ELSE v_game.status END,
    winner = v_winner,
    last_action_at = NOW(),
    updated_at = NOW()
  WHERE id = p_game_id;

  RETURN json_build_object(
    'outcome', v_outcome,
    'penalty', v_penalty,
    'claim', v_claim,
    'actual_roll', v_actual_roll,
    'new_player1_score', v_new_player1_score,
    'new_player2_score', v_new_player2_score,
    'next_player', CASE WHEN v_winner IS NULL THEN v_caller_role ELSE NULL END,
    'winner', v_winner
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_bluff(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_bluff(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.resolve_bluff(UUID, INTEGER) IS
  'Resolves the current claim on a legacy game. p_claim is ignored; games.current_claim is authoritative.';

-- check_rate_limit already declares search_path in the repo copy; pin it on the
-- live definition too (ALTER works without the function body).
DO $$
BEGIN
  IF to_regprocedure('public.check_rate_limit(uuid, integer)') IS NOT NULL THEN
    ALTER FUNCTION public.check_rate_limit(uuid, integer) SET search_path = public;
  END IF;
END
$$;


-- ============================================================================
-- 1d. Legacy games: participants cannot be reassigned
-- ============================================================================
-- Trigger: raises if player1_id / player2_id change. The single allowed
-- transition is player2_id NULL -> auth.uid() (a second player joining).
-- Service-role / postgres sessions (auth.uid() IS NULL) are exempt from the
-- "updater must be a participant" rule but still cannot swap ids.
CREATE OR REPLACE FUNCTION public.games_guard_participant_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF NEW.player1_id IS DISTINCT FROM OLD.player1_id THEN
    RAISE EXCEPTION 'player1_id cannot be changed' USING ERRCODE = '42501';
  END IF;

  IF NEW.player2_id IS DISTINCT FROM OLD.player2_id THEN
    IF NOT (OLD.player2_id IS NULL AND v_uid IS NOT NULL AND NEW.player2_id = v_uid) THEN
      RAISE EXCEPTION 'player2_id cannot be changed' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_uid IS NOT NULL
     AND v_uid IS DISTINCT FROM NEW.player1_id
     AND v_uid IS DISTINCT FROM NEW.player2_id THEN
    RAISE EXCEPTION 'Only participants may update a game' USING ERRCODE = '42501';
  END IF;

  IF OLD.status = 'finished' AND NEW.status IS DISTINCT FROM 'finished' THEN
    RAISE EXCEPTION 'A finished game cannot be reopened' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.games') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS games_guard_participant_update ON public.games;
    CREATE TRIGGER games_guard_participant_update
      BEFORE UPDATE ON public.games
      FOR EACH ROW
      EXECUTE FUNCTION public.games_guard_participant_update();

    -- Tighten the UPDATE policy as well: WITH CHECK compares the new ids to the
    -- committed row (the sub-select sees the pre-update snapshot).
    DROP POLICY IF EXISTS "games_update_participants_only" ON public.games;
    CREATE POLICY "games_update_participants_only"
    ON public.games
    FOR UPDATE
    TO authenticated
    USING (
      auth.uid() = player1_id
      OR auth.uid() = player2_id
    )
    WITH CHECK (
      (auth.uid() = player1_id OR auth.uid() = player2_id)
      AND player1_id IS NOT DISTINCT FROM (SELECT g.player1_id FROM public.games g WHERE g.id = games.id)
      AND (
        player2_id IS NOT DISTINCT FROM (SELECT g.player2_id FROM public.games g WHERE g.id = games.id)
        OR (
          (SELECT g.player2_id FROM public.games g WHERE g.id = games.id) IS NULL
          AND player2_id = auth.uid()
        )
      )
    );
  END IF;
END
$$;


-- ============================================================================
-- 1e. games_v2: participant / status guard trigger (STOPGAP)
-- ============================================================================
-- The live games_v2 DDL is not in this repository (only ALTERs in
-- supabase-games-v2-rematch.sql and references from other migrations). The
-- client currently writes game state directly through RLS'd UPDATEs, which
-- means a participant can still write any score / roll / claim they like.
--
-- The proper fix is a set of server-authoritative move RPCs (roll / claim /
-- call-bluff) where dice are generated server-side, the opponent's roll stays
-- hidden until a bluff is resolved, and the client never writes host_score,
-- guest_score, last_roll_*, last_claim or current_player_id directly. Those
-- RPCs still need to be designed against the live schema; this trigger is a
-- stopgap that only blocks the most damaging edits:
--   * host_id / guest_id cannot change (except guest_id NULL -> the joining
--     user for random matchmaking);
--   * the updater must be a participant (service role, auth.uid() NULL, exempt);
--   * a 'finished' game cannot transition back to any other status.
CREATE OR REPLACE FUNCTION public.games_v2_guard_participant_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF NEW.host_id IS DISTINCT FROM OLD.host_id THEN
    RAISE EXCEPTION 'host_id cannot be changed' USING ERRCODE = '42501';
  END IF;

  IF NEW.guest_id IS DISTINCT FROM OLD.guest_id THEN
    IF NOT (OLD.guest_id IS NULL AND v_uid IS NOT NULL AND NEW.guest_id = v_uid) THEN
      RAISE EXCEPTION 'guest_id cannot be changed' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_uid IS NOT NULL
     AND v_uid IS DISTINCT FROM NEW.host_id
     AND v_uid IS DISTINCT FROM NEW.guest_id THEN
    RAISE EXCEPTION 'Only participants may update a game' USING ERRCODE = '42501';
  END IF;

  IF OLD.status = 'finished' AND NEW.status IS DISTINCT FROM 'finished' THEN
    RAISE EXCEPTION 'A finished game cannot be reopened' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.games_v2') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS games_v2_guard_participant_update ON public.games_v2;
    CREATE TRIGGER games_v2_guard_participant_update
      BEFORE UPDATE ON public.games_v2
      FOR EACH ROW
      EXECUTE FUNCTION public.games_v2_guard_participant_update();
  END IF;
END
$$;


-- ============================================================================
-- 1f. online_match_selfies: only the sender may delete their selfie
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.online_match_selfies') IS NOT NULL THEN
    DROP POLICY IF EXISTS "online_match_selfies_delete_participants" ON public.online_match_selfies;
    DROP POLICY IF EXISTS "online_match_selfies_delete_owner" ON public.online_match_selfies;
    CREATE POLICY "online_match_selfies_delete_owner"
    ON public.online_match_selfies
    FOR DELETE
    TO authenticated
    USING (sender_id = auth.uid());
  END IF;
END
$$;


-- ============================================================================
-- 1g. Pin search_path on every SECURITY DEFINER function in public
-- ============================================================================
-- Every SECURITY DEFINER function whose body lives in this repo already sets
-- search_path = public. The live project may hold functions created outside
-- the repo (or older versions), so pin any that are missing it. ALTER FUNCTION
-- does not need the body, and skipping the ones already configured keeps this
-- idempotent.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.signature);
    RAISE NOTICE 'search_path pinned on %', r.signature;
  END LOOP;
END
$$;

-- ============================================================================
-- END
-- ============================================================================
