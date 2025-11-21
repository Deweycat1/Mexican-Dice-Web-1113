/**
 * Secure Hidden Dice Rolls
 * 
 * Phase 3: Database-level dice hiding
 * 
 * SECURITY MODEL:
 * - Actual dice rolls stored in game_rolls_hidden table with strict RLS
 * - Only the roller can see their own roll (via RLS policy)
 * - Opponents cannot query or see rolls in database
 * - Bluff resolution uses server-side RPC to verify rolls securely
 * 
 * DATA FLOW:
 * 1. Player rolls → write to game_rolls_hidden with roller_id
 * 2. Player claims → write claim to public.games (visible to both)
 * 3. Opponent calls bluff → server RPC reads hidden roll and resolves
 * 4. After resolution → actual roll revealed in public.games.current_roll
 */

import { supabase } from './supabase';

/**
 * Type for hidden roll records
 */
export type HiddenRoll = {
  id: string;
  game_id: string;
  roller_id: string;
  roll_value: string;
  created_at: string;
};

/**
 * Save a dice roll to the secure hidden rolls table
 * Only the roller (authenticated user) can insert their own roll
 * 
 * @param gameId - The game this roll belongs to
 * @param rollValue - The actual dice roll (e.g., "64" or "21")
 * @returns The created roll record
 */
export async function saveHiddenRoll(
  gameId: string,
  rollValue: number
): Promise<HiddenRoll> {
  try {
    // Get current user (must be authenticated)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Must be authenticated to save roll');
    }

    // Insert into hidden rolls table
    // RLS policy ensures roller_id matches auth.uid()
    const { data, error } = await supabase
      .from('game_rolls_hidden')
      .insert({
        game_id: gameId,
        roller_id: user.id,
        roll_value: String(rollValue),
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving hidden roll:', error);
      throw new Error(`Failed to save roll: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from roll insert');
    }

    console.log('✅ Hidden roll saved:', data.id);
    return data as HiddenRoll;
  } catch (err) {
    console.error('Failed to save hidden roll:', err);
    throw err;
  }
}

/**
 * Clear all hidden rolls for a game (called after claim or bluff resolution)
 * This prevents old rolls from being reloaded on subsequent turns
 * 
 * @param gameId - The game to clear rolls for
 */
export async function clearHiddenRolls(gameId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return;
    }

    // Delete all hidden rolls for this game by this user
    // RLS ensures we can only delete our own rolls
    const { error } = await supabase
      .from('game_rolls_hidden')
      .delete()
      .eq('game_id', gameId)
      .eq('roller_id', user.id);

    if (error) {
      console.error('Error clearing hidden rolls:', error);
    } else {
      console.log('✅ Hidden rolls cleared for game:', gameId);
    }
  } catch (err) {
    console.error('Error in clearHiddenRolls:', err);
  }
}

/**
 * Get the current user's most recent roll for a game
 * Used to display the player's own dice on their screen
 * 
 * RLS ensures only the roller can see their own roll
 * 
 * @param gameId - The game to get roll for
 * @returns The roll value, or null if no roll found
 */
export async function getMyCurrentRoll(gameId: string): Promise<number | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }

    // Query most recent roll by this user for this game
    // RLS automatically filters to only this user's rolls
    const { data, error } = await supabase
      .from('game_rolls_hidden')
      .select('roll_value')
      .eq('game_id', gameId)
      .eq('roller_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // PGRST116 = no rows found (not an error - just no roll yet)
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching current roll:', error);
      return null;
    }

    return data ? parseInt(data.roll_value, 10) : null;
  } catch (err) {
    console.error('Error in getMyCurrentRoll:', err);
    return null;
  }
}

/**
 * Call the server-side RPC to resolve a bluff securely
 * 
 * This prevents client-side tampering with roll values.
 * The server:
 * 1. Looks up the actual roll from game_rolls_hidden
 * 2. Compares it to the claim
 * 3. Updates scores atomically
 * 4. Reveals the roll in public.games.current_roll
 * 
 * @param gameId - The game where bluff is being called
 * @param claim - The claim value being challenged
 * @returns Result of bluff resolution
 */
export async function resolveBluffSecure(
  gameId: string,
  claim: number
): Promise<{
  outcome: number;  // +1 if defender lied, -1 if defender told truth
  penalty: number;  // 1 or 2 points lost
  actual_roll: string;
  new_player1_score: number;
  new_player2_score: number;
  winner: 'player1' | 'player2' | null;
}> {
  try {
    // Call the secure server-side function
    const { data, error } = await supabase.rpc('resolve_bluff', {
      p_game_id: gameId,
      p_claim: claim,
    });

    if (error) {
      console.error('Error resolving bluff:', error);
      throw new Error(`Bluff resolution failed: ${error.message}`);
    }

    console.log('✅ Bluff resolved:', data);
    return data;
  } catch (err) {
    console.error('Failed to resolve bluff:', err);
    throw err;
  }
}

/**
 * Check if enough time has passed since last action (rate limiting)
 * 
 * @param gameId - The game to check
 * @param minIntervalMs - Minimum milliseconds between actions (default 500)
 * @returns true if action is allowed, false if too soon (spam)
 */
export async function checkRateLimit(
  gameId: string,
  minIntervalMs: number = 500
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_game_id: gameId,
      p_min_interval_ms: minIntervalMs,
    });

    if (error) {
      console.error('Error checking rate limit:', error);
      // Fail open (allow action) if check fails
      return true;
    }

    return data === true;
  } catch (err) {
    console.error('Rate limit check failed:', err);
    // Fail open
    return true;
  }
}

/**
 * Clear old rolls for a game (cleanup)
 * Optional: Can be called after bluff resolution or game end
 * 
 * @param gameId - The game to clean up rolls for
 */
export async function clearGameRolls(gameId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('game_rolls_hidden')
      .delete()
      .eq('game_id', gameId);

    if (error) {
      console.error('Error clearing game rolls:', error);
    } else {
      console.log('✅ Game rolls cleared for:', gameId);
    }
  } catch (err) {
    console.error('Failed to clear rolls:', err);
  }
}
