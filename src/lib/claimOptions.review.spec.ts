import { compareClaims, meetsOrBeats } from '../engine/mexican';
import { buildClaimOptions } from './claimOptions';

describe('buildClaimOptions - comprehensive review', () => {
  describe('Basic filtering', () => {
    test('with no previous claim, returns all claims except 41', () => {
      const options = buildClaimOptions(null, null);
      expect(options).toContain(21); // Mexican
      expect(options).toContain(31); // Reverse
      expect(options).not.toContain(41); // Social excluded
      expect(options.length).toBeGreaterThan(15);
    });

    test('all options meet or beat previous claim of 53', () => {
      const options = buildClaimOptions(53, null);
      options.forEach((opt) => {
        if (opt !== 21 && opt !== 31) {
          // 21 and 31 are always allowed
          expect(meetsOrBeats(opt, 53)).toBe(true);
        }
      });
    });

    test('all options meet or beat previous claim of 65', () => {
      const options = buildClaimOptions(65, null);
      options.forEach((opt) => {
        if (opt !== 21 && opt !== 31) {
          expect(meetsOrBeats(opt, 65)).toBe(true);
        }
      });
    });

    test('after double 66, only higher doubles, Mexican, and reverses allowed', () => {
      const options = buildClaimOptions(66, null);
      
      // Should include Mexican and reverse
      expect(options).toContain(21);
      expect(options).toContain(31);
      
      // Should not include normal pairs below 66
      expect(options).not.toContain(65);
      expect(options).not.toContain(64);
      expect(options).not.toContain(54);
      
      // Should not include doubles below 66
      expect(options).not.toContain(55);
      expect(options).not.toContain(44);
      
      // Verify all options beat 66 (except specials)
      options.forEach((opt) => {
        if (opt !== 21 && opt !== 31) {
          expect(compareClaims(opt, 66)).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  describe('Mexican lockdown', () => {
    test('after Mexican (21), only 21 and 31 allowed', () => {
      const options = buildClaimOptions(21, null);
      expect(options).toHaveLength(2);
      expect(options).toContain(21);
      expect(options).toContain(31);
    });

    test('no normal claims allowed after Mexican', () => {
      const options = buildClaimOptions(21, null);
      expect(options).not.toContain(65);
      expect(options).not.toContain(66);
      expect(options).not.toContain(54);
    });
  });

  describe('Reverse baseline preservation', () => {
    test('after 31 reverse, should use baseline not the 31', () => {
      // This test simulates: Rival claims 65, Player reverses with 31
      // The baseline should still be 65, not 31
      
      // Correct usage: pass the baseline (65) not the lastClaim (31)
      const correctOptions = buildClaimOptions(65, null);
      
      // Should not include claims below 65 (except specials)
      expect(correctOptions).not.toContain(54);
      expect(correctOptions).not.toContain(53);
      expect(correctOptions).not.toContain(64);
      
      // Should include Mexican and reverse
      expect(correctOptions).toContain(21);
      expect(correctOptions).toContain(31);
    });
  });

  describe('Edge cases', () => {
    test('options after 32', () => {
      const options = buildClaimOptions(32, null);
      
      // 32 is a normal pair, so higher pairs, doubles, Mexican, reverses allowed
      expect(options).toContain(21); // Mexican
      expect(options).toContain(31); // Reverse
      expect(options).toContain(33); // Double 3s
      expect(options).toContain(42); // 42 > 32
      
      // Should not include lower pairs like 21 (which is Mexican anyway)
      expect(options.length).toBeGreaterThan(5);
    });

    test('options are sorted correctly', () => {
      const options = buildClaimOptions(43, null);
      
      for (let i = 0; i < options.length - 1; i += 1) {
        const comparison = compareClaims(options[i], options[i + 1]);
        expect(comparison).toBeLessThanOrEqual(0); // Each should be <= next
      }
    });

    test('no claim can appear in options if it does not beat previous', () => {
      const testClaims = [32, 43, 54, 55, 63, 64, 65, 66];
      
      testClaims.forEach((prevClaim) => {
        const options = buildClaimOptions(prevClaim, null);
        
        options.forEach((opt) => {
          // Skip special claims
          if (opt === 21 || opt === 31) return;
          
          // Every other claim must meet or beat the previous
          const comparison = compareClaims(opt, prevClaim);
          expect(comparison).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });
});
