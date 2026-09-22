import { LearningAIDiceOpponent } from './LearningAIOpponent';
import {
  categorizeClaim,
  claimMatchesRoll,
  compareClaims,
  isLegalRaise,
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

  test('loading a corrupt persisted state is ignored and the AI still acts legally', () => {
    const ai = createAi();
    const pristine = ai.banditSnapshot();

    const corrupt = {
      bandit: {
        A: [[1, Number.NaN], [Number.POSITIVE_INFINITY]], // wrong shape and non-finite
        b: 'not-an-array',
      },
      profiles: {
        player: {
          bluffRate: {
            mexican: [Number.NaN, 2],
            double: [1],
            normal: ['a', 'b'],
            special: [0, 0], // zero counts would make the tracker mean NaN
            bogus: [1, 1], // unknown category must not be added
          },
          callRate: [Number.NEGATIVE_INFINITY, 1],
          smallRaisePref: null,
        },
        junk: 'nope',
      },
    };

    expect(() => ai.loadState(corrupt)).not.toThrow();
    expect(() => ai.loadState(null)).not.toThrow();
    expect(() => ai.loadState('garbage')).not.toThrow();

    // Bandit weights are untouched by the malformed snapshot.
    expect(ai.banditSnapshot()).toEqual(pristine);

    // Every learned rate is a finite probability.
    const snapshot = ai.profileSnapshot('player');
    Object.values(snapshot.bluffRate).forEach((rate) => {
      expect(Number.isFinite(rate)).toBe(true);
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    });
    expect(Number.isFinite(snapshot.callRate)).toBe(true);
    expect(Number.isFinite(snapshot.smallRaisePref)).toBe(true);
    expect(Object.keys(snapshot.bluffRate).sort()).toEqual(['double', 'mexican', 'normal', 'special']);

    // Decisions across a spread of situations stay legal.
    const scenarios: { claim: number | null; roll: [number, number] }[] = [
      { claim: null, roll: [4, 3] },
      { claim: 52, roll: [4, 3] },
      { claim: 65, roll: [6, 3] },
      { claim: 33, roll: [5, 1] },
      { claim: 66, roll: [2, 2] },
      { claim: 21, roll: [6, 5] },
    ];
    for (let i = 0; i < 10; i += 1) {
      scenarios.forEach(({ claim, roll }) => {
        const action = ai.decideAction('player', claim, roll, i);
        if (action.type === 'raise') {
          expect(Number.isFinite(action.claim)).toBe(true);
          expect(isLegalRaise(claim, action.claim)).toBe(true);
          expect(action.claim).not.toBe(41);
        } else {
          expect(action.type).toBe('call_bluff');
        }
      });
    }
  });

  test('treats doubles and Mexican as high claims when weighing a reverse bluff', () => {
    const ai = createAi();
    // Force the "consider a reverse bluff" branch and make the random draws land on it.
    const randomSpy = jest.spyOn(Math, 'random').mockImplementation(() => 0.0);
    // A 32 in hand cannot beat 44 or 21, so the AI must either call or bluff.
    const vsDouble = ai.decideAction('player', 44, [3, 2], 0);
    const vsMexican = ai.decideAction('player', 21, [3, 2], 0);
    randomSpy.mockRestore();

    [vsDouble, vsMexican].forEach((action) => {
      if (action.type === 'raise') {
        expect([31, 21]).toContain(action.claim);
      } else {
        expect(action.type).toBe('call_bluff');
      }
    });
  });
});
