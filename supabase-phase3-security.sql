-- ============================================================================
-- PHASE 3: SECURITY & DATA INTEGRITY MIGRATION
-- Mexican Dice - Online Multiplayer
-- ============================================================================
-- Run this in Supabase SQL Editor after Phase 1 & 2 migrations

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
CREATE POLICY "games_select_participants_only"
ON public.games
FOR SELECT
USING (
  auth.uid() = player1_id 
  OR auth.uid() = player2_id
);

-- INSERT: Any authenticated user can create a game
CREATE POLICY "games_insert_authenticated"
ON public.games
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = player1_id  -- Creator must be player1
);

-- UPDATE: Only participants can update their game
CREATE POLICY "games_update_participants_only"
ON public.games
FOR UPDATE
USING (
  auth.uid() = player1_id 
  OR auth.uid() = player2_id
)
WITH CHECK (
  auth.uid() = player1_id 
  OR auth.uid() = player2_id
);

-- DELETE: Prevent deletion (optional - can be removed if needed)
CREATE POLICY "games_delete_restrict"
ON public.games
FOR DELETE
USING (false);  -- No one can delete games (maintain history)

-- ============================================================================
-- STEP 7: Create RLS Policies for Hidden Rolls Table
-- ============================================================================

-- SELECT: Only the roller can see their own roll
-- (In future, can add logic to reveal after bluff is called)
CREATE POLICY "hidden_rolls_select_own_only"
ON public.game_rolls_hidden
FOR SELECT
USING (
  auth.uid() = roller_id
);

-- INSERT: Only authenticated users can insert their own rolls
CREATE POLICY "hidden_rolls_insert_own_only"
ON public.game_rolls_hidden
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = roller_id
);

-- UPDATE: Rolls are immutable (no updates allowed)
CREATE POLICY "hidden_rolls_no_updates"
ON public.game_rolls_hidden
FOR UPDATE
USING (false);

-- DELETE: Only the roller can delete their own rolls (optional cleanup)
CREATE POLICY "hidden_rolls_delete_own_only"
ON public.game_rolls_hidden
FOR DELETE
USING (
  auth.uid() = roller_id
);

-- ============================================================================
-- STEP 8: Create RPC Function for Secure Bluff Resolution
-- ============================================================================

-- This function encapsulates bluff resolution logic server-side
-- Prevents client tampering with roll values
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
  v_caller_id UUID;
  v_defender_id UUID;
  v_caller_is_player1 BOOLEAN;
  v_outcome INTEGER;  -- +1 if defender lied, -1 if defender told truth
  v_penalty INTEGER;  -- 1 or 2 points
  v_new_player1_score INTEGER;
  v_new_player2_score INTEGER;
  v_winner TEXT;
  v_result JSON;
BEGIN
  -- Get current user (the caller)
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get game data
  SELECT * INTO v_game FROM public.games WHERE id = p_game_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  -- Verify caller is a participant
  IF v_caller_id != v_game.player1_id AND v_caller_id != v_game.player2_id THEN
    RAISE EXCEPTION 'Not a participant in this game';
  END IF;

  -- Determine who is calling bluff
  v_caller_is_player1 := (v_caller_id = v_game.player1_id);
  v_defender_id := CASE WHEN v_caller_is_player1 THEN v_game.player2_id ELSE v_game.player1_id END;

  -- Get the actual roll from hidden_rolls table (most recent roll by defender)
  SELECT roll_value INTO v_actual_roll
  FROM public.game_rolls_hidden
  WHERE game_id = p_game_id AND roller_id = v_defender_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_actual_roll IS NULL THEN
    RAISE EXCEPTION 'No roll found to verify';
  END IF;

  -- Simple bluff resolution logic (can be enhanced)
  -- Compare claim vs actual roll
  IF v_actual_roll::INTEGER = p_claim THEN
    v_outcome := -1;  -- Defender told truth, caller loses
  ELSE
    v_outcome := 1;   -- Defender lied, defender loses
  END IF;

  -- Determine penalty (2 for Mexican-related, 1 otherwise)
  IF p_claim = 21 OR v_actual_roll = '21' THEN
    v_penalty := 2;
  ELSE
    v_penalty := 1;
  END IF;

  -- Apply score changes
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

  -- Determine winner if someone hit 0
  IF v_new_player1_score = 0 THEN
    v_winner := 'player2';
  ELSIF v_new_player2_score = 0 THEN
    v_winner := 'player1';
  ELSE
    v_winner := NULL;
  END IF;

  -- Update game
  UPDATE public.games
  SET
    player1_score = v_new_player1_score,
    player2_score = v_new_player2_score,
    current_player = CASE WHEN v_winner IS NULL THEN v_game.current_player ELSE v_game.current_player END,
    current_claim = NULL,
    current_roll = v_actual_roll,  -- Reveal the actual roll after bluff
    baseline_claim = NULL,
    last_action = 'normal',
    status = CASE WHEN v_winner IS NOT NULL THEN 'finished' ELSE v_game.status END,
    winner = v_winner,
    last_action_at = NOW(),
    updated_at = NOW()
  WHERE id = p_game_id;

  -- Build result JSON
  v_result := json_build_object(
    'outcome', v_outcome,
    'penalty', v_penalty,
    'actual_roll', v_actual_roll,
    'new_player1_score', v_new_player1_score,
    'new_player2_score', v_new_player2_score,
    'winner', v_winner
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.resolve_bluff(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.resolve_bluff IS 'Securely resolves a bluff call by verifying hidden roll and updating scores';

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
