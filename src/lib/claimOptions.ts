import {
    compareClaims,
    enumerateClaims,
    isMexican,
    meetsOrBeats,
} from '../engine/mexican';

export function buildClaimOptions(previousClaim: number | null, playerRoll?: number | null): number[] {
  // Get all claims, but exclude 41 (Social) - it must be shown, never claimed
  const all = enumerateClaims().filter((v) => v !== 41);

  // Ensure special claims (21, 31) are present in results
  const includeSpecial = (list: number[]) => {
    const withSpecial = [...list];
    if (!withSpecial.includes(21)) withSpecial.push(21);
    if (!withSpecial.includes(31)) withSpecial.push(31);
    return withSpecial;
  };

  // If no previous claim, everything (except 41) is available
  if (previousClaim == null) {
    return Array.from(all).sort((a, b) => compareClaims(a, b));
  }

  // If previous was Mexican, lockdown: only 21/31 are claimable (41 excluded from UI)
  if (isMexican(previousClaim)) {
    return includeSpecial([]).sort((a, b) => compareClaims(a, b));
  }

  // Offer any claim that meets or beats the previous (plus always-claimable specials)
  const opts = all.filter((v) => meetsOrBeats(v, previousClaim));
  return includeSpecial(opts).sort((a, b) => compareClaims(a, b));
}
