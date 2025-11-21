// Core helpers for Mexican Dice (a.k.a. Mia / Meier)

const REVERSE_SET = new Set([21, 31, 41]);

export type DicePair = [number, number];
export type ClaimCategory = 'mexican' | 'double' | 'special' | 'normal';

export const tens = (n: number) => Math.floor(n / 10);
export const ones = (n: number) => n % 10;
export const isMexican = (n: number | null) => n === 21;
export const isDouble = (n: number | null) =>
  typeof n === 'number' && tens(n) === ones(n) && !isMexican(n);
export const isSocial = (n: number | null) => n === 41; // show-only
export const isReverse = (n: number | null) =>
  typeof n === 'number' && (n === 31 || n === 41);
export const isAlwaysClaimable = (n: number | null) =>
  typeof n === 'number' && REVERSE_SET.has(n);

export const isReverseOf = (prev: number | null, next: number | null) => {
  if (prev == null || next == null) return false;
  if (!isAlwaysClaimable(next)) return false;
  return prev !== next;
};

export function splitClaim(claim: number) {
  return [tens(claim), ones(claim)] as const;
}

export function normalizeRoll(d1: number, d2: number): number {
  const hi = Math.max(d1, d2);
  const lo = Math.min(d1, d2);
  const n = hi * 10 + lo;
  return (n === 21 || (hi === 2 && lo === 1)) ? 21 : n;
}

export function normalizePair(a: number, b: number) {
  return normalizeRoll(a, b);
}

export function rankClaim(n: number): [tier: number, primary: number, secondary: number] {
  if (isMexican(n)) return [3, 0, 0];
  if (isDouble(n)) return [2, tens(n), 0];
  return [1, tens(n), ones(n)];
}

export function rankValue(n: number): number {
  const [tier, primary, secondary] = rankClaim(n);
  return tier * 100 + primary * 10 + secondary;
}

export function compareClaims(a: number, b: number): 1 | 0 | -1 {
  const ra = rankClaim(a);
  const rb = rankClaim(b);
  if (ra[0] !== rb[0]) return ra[0] > rb[0] ? 1 : -1;
  if (ra[1] !== rb[1]) return ra[1] > rb[1] ? 1 : -1;
  if (ra[2] !== rb[2]) return ra[2] > rb[2] ? 1 : -1;
  return 0;
}

export const meetsOrBeats = (a: number, b: number) => compareClaims(a, b) >= 0;

export function isLegalRaise(prev: number | null, next: number) {
  if (prev == null) return true;
  
  // Mexican lockdown rule: once Mexican (21) is claimed, only {21, 31, 41} can be claimed
  // until the bluff is called and points are lost
  if (isMexican(prev)) {
    // After Mexican, only special values {21, 31, 41} are legal
    return isAlwaysClaimable(next);
  }
  
  if (isAlwaysClaimable(next)) return true;
  if (isReverseOf(prev, next)) return true;
  return compareClaims(next, prev) >= 0;
}

export function resolveBluff(
  prevClaim: number,
  prevActual: number,
  prevWasReverseVsMexican: boolean
) {
  const liar = prevClaim !== prevActual;
  const doublePenalty = prevClaim === 21 || prevWasReverseVsMexican;
  const penalty = doublePenalty ? 2 : 1;
  return {
    outcome: liar ? +1 : -1,
    penalty,
  } as const;
}

const ALL_CLAIMS_ASC: number[] = (() => {
  const values = new Set<number>();
  for (let hi = 1; hi <= 6; hi += 1) {
    for (let lo = 1; lo <= 6; lo += 1) {
      values.add(normalizeRoll(hi, lo));
    }
  }
  return Array.from(values).sort((a, b) => compareClaims(a, b));
})();

export const enumerateClaims = () => [...ALL_CLAIMS_ASC];

export const nextHigherClaim = (prev: number): number | null => {
  let candidate: number | null = null;
  for (const claim of ALL_CLAIMS_ASC) {
    if (compareClaims(claim, prev) > 0) {
      if (candidate == null || compareClaims(claim, candidate) < 0) {
        candidate = claim;
      }
    }
  }
  return candidate;
};

export const categorizeClaim = (value: number | null): ClaimCategory => {
  if (value == null) return 'normal';
  if (isMexican(value)) return 'mexican';
  if (isAlwaysClaimable(value) && value !== 21) return 'special';
  if (isDouble(value)) return 'double';
  return 'normal';
};

export const claimMatchesRoll = (
  claim: number | null,
  roll: number | DicePair | null
): boolean => {
  if (claim == null || roll == null) return false;
  const normalized = Array.isArray(roll)
    ? normalizeRoll(roll[0], roll[1])
    : roll;
  return claim === normalized;
};

if (process.env.NODE_ENV !== 'production') {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  };
  assert(compareClaims(21, 66) === 1, '21 must beat 66');
  assert(compareClaims(44, 65) === 1, '44 must beat 65');
  assert(compareClaims(22, 64) === 1, '22 must beat 64');
  assert(compareClaims(66, 55) === 1, '66 must beat 55');
  assert(compareClaims(65, 64) === 1, '65 must beat 64');
  assert(compareClaims(44, 44) === 0, '44 equals 44');
}
