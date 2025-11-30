import {
  compareClaims,
  enumerateClaims,
  isAlwaysClaimable,
  isMexican,
  meetsOrBeats,
} from '../engine/mexican';

/**
 * Returns the list of legal next claims for the bluff picker. A value is legal when it
 * either:
 *   • Meets or beats the previous claim using standard Mexican Dice ranking, or
 *   • Is one of the “always claimable” specials (21/31/41). We still hide 41 in the picker
 *     because it is “show only”, but it is treated as legal for lockdown checks.
 *
 * When the previous claim was Mexican (21) we enter lockdown mode where only 21/31 are allowed.
 */
export function buildClaimOptions(previousClaim: number | null, _playerRoll?: number | null): number[] {
  // Get all claims, but exclude 41 (Social) - it must be shown, never claimed
  const all = enumerateClaims().filter((v) => v !== 41);

  const isValidNextClaim = (candidate: number) => {
    if (previousClaim == null) {
      return true;
    }
    if (isMexican(previousClaim)) {
      return isAlwaysClaimable(candidate);
    }
    if (isAlwaysClaimable(candidate)) {
      return true;
    }
    return meetsOrBeats(candidate, previousClaim);
  };

  return all.filter(isValidNextClaim).sort((a, b) => compareClaims(a, b));
}
