/**
 * Formats the main action used to submit the player's real, normalized roll.
 * Keep this shared so Quick Play, Survival, Online, and tutorials use identical copy.
 */
export function getClaimActionLabel(roll: number | null | undefined): string {
  if (roll === 21) return 'Claim Inferno';
  if (roll === 31) return 'Claim Reverse';
  if (roll === 41) return 'Reveal Social';
  if (typeof roll === 'number' && Number.isFinite(roll)) return `Claim ${roll}`;
  return 'Claim Roll';
}

