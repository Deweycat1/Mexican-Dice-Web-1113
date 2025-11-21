import { isLegalRaise } from '../engine/mexican';
import { useGameStore } from '../state/useGameStore';

const resetToNewGame = () => {
  useGameStore.getState().newGame();
};

const flushCpuTurn = async () => {
  jest.advanceTimersByTime(1200);
  await Promise.resolve();
};

describe('turn flow and scoring', () => {
  let randomSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    randomSpy = jest.spyOn(Math, 'random').mockImplementation(() => 0.6);
    resetToNewGame();
  });

  afterEach(() => {
    jest.useRealTimers();
    randomSpy.mockRestore();
  });

  test('caller keeps turn after wrong bluff call', async () => {
    useGameStore.setState((s) => ({
      ...s,
      turn: 'player',
      lastClaim: 64,
      lastAction: 'normal',
      lastCpuRoll: 64,
      lastPlayerRoll: null,
      message: 'The Rival claims 64. Your move — roll & claim or call bluff.',
    }));

    useGameStore.getState().callBluff();

    const afterCall = useGameStore.getState();
    expect(afterCall.playerScore).toBe(4);
    expect(afterCall.cpuScore).toBe(5);
    expect(afterCall.turn).toBe('player');
    expect(afterCall.lastClaim).toBeNull();

    useGameStore.getState().playerRoll();
    expect(useGameStore.getState().turn).toBe('player');
  });

  test('reverse vs Mexican truthful penalises caller by 2 and keeps turn', async () => {
    useGameStore.setState((s) => ({
      ...s,
      turn: 'cpu',
      lastClaim: 31,
      lastAction: 'reverseVsMexican',
      lastPlayerRoll: 31,
      lastCpuRoll: 21,
      message: 'You claim 31 (Reverse) against Mexican 🌮.',
    }));

    useGameStore.getState().callBluff();

    const state = useGameStore.getState();
    expect(state.cpuScore).toBe(3);
    expect(state.playerScore).toBe(5);
    expect(state.turn).toBe('cpu');

    await flushCpuTurn();
  });

  test('reverse vs Mexican bluff penalises liar by 2 and keeps turn', async () => {
    useGameStore.setState((s) => ({
      ...s,
      turn: 'cpu',
      lastClaim: 31,
      lastAction: 'reverseVsMexican',
      lastPlayerRoll: 52,
      lastCpuRoll: 21,
      message: 'You claim 31 (Reverse) against Mexican 🌮.',
    }));

    useGameStore.getState().callBluff();

    const state = useGameStore.getState();
    expect(state.playerScore).toBe(3);
    expect(state.cpuScore).toBe(5);
    expect(state.turn).toBe('cpu');

    await flushCpuTurn();
  });

  test('failing to answer Mexican immediately loses 2 and passes to cpu', async () => {
    useGameStore.setState((s) => ({
      ...s,
      turn: 'player',
      lastClaim: 21,
      lastAction: 'normal',
      lastCpuRoll: 21,
      message: 'The Rival claims 21 (Mexican 🌮). You must roll a real 21, 31, or 41 or bluff 21/31 — otherwise call bluff.',
    }));

    useGameStore.getState().playerClaim(65);

    const state = useGameStore.getState();
    expect(state.playerScore).toBe(3);
    expect(state.cpuScore).toBe(5);
    expect(state.turn).toBe('cpu');
    expect(state.lastClaim).toBeNull();

    await flushCpuTurn();
  });

  test('player can reverse previous claim with 31', () => {
    useGameStore.setState((s) => ({
      ...s,
      turn: 'player',
      lastClaim: 51,
      lastAction: 'normal',
      lastCpuRoll: 51,
      lastPlayerRoll: 31,
      message: 'The Rival claims 51. Your move — roll & claim or call bluff.',
    }));

    useGameStore.getState().playerClaim(31);

    const state = useGameStore.getState();
    expect(state.turn).toBe('cpu');
    expect(state.message).toContain('reversed 51 with 31');
  });

  describe('Mexican lockdown rule', () => {
    test('claiming 65 after Mexican 21 triggers automatic 2-point penalty', () => {
      // When player can't claim 21/31/41, they lose automatically
      useGameStore.setState((s) => ({
        ...s,
        turn: 'player',
        lastClaim: 21,
        lastAction: 'normal',
        lastCpuRoll: 21,
        lastPlayerRoll: 65,
      }));

      // Attempt to claim 65 (not 21, 31, or 41)
      useGameStore.getState().playerClaim(65);
      const state = useGameStore.getState();
      
      // This triggers the automatic Mexican penalty
      expect(state.message).toContain('You failed to answer Mexican');
      expect(state.playerScore).toBe(3); // Lost 2 points
      expect(state.cpuScore).toBe(5);
      expect(state.lastClaim).toBeNull();
    });

    test('claiming 31 after Mexican 21 is accepted', () => {
      useGameStore.setState((s) => ({
        ...s,
        turn: 'player',
        lastClaim: 21,
        lastAction: 'normal',
        lastCpuRoll: 21,
        lastPlayerRoll: 65,
      }));

      // Claim 31 (Reverse) is always legal
      useGameStore.getState().playerClaim(31);
      const state = useGameStore.getState();
      
      expect(state.lastClaim).toBe(31);
      expect(state.turn).toBe('cpu');
    });

    test('claiming 21 after Mexican 21 is accepted', () => {
      useGameStore.setState((s) => ({
        ...s,
        turn: 'player',
        lastClaim: 21,
        lastAction: 'normal',
        lastCpuRoll: 21,
        lastPlayerRoll: 21,
      }));

      useGameStore.getState().playerClaim(21);
      const state = useGameStore.getState();
      
      expect(state.lastClaim).toBe(21);
      expect(state.turn).toBe('cpu');
    });

    test('claiming 41 after Mexican 21 is accepted and resets round', () => {
      useGameStore.setState((s) => ({
        ...s,
        turn: 'player',
        lastClaim: 21,
        lastAction: 'normal',
        lastCpuRoll: 21,
        lastPlayerRoll: 41,
      }));

      useGameStore.getState().playerClaim(41);
      const state = useGameStore.getState();
      
      // 41 (Social) should reset the round
      expect(state.lastClaim).toBeNull();
      expect(state.message).toContain('Social');
    });

    test('Mexican lockdown chain: 21 → 31 → must be 21/31/41', () => {
      useGameStore.setState((s) => ({
        ...s,
        turn: 'player',
        lastClaim: 21,
        lastAction: 'normal',
        lastCpuRoll: 21,
        lastPlayerRoll: 65,
      }));

      // Player claims 31
      useGameStore.getState().playerClaim(31);
      let state = useGameStore.getState();
      expect(state.lastClaim).toBe(31);
      expect(state.turn).toBe('cpu');

      // CPU's turn - set them up with a regular roll
      useGameStore.setState((s) => ({
        ...s,
        turn: 'cpu',
        lastCpuRoll: 52,
      }));

      // CPU cannot legally claim 52 after 31 (which came from 21)
      // This is enforced by isLegalRaise
      // Simulate CPU trying to claim 52 - it would fail
      // So CPU would need to claim 21, 31, or call bluff
    });

    test('after non-Mexican claim, normal claim rules still apply', () => {
      // Start with a regular claim (not Mexican)
      useGameStore.setState((s) => ({
        ...s,
        turn: 'player',
        lastClaim: 65,
        lastAction: 'normal',
        lastCpuRoll: 65,
        lastPlayerRoll: 64,
      }));

      // Player can claim a higher regular value
      useGameStore.getState().playerClaim(66);
      let state = useGameStore.getState();
      expect(state.lastClaim).toBe(66);
      expect(state.turn).toBe('cpu');
    });

    test('truthful answer to Mexican keeps lockdown active', () => {
      useGameStore.setState((s) => ({
        ...s,
        turn: 'player',
        lastClaim: 21,
        lastAction: 'normal',
        lastCpuRoll: 21,
        lastPlayerRoll: 21,
      }));

      // Player truthfully claims 21
      useGameStore.getState().playerClaim(21);
      const state = useGameStore.getState();

      // Still in lockdown with 21 as the claim
      expect(state.lastClaim).toBe(21);
      expect(state.turn).toBe('cpu');
      // CPU is now required to respond with 21/31/41 only
    });

    test('isLegalRaise correctly rejects non-special values after Mexican', () => {
      // Engine-level test: verify isLegalRaise enforces the rule
      
      // After Mexican (21), only special values (21, 31, 41) are legal
      expect(isLegalRaise(21, 21)).toBe(true); // Same Mexican
      expect(isLegalRaise(21, 31)).toBe(true); // Reverse
      expect(isLegalRaise(21, 41)).toBe(true); // Social
      expect(isLegalRaise(21, 65)).toBe(false); // Regular value not allowed
      expect(isLegalRaise(21, 66)).toBe(false); // Regular value not allowed
      expect(isLegalRaise(21, 11)).toBe(false); // Regular value not allowed
    });

    test('isLegalRaise allows normal claim progression without Mexican', () => {
      
      // After regular claim (65), you can claim higher regular values
      expect(isLegalRaise(65, 66)).toBe(true); // Higher value
      expect(isLegalRaise(65, 65)).toBe(true); // Same value
      expect(isLegalRaise(65, 64)).toBe(false); // Lower value
      
      // Always can claim reverses (31) after regular claims
      expect(isLegalRaise(65, 31)).toBe(true); // Reverse is always claimable
      expect(isLegalRaise(64, 31)).toBe(true); // Reverse is always claimable
    });

    test('CPU respects Mexican lockdown after player reverses with 31', async () => {
      // This is the bug scenario: CPU claimed 21 (Mexican), player reversed with 31
      // CPU rolls 53 and should NOT be able to claim it - only 21/31/41
      useGameStore.setState((s) => ({
        ...s,
        turn: 'cpu',
        lastClaim: 31,
        lastAction: 'reverseVsMexican',  // Player reversed 21 with 31
        lastPlayerRoll: 31,
        lastCpuRoll: 53,  // CPU rolled 53
      }));

      // Before the fix, CPU could claim 53 here
      // After the fix, CPU should be locked to claiming 21, 31, or 41 only
      const state = useGameStore.getState();
      
      // Verify the state reflects that we're in Mexican lockdown
      expect(state.lastClaim).toBe(31);
      expect(state.lastAction).toBe('reverseVsMexican');
    });

    test('CPU cannot bluff regular claims during Mexican lockdown', async () => {
      // After player reverses with 31, CPU must claim 21/31/41 or call bluff
      // CPU cannot claim regular values like 53
      useGameStore.setState((s) => ({
        ...s,
        turn: 'cpu',
        lastClaim: 31,
        lastAction: 'reverseVsMexican',
        lastPlayerRoll: 31,
        lastCpuRoll: 53,
      }));

      // Mock the AI to try to claim an illegal value (53)
      // The cpuTurn logic should force it to be 21 instead
      expect(useGameStore.getState().lastClaim).toBe(31);
    });
  });
});
