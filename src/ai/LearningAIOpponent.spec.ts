import LearningAIDiceOpponent from './LearningAIOpponent';
import {
  categorizeClaim,
  claimMatchesRoll,
  compareClaims,
  nextHigherClaim,
  normalizeRoll,
} from '../engine/mexican';

describe('LearningAIDiceOpponent', () => {
  const createAi = () => {
    const ai = new LearningAIDiceOpponent('CPU');
    ai.setRules(compareClaims, nextHigherClaim, categorizeClaim, claimMatchesRoll);
    return ai;
  };

  test('updates bluff tracking per category', () => {
    const ai = createAi();
    const bluffClaim = 64;
    const truthfulClaim = 66;
    const bluffRoll = normalizeRoll(3, 2);
    const truthfulRoll = normalizeRoll(6, 6);

    for (let i = 0; i < 50; i += 1) {
      ai.observeShowdown('player', bluffClaim, bluffRoll);
      ai.observeShowdown('player', truthfulClaim, truthfulRoll);
    }

    const snapshot = ai.profileSnapshot('player');
    expect(snapshot.bluffRate.normal).toBeGreaterThan(snapshot.bluffRate.double);
  });

  test('bandit weights update after observing round outcome', () => {
    const ai = createAi();
    const randomSpy = jest.spyOn(Math, 'random').mockImplementation(() => 0.99);

    ai.decideAction('player', 65, [6, 3], 0);
    const before = ai.banditSnapshot().b.slice();

    ai.observeRoundOutcome(true);
    const after = ai.banditSnapshot().b;

    randomSpy.mockRestore();
    expect(after).not.toEqual(before);
  });
});
