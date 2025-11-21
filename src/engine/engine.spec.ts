import {
  compareClaims,
  categorizeClaim,
  claimMatchesRoll,
  isAlwaysClaimable,
  isLegalRaise,
  isMexican,
  isReverse,
  isReverseOf,
  nextHigherClaim,
  normalizePair,
  normalizeRoll,
  resolveBluff,
  splitClaim,
} from './mexican';

describe('engine helpers', () => {
  test('normalizePair orders dice high-first and encodes value', () => {
    expect(normalizePair(2, 5)).toBe(52);
    expect(normalizePair(6, 1)).toBe(61);
  });

  test('splitClaim returns hi/lo digits', () => {
    expect(splitClaim(64)).toEqual([6, 4]);
    expect(splitClaim(21)).toEqual([2, 1]);
  });

  test('compareClaims respects Mexican, doubles, mixed, and reverse ordering', () => {
    expect(compareClaims(21, 66)).toBe(1);
    expect(compareClaims(66, 65)).toBe(1);
    expect(compareClaims(33, 32)).toBe(1);
    expect(compareClaims(44, 65)).toBe(1);
    expect(compareClaims(65, 32)).toBe(1);
    expect(compareClaims(32, 31)).toBe(1);
  });

  test('isMexican and isReverse helpers detect specials', () => {
    expect(isMexican(21)).toBe(true);
    expect(isReverse(31)).toBe(true);
    expect(isReverse(41)).toBe(true);
    expect(isMexican(64)).toBe(false);
    expect(isReverse(65)).toBe(false);
  });

  test('isAlwaysClaimable and isReverseOf helpers', () => {
    expect(isMexican(21)).toBe(true);
    expect(isAlwaysClaimable(31)).toBe(true);
    expect(isAlwaysClaimable(41)).toBe(true);
    expect(isAlwaysClaimable(65)).toBe(false);
    expect(isReverseOf(51, 31)).toBe(true);
    expect(isReverseOf(64, 46)).toBe(false);
    expect(isReverseOf(64, 41)).toBe(true);
  });

  test('isLegalRaise respects Mexican responder rule', () => {
    expect(isLegalRaise(64, 65)).toBe(true);
    expect(isLegalRaise(65, 65)).toBe(true);
    expect(isLegalRaise(21, 65)).toBe(false);
    expect(isLegalRaise(21, 21)).toBe(true);
    expect(isLegalRaise(21, 31)).toBe(true);
  });

  test('resolveBluff returns outcome and penalty, with Mexican forcing 2 points', () => {
    expect(resolveBluff(31, 42, true)).toEqual({ outcome: +1, penalty: 2 });
    expect(resolveBluff(64, 64, false)).toEqual({ outcome: -1, penalty: 1 });
    expect(resolveBluff(21, 65, false)).toEqual({ outcome: +1, penalty: 2 });
  });

  test('nextHigherClaim finds the next legal value', () => {
    expect(nextHigherClaim(32)).toBe(41);
    expect(nextHigherClaim(65)).toBe(11);
    expect(nextHigherClaim(66)).toBe(21);
    expect(nextHigherClaim(21)).toBeNull();
  });

  test('categorizeClaim and claimMatchesRoll helpers', () => {
    expect(categorizeClaim(21)).toBe('mexican');
    expect(categorizeClaim(41)).toBe('special');
    expect(categorizeClaim(66)).toBe('double');
    expect(categorizeClaim(64)).toBe('normal');

    const roll = normalizeRoll(4, 4);
    expect(claimMatchesRoll(44, roll)).toBe(true);
    expect(claimMatchesRoll(65, roll)).toBe(false);
    expect(claimMatchesRoll(null, roll)).toBe(false);
  });
});
