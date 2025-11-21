/**
 * Shared logic for rolling dice in online multiplayer games.
 * Reuses the same engine logic as Quick Play but without AI opponent behavior.
 */

import { isAlwaysClaimable, meetsOrBeats, normalizeRoll } from './mexican';

export type RollResult = {
  normalized: number;
  values: [number, number];
};

/**
 * Rolls two dice and returns normalized result.
 * Uses Math.random() - same as Quick Play.
 */
export function rollDice(): RollResult {
  const rollDie = () => Math.floor(Math.random() * 6) + 1;
  const d1 = rollDie();
  const d2 = rollDie();
  return {
    values: [d1, d2],
    normalized: normalizeRoll(d1, d2),
  };
}

/**
 * Computes whether the rolled value can be legally claimed as truth.
 * Returns true if the roll meets or beats the current claim, OR if it's an "always claimable" value (21, 31, 41).
 */
export function computeLegalTruth(currentClaim: number | null, rolledValue: number): boolean {
  if (currentClaim === null) return true; // First roll of the game
  
  return isAlwaysClaimable(rolledValue) || meetsOrBeats(rolledValue, currentClaim);
}
