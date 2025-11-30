import { buildClaimOptions } from './claimOptions';

/**
 * Thin wrappers so each mode feeds consistent data into `buildClaimOptions`.
 * Keeping these helpers in one place makes it trivial to unit test the inputs.
 */
export const getQuickPlayClaimOptions = (
  lastClaim: number | null,
  lastPlayerRoll: number | null
) => buildClaimOptions(lastClaim, lastPlayerRoll);

export const getSurvivalClaimOptions = (
  lastClaim: number | null,
  lastPlayerRoll: number | null
) => buildClaimOptions(lastClaim, lastPlayerRoll);

export const getOnlineClaimOptions = (
  baselineClaim: number | null,
  myRoll: number | null
) => buildClaimOptions(baselineClaim ?? null, myRoll);
