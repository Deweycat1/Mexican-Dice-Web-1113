export type RestingCupPhase = 'ready' | 'covered' | 'handed';

type RestingCupState = {
  isPlayerTurn: boolean;
  hasPlayerRoll: boolean;
  hasOpponentClaim: boolean;
};

export function getRestingCupPhase({
  isPlayerTurn,
  hasPlayerRoll,
  hasOpponentClaim,
}: RestingCupState): RestingCupPhase {
  if (hasPlayerRoll) return 'covered';
  if (isPlayerTurn && hasOpponentClaim) return 'handed';
  return 'ready';
}
