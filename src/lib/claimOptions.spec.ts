import { compareClaims, enumerateClaims } from '../engine/mexican';
import { buildClaimOptions } from './claimOptions';

describe('buildClaimOptions', () => {
  test('enumerateClaims includes all valid rolls', () => {
    const allClaims = enumerateClaims();
    // Should include all doubles
    expect(allClaims).toContain(11);
    expect(allClaims).toContain(22);
    expect(allClaims).toContain(66);
    // Should include Mexican
    expect(allClaims).toContain(21);
    // May or may not include Social - check the implementation
  });

  test('includes 21 and 31 when there is no previous claim', () => {
    const options = buildClaimOptions(null);
    expect(options).toEqual(expect.arrayContaining([21, 31]));
  });

  test('always includes reversible claims (21/31) even if previous claim outranks them', () => {
    const options = buildClaimOptions(64);
    expect(options).toEqual(expect.arrayContaining([21, 31]));
    expect(options).not.toContain(41);
  });

  test('responding to Mexican keeps 21 and 31 available', () => {
    const options = buildClaimOptions(21);
    expect(options).toEqual(expect.arrayContaining([21, 31]));
    expect(options).not.toContain(41);
  });

  test('options are sorted by rank', () => {
    const options = buildClaimOptions(43);
    const sorted = [...options].sort((a, b) => compareClaims(a, b));
    expect(options).toEqual(sorted);
  });

  describe('claim restrictions based on game state', () => {
    test('without knowing player roll, all values beating previous claim are available', () => {
      const options = buildClaimOptions(52);
      // Should include values that beat 52, plus 21/31
      expect(options).toContain(52);
      expect(options).toContain(53);
      expect(options).toContain(66);
      expect(options).toContain(21);
      expect(options).toContain(31);
    });

  test('when player rolls 43 and previous claim is 43, all legal raises are shown (regardless of actual roll)', () => {
    const options = buildClaimOptions(43, 43);
    // Always include reverses
    expect(options).toEqual(expect.arrayContaining([21, 31]));
    // Can match current claim
    expect(options).toContain(43);
    // Can raise to higher normal claims and doubles
    expect(options).toEqual(expect.arrayContaining([44, 51]));
    // Doubles outrank normals, so low doubles like 11/22/33 are also legal
    expect(options).toEqual(expect.arrayContaining([11, 22, 33]));
  });

  test('when player rolls 43 after previous claim of 52, must meet or beat 52', () => {
      const options = buildClaimOptions(52, 43);
      // 43 is lower than 52, so can't claim it
      expect(options).not.toContain(43);
      // Can claim values that meet or beat 52
      expect(options).toEqual(expect.arrayContaining([52, 53, 61, 66]));
      // Always can claim reverses
      expect(options).toContain(21);
      expect(options).toContain(31);
  // Among numeric values below 52, 44 is a double and outranks 52 so it IS allowed,
  // but 51 is a normal claim below 52 and is not allowed
  expect(options).toContain(44);
  expect(options).not.toContain(51);
    });

    test('when player rolls 65 after previous claim of 65, can match or raise', () => {
      const options = buildClaimOptions(65, 65);
      expect(options).toEqual(expect.arrayContaining([65, 66, 21, 31]));
      expect(options).not.toContain(64);
    });

    test('when player rolls 65 after Mexican (21), can claim 65, or just reverses 21/31', () => {
      const options = buildClaimOptions(21, 65);
      // After Mexican, only 21, 31, 41 are legally claimable
      // Player rolled 65, which doesn't beat 21 in normal claims
      // But 21 and 31 are always available
      expect(options).toContain(21);
      expect(options).toContain(31);
      // 65 doesn't beat 21 normally, so shouldn't be available
      expect(options).not.toContain(65);
      expect(options).not.toContain(66);
    });
  });
});
