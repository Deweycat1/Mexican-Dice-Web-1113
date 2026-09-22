-- ============================================================================
-- PHASE 3: SECURITY & DATA INTEGRITY MIGRATION
-- Mexican Dice - Online Multiplayer
-- ============================================================================
-- Run this in Supabase SQL Editor after Phase 1 & 2 migrations
--
-- NOTE: steps 6 (games UPDATE policy), 8 (resolve_bluff) and 10 (participant
-- guard trigger) are superseded by
-- supabase/migrations/20260922000000_security_hardening.sql, which is
-- idempotent and should be applied to the live project. This file is kept in
-- sync with that migration for reference.

-- ============================================================================
-- STEP 1: Add Auth User IDs to Games Table
-- ============================================================================

-- Add player ID columns to link games to authenticated Supabase users
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS player1_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS player2_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for faster lookups by user ID
CREATE INDEX IF NOT EXISTS idx_games_player1_id ON public.games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2_id ON public.games(player2_id);

-- Add comments for documentation
COMMENT ON COLUMN public.games.player1_id IS 'Supabase auth user ID for player 1 (creator)';
COMMENT ON COLUMN public.games.player2_id IS 'Supabase auth user ID for player 2 (joiner)';

-- ============================================================================
-- STEP 2: Create Hidden Dice Rolls Table
-- ============================================================================

-- Separate table for storing actual dice rolls with strict RLS
-- This prevents opponents from seeing rolls in the database
CREATE TABLE IF NOT EXISTS public.game_rolls_hidden (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  roller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roll_value TEXT NOT NULL, -- e.g., "64" for a 6-4 roll
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_rolls_hidden_game_id ON public.game_rolls_hidden(game_id);
CREATE INDEX IF NOT EXISTS idx_game_rolls_hidden_roller_id ON public.game_rolls_hidden(roller_id);
CREATE INDEX IF NOT EXISTS idx_game_rolls_hidden_created_at ON public.game_rolls_hidden(created_at DESC);

-- Comments
COMMENT ON TABLE public.game_rolls_hidden IS 'Stores actual dice rolls with strict RLS - only the roller can see their own roll';
COMMENT ON COLUMN public.game_rolls_hidden.roll_value IS 'Actual dice roll value (e.g., "64" or "21" for Mexican)';

-- ============================================================================
-- STEP 3: Add Rate Limiting Column
-- ============================================================================

ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN public.games.last_action_at IS 'Timestamp of last action - used for rate limiting spam';

-- ============================================================================
-- STEP 4: Enable RLS on Tables
-- ============================================================================

-- Enable RLS (should already be enabled, but ensure it)
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rolls_hidden ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Drop Old Development Policies
-- ============================================================================

-- Drop any existing permissive dev policies
DROP POLICY IF EXISTS "public_games_full_access" ON public.games;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.games;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.games;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.games;

-- ============================================================================
-- STEP 6: Create Secure RLS Policies for Games Table
-- ============================================================================

-- SELECT: Only participants can read their game
DROP POLICY IF EXISTS "games_select_participants_only" ON public.games;
CREATE POLICY "games_select_participants_only"
ON public.games
FOR SELECT
USING (
  auth.uid() = player1_id
  OR auth.uid() = player2_id
);

-- INSERT: Any authenticated user can create a game
DROP POLICY IF EXISTS "games_insert_authenticated" ON public.games;
CREATE POLICY "games_insert_authenticated"
ON public.games
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = player1_id  -- Creator must be player1
);

-- UPDATE: Only participants can update their game, and they cannot reassign
-- player1_id / player2_id. WITH CHECK compares the new ids against the
-- committed row (the sub-select sees the pre-update snapshot). The only
-- permitted change is player2_id NULL -> the joining user.
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

-- DELETE: Prevent deletion (optional - can be removed if needed)
DROP POLICY IF EXISTS "games_delete_restrict" ON public.games;
CREATE POLICY "games_delete_restrict"
ON public.games
FOR DELETE
USING (false);  -- No one can delete games (maintain history)

-- ============================================================================
-- STEP 7: Create RLS Policies for Hidden Rolls Table
-- ============================================================================

