/**
 * Comprehensive test for roll and claim validation
 * Tests what claims are legal after specific rolls in various game states
 */

import { buildClaimOptions } from '../lib/claimOptions';
import {
  compareClaims,
  isAlwaysClaimable,
  isLegalRaise,
  nextHigherClaim,
  normalizeRoll
} from './mexican';

describe('Roll and Claim Validation', () => {
  describe('Basic Roll Normalization', () => {
    test('rolls are normalized high-first', () => {
      expect(normalizeRoll(3, 5)).toBe(53);
      expect(normalizeRoll(5, 3)).toBe(53);
      expect(normalizeRoll(2, 1)).toBe(21); // Mexican
      expect(normalizeRoll(1, 2)).toBe(21);
      expect(normalizeRoll(6, 6)).toBe(66);
    });

    test('all possible rolls normalize correctly', () => {
      const allRolls = [
        21, 31, 41, 42, 43, 51, 52, 53, 54, 61, 62, 63, 64, 65,
        11, 22, 33, 44, 55, 66
      ];
      
      allRolls.forEach(roll => {
        const hi = Math.floor(roll / 10);
        const lo = roll % 10;
        expect(normalizeRoll(hi, lo)).toBe(roll);
        expect(normalizeRoll(lo, hi)).toBe(roll); // Reverse order should normalize to same
      });
    });
  });

  describe('Legal Claims After Rolls (No Previous Claim)', () => {
    test('rolling Mexican (21) - can claim 21, 31, or any value', () => {
      const options = buildClaimOptions(null, 21);
      
      expect(options).toContain(21); // Truth
      expect(options).toContain(31); // Always available
      expect(options).not.toContain(41); // 41 never in UI options (must be shown)
      expect(options).toContain(66); // Can bluff higher
      expect(options.length).toBeGreaterThan(3); // Many options available
    });

    test('rolling weak roll (32) - can claim truth or bluff higher', () => {
      const options = buildClaimOptions(null, 32);
      
      expect(options).toContain(32); // Truth
      expect(options).toContain(21); // Mexican always available
      expect(options).toContain(31); // Reverse always available
      expect(options).toContain(43); // Higher claim
      expect(options).toContain(66); // Much higher claim
    });

    test('rolling double 6s (66) - strongest non-Mexican roll', () => {
      const options = buildClaimOptions(null, 66);
      
      expect(options).toContain(66); // Truth
      expect(options).toContain(21); // Mexican beats 66
      expect(options).toContain(31); // Always available
      expect(options).not.toContain(65); // Can't claim lower (unless bluffing)
    });

    test('rolling any value opens all higher claims', () => {
      const roll = 54;
      const options = buildClaimOptions(null, roll);
      
      // Should include the roll itself and all higher values
      expect(options).toContain(54); // Truth
      expect(options).toContain(61); // Higher
      expect(options).toContain(65); // Higher
      expect(options).toContain(66); // Highest double
      expect(options).toContain(21); // Mexican
    });
  });

  describe('Legal Claims After Rolls (With Previous Claim)', () => {
    test('rolling 65 after previous claim of 54 - can claim truth or higher', () => {
      const options = buildClaimOptions(54, 65);
      
      expect(options).toContain(65); // Truth (beats 54)
      expect(options).toContain(61); // Higher than 54
      expect(options).toContain(66); // Highest double
      expect(options).toContain(21); // Mexican
      expect(options).toContain(31); // Always available
      expect(options).not.toContain(54); // Can't match previous
      expect(options).not.toContain(53); // Lower than previous
    });

    test('rolling 43 after previous claim of 65 - must bluff or use special', () => {
      const options = buildClaimOptions(65, 43);
      
      // Since 43 doesn't beat 65, must claim higher or use specials
      expect(options).toContain(21); // Mexican beats 65
      expect(options).toContain(31); // Reverse always available
      expect(options).toContain(66); // Only double that beats 65
      expect(options).not.toContain(43); // Truth doesn't beat previous
      expect(options).not.toContain(54); // Still below 65
    });

    test('rolling double 66 after previous claim of 66 - can match or use Mexican/reverses', () => {
      const options = buildClaimOptions(66, 66);
      
      expect(options).toContain(66); // Can match
      expect(options).toContain(21); // Mexican beats 66
      expect(options).toContain(31); // Always available
      expect(options.length).toBe(3); // Only these 3 options
    });

    test('rolling Mexican (21) after previous claim of 66 - truth beats it', () => {
      const options = buildClaimOptions(66, 21);
      
      expect(options).toContain(21); // Truth beats everything
      expect(options).toContain(31); // Always available
      expect(options.length).toBeGreaterThanOrEqual(2);
    });

    test('rolling weak 32 after Mexican lockdown (21) - only specials allowed', () => {
      const options = buildClaimOptions(21, 32);
      
      // After Mexican, only 21, 31 are claimable (41 never in UI)
      expect(options).toContain(21); // Mexican
      expect(options).toContain(31); // Reverse
      expect(options).not.toContain(41); // Social not in UI options
      expect(options).not.toContain(66); // Not allowed during Mexican lockdown
      expect(options).not.toContain(65); // Not allowed
      expect(options.length).toBe(2); // Only 21 and 31
    });
  });

  describe('Mexican Lockdown Rules', () => {
    test('after Mexican (21), only 21/31/41 are legal', () => {
      expect(isLegalRaise(21, 21)).toBe(true);
      expect(isLegalRaise(21, 31)).toBe(true);
      expect(isLegalRaise(21, 41)).toBe(true);
      expect(isLegalRaise(21, 66)).toBe(false); // Not allowed!
      expect(isLegalRaise(21, 65)).toBe(false);
      expect(isLegalRaise(21, 44)).toBe(false);
    });

    test('Mexican lockdown persists through reverse (31)', () => {
      // After 21 → 31, next claim must still beat 21 (the baseline)
      expect(isLegalRaise(21, 31)).toBe(true); // Reverse is legal
      // But if someone tried to claim 65 after the reverse, it would fail
      expect(isLegalRaise(21, 65)).toBe(false); // Baseline is still 21
    });

    test('normal claims work when not in Mexican lockdown', () => {
      expect(isLegalRaise(54, 61)).toBe(true);
      expect(isLegalRaise(54, 65)).toBe(true);
      expect(isLegalRaise(54, 66)).toBe(true);
      expect(isLegalRaise(54, 53)).toBe(false); // Too low
    });
  });

  describe('Reverse Mechanics (31/41)', () => {
    test('31 is always legal regardless of roll or previous claim', () => {
      expect(isLegalRaise(null, 31)).toBe(true);
      expect(isLegalRaise(66, 31)).toBe(true);
      expect(isLegalRaise(21, 31)).toBe(true);
      expect(isLegalRaise(32, 31)).toBe(true);
    });

    test('41 (Social) is always legal', () => {
      expect(isLegalRaise(null, 41)).toBe(true);
      expect(isLegalRaise(66, 41)).toBe(true);
      expect(isLegalRaise(21, 41)).toBe(true);
    });

    test('always claimable values', () => {
      expect(isAlwaysClaimable(21)).toBe(true); // Mexican
      expect(isAlwaysClaimable(31)).toBe(true); // Reverse
      expect(isAlwaysClaimable(41)).toBe(true); // Social
      expect(isAlwaysClaimable(66)).toBe(false); // Not always
      expect(isAlwaysClaimable(43)).toBe(false); // Not always
    });
  });

  describe('Claim Comparison and Progression', () => {
    test('Mexican beats everything', () => {
      expect(compareClaims(21, 66)).toBe(1);
      expect(compareClaims(21, 65)).toBe(1);
      expect(compareClaims(21, 44)).toBe(1);
      expect(compareClaims(21, 21)).toBe(0); // Tie
    });

    test('doubles beat normal pairs', () => {
      expect(compareClaims(11, 65)).toBe(1); // Lowest double beats highest normal
      expect(compareClaims(66, 65)).toBe(1);
      expect(compareClaims(44, 62)).toBe(1);
    });

    test('normal pairs compare by value', () => {
      expect(compareClaims(65, 64)).toBe(1);
      expect(compareClaims(65, 54)).toBe(1);
      expect(compareClaims(43, 42)).toBe(1);
      expect(compareClaims(53, 54)).toBe(-1);
    });

    test('nextHigherClaim finds correct progression', () => {
      expect(nextHigherClaim(32)).toBe(42);
      expect(nextHigherClaim(65)).toBe(66);
      expect(nextHigherClaim(66)).toBe(21); // Mexican is highest
      expect(nextHigherClaim(21)).toBeNull(); // Mexican has no higher
    });
  });

  describe('Edge Cases', () => {
    test('rolling 31 with 31 as previous claim - baseline matters', () => {
      // If baseline was 66, rolling 31 doesn't help
      const options = buildClaimOptions(66, 31);
      expect(options).toContain(21); // Mexican
      expect(options).toContain(31); // Reverse again
      expect(options).not.toContain(41); // Social not in UI
      // Can't claim anything below 66 except specials
    });

    test('first claim of game - no restrictions', () => {
      const options = buildClaimOptions(null, 54);
      expect(options.length).toBeGreaterThan(10); // Many options
      expect(options).toContain(54); // Truth
      expect(options).toContain(21); // Mexican
      expect(options).toContain(66); // Bluff high
    });

    test('impossible situation - weak roll after high claim needs bluff or special', () => {
      const roll = 32; // Lowest normal pair
      const prev = 66; // Highest double
      const options = buildClaimOptions(prev, roll);
      
      // Only options are specials (since 32 can't beat 66)
      expect(options).toContain(21); // Mexican
      expect(options).toContain(31); // Reverse
      expect(options).not.toContain(41); // Social not in UI
      expect(options).not.toContain(32); // Truth doesn't work
      expect(options.length).toBe(2); // Only 21 and 31
    });
  });

  describe('Claim Options After Specific Game States', () => {
    test('after rolling and claiming truth, next player must beat it', () => {
      // Player 1 rolls 54, claims 54
      // Player 2 rolls 43, what can they claim?
      const options = buildClaimOptions(54, 43);
      
      expect(options).toContain(21); // Mexican
      expect(options).toContain(31); // Reverse
      expect(options).toContain(61); // Higher normal pair
      expect(options).toContain(66); // Double
      expect(options).not.toContain(43); // Can't claim truth (too low)
      expect(options).not.toContain(54); // Can't match previous
    });

    test('multiple rounds of escalation', () => {
      // Round 1: claim 43
      let options = buildClaimOptions(null, 43);
      expect(options).toContain(43);
      
      // Round 2: after 43, roll 54
      options = buildClaimOptions(43, 54);
      expect(options).toContain(54); // Can claim truth
      expect(options).toContain(61); // Or higher
      
      // Round 3: after 54, roll 32 (weak)
      options = buildClaimOptions(54, 32);
      expect(options).not.toContain(32); // Too low
      expect(options).toContain(21); // Must use Mexican
      expect(options).toContain(31); // Or reverse
      expect(options).toContain(66); // Or bluff high
    });
  });
});
