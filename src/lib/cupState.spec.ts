import { getRestingCupPhase } from './cupState';

describe('getRestingCupPhase', () => {
  it('hands an unresolved opponent claim to the player', () => {
    expect(
      getRestingCupPhase({
        isPlayerTurn: true,
        hasPlayerRoll: false,
        hasOpponentClaim: true,
      })
    ).toBe('handed');
  });

  it('keeps a completed player roll covered until it is revealed', () => {
    expect(
      getRestingCupPhase({
        isPlayerTurn: true,
        hasPlayerRoll: true,
        hasOpponentClaim: true,
      })
    ).toBe('covered');
    expect(
      getRestingCupPhase({
        isPlayerTurn: false,
        hasPlayerRoll: true,
        hasOpponentClaim: false,
      })
    ).toBe('covered');
  });

  it('returns an empty cup to ready', () => {
    expect(
      getRestingCupPhase({
        isPlayerTurn: true,
        hasPlayerRoll: false,
        hasOpponentClaim: false,
      })
    ).toBe('ready');
  });
});