-- SELECT: Only the roller can see their own roll
-- (In future, can add logic to reveal after bluff is called)
DROP POLICY IF EXISTS "hidden_rolls_select_own_only" ON public.game_rolls_hidden;
CREATE POLICY "hidden_rolls_select_own_only"
ON public.game_rolls_hidden
FOR SELECT
USING (
  auth.uid() = roller_id
);

-- INSERT: Only authenticated users can insert their own rolls
DROP POLICY IF EXISTS "hidden_rolls_insert_own_only" ON public.game_rolls_hidden;
CREATE POLICY "hidden_rolls_insert_own_only"
ON public.game_rolls_hidden
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = roller_id
);

-- UPDATE: Rolls are immutable (no updates allowed)
DROP POLICY IF EXISTS "hidden_rolls_no_updates" ON public.game_rolls_hidden;
CREATE POLICY "hidden_rolls_no_updates"
ON public.game_rolls_hidden
FOR UPDATE
USING (false);

-- DELETE: Only the roller can delete their own rolls (optional cleanup)
DROP POLICY IF EXISTS "hidden_rolls_delete_own_only" ON public.game_rolls_hidden;
CREATE POLICY "hidden_rolls_delete_own_only"
ON public.game_rolls_hidden
FOR DELETE
USING (
  auth.uid() = roller_id
);

-- ============================================================================
-- STEP 8: Create RPC Function for Secure Bluff Resolution
-- ============================================================================

-- This function encapsulates bluff resolution logic server-side and prevents
-- client tampering with roll values.
--
--   * p_claim is IGNORED. The claim under dispute is games.current_claim.
--   * Requires: caller is a participant, status = 'active', current_claim IS
--     NOT NULL, and current_player is the caller's role.
--   * Locks the game row (SELECT ... FOR UPDATE).
--   * After resolution the caller rolls next (matches src/engine/coreGame.ts).
CREATE OR REPLACE FUNCTION public.resolve_bluff(
  p_game_id UUID,
  p_claim INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with function owner's permissions
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

-- Grant execute permission to authenticated users only
REVOKE ALL ON FUNCTION public.resolve_bluff(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_bluff(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.resolve_bluff(UUID, INTEGER) IS
  'Resolves the current claim on a legacy game. p_claim is ignored; games.current_claim is authoritative.';

-- ============================================================================
-- STEP 9: Create RPC Function for Rate-Limited Actions
-- ============================================================================

-- Helper function to check if action is too soon (spam prevention)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_game_id UUID,
  p_min_interval_ms INTEGER DEFAULT 500
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_action TIMESTAMPTZ;
  v_elapsed_ms INTEGER;
BEGIN
  -- Get last action time
  SELECT last_action_at INTO v_last_action
  FROM public.games
  WHERE id = p_game_id;

  IF v_last_action IS NULL THEN
    RETURN TRUE;  -- No previous action, allow
  END IF;

  -- Calculate elapsed time in milliseconds
  v_elapsed_ms := EXTRACT(EPOCH FROM (NOW() - v_last_action)) * 1000;

  -- Return true if enough time has passed
  RETURN v_elapsed_ms >= p_min_interval_ms;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.check_rate_limit IS 'Check if enough time has passed since last action (spam prevention)';

-- ============================================================================
-- STEP 10: Participant Guard Trigger for games
-- ============================================================================

-- Raises if player1_id / player2_id change (except player2_id NULL -> the
-- joining user), if a signed-in updater is not a participant, or if a
-- finished game is reopened. Service-role sessions (auth.uid() IS NULL) are
-- exempt from the participant rule but still cannot swap ids.
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

DROP TRIGGER IF EXISTS games_guard_participant_update ON public.games;
CREATE TRIGGER games_guard_participant_update
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.games_guard_participant_update();

-- ============================================================================
-- VERIFICATION QUERIES (Run these to test)
-- ============================================================================

-- Check that policies are in place
-- SELECT * FROM pg_policies WHERE tablename IN ('games', 'game_rolls_hidden');

-- Check that RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('games', 'game_rolls_hidden');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Update TypeScript types to include player1_id, player2_id
-- 2. Implement auth flow in the app
-- 3. Update game creation/join to populate player IDs
-- 4. Update roll logic to use game_rolls_hidden table
-- 5. Update bluff resolution to call resolve_bluff RPC
-- ============================================================================
