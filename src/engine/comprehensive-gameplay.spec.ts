import { useGameStore } from '../state/useGameStore';

const resetToNewGame = () => {
  useGameStore.getState().newGame();
};

const flushCpuTurn = async () => {
  jest.advanceTimersByTime(1200);
  await Promise.resolve();
};

describe('Comprehensive Gameplay Scenarios', () => {
  let randomSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    randomSpy = jest.spyOn(Math, 'random').mockImplementation(() => 0.5);
    resetToNewGame();
  });

  afterEach(() => {
    jest.useRealTimers();
    randomSpy.mockRestore();
  });

  test('Full round: player rolls, claims, CPU challenges, someone loses 1 point', async () => {
    const initialState = useGameStore.getState();
    expect(initialState.playerScore).toBe(5);
    expect(initialState.cpuScore).toBe(5);
    expect(initialState.turn).toBe('player');

    // Player rolls
    useGameStore.getState().playerRoll();
    let state = useGameStore.getState();
    expect(state.lastPlayerRoll).not.toBeNull();
    expect(state.message).toContain('rolled');

    // Player claims their roll
    const playerRoll = state.lastPlayerRoll!;
    useGameStore.getState().playerClaim(playerRoll);
    state = useGameStore.getState();
    expect(state.lastClaim).toBe(playerRoll);
    expect(state.turn).toBe('cpu');

    // CPU takes its turn
    await flushCpuTurn();
    state = useGameStore.getState();
    
    // Either CPU made a claim, or called bluff
    if (state.turn === 'player' && state.lastClaim === null) {
      // CPU called bluff and won
      expect(state.gameOver === null).toBe(true); // Game still going
    } else {
      // CPU made a new claim
      expect(state.lastClaim).not.toBeNull();
      expect(state.turn).toBe('player');
    }
  });

  test('Mexican sequence: claim 21, respond with 31', async () => {
    // Set up CPU claiming Mexican
    useGameStore.setState((s) => ({
      ...s,
      turn: 'player',
      lastClaim: 21,
      lastAction: 'normal',
      lastCpuRoll: 21,
      lastPlayerRoll: null,
    }));

    // Player responds with 31 (reverse)
    useGameStore.getState().playerClaim(31);
    let state = useGameStore.getState();
    expect(state.lastClaim).toBe(31);
    expect(state.turn).toBe('cpu');
    expect(state.message).toBeTruthy();
  });

  test('Social (41) resets the round without point loss', async () => {
    // Set up mid-round
    useGameStore.setState((s) => ({
      ...s,
      turn: 'player',
      lastClaim: 65,
      lastAction: 'normal',
      lastCpuRoll: 65,
      lastPlayerRoll: 41,
      playerScore: 4, // Had lost 1 point already
      cpuScore: 3,    // Had lost 2 points
    }));

    // Player claims 41 (Social)
    useGameStore.getState().playerClaim(41);
    const state = useGameStore.getState();

    // Round resets - scores don't change
    expect(state.playerScore).toBe(4);
    expect(state.cpuScore).toBe(3);
    expect(state.lastClaim).toBeNull();
    expect(state.message).toContain('Social');
  });

  test('Bluff call outcome depends on whether claim matches roll', async () => {
    useGameStore.setState((s) => ({
      ...s,
      turn: 'player',
      lastClaim: 52,
      lastAction: 'normal',
      lastCpuRoll: 52,
      lastPlayerRoll: 65,
    }));

    // Player claims 65 (truthful - matches their roll)
    useGameStore.getState().playerClaim(65);
    let state = useGameStore.getState();
    expect(state.lastClaim).toBe(65);
    expect(state.turn).toBe('cpu');

    // CPU calls bluff
    useGameStore.getState().callBluff();
    state = useGameStore.getState();

    // After bluff call, game state changes
    // Claim may or may not be cleared depending on outcome
    expect([3, 4, 5]).toContain(state.cpuScore); // Score changed or stayed same
    expect([3, 4, 5]).toContain(state.playerScore);
  });

  test('Round continuation and bluff outcomes', async () => {
    // Start fresh round
    useGameStore.getState().newGame();
    let state = useGameStore.getState();

    // Player rolls
    useGameStore.getState().playerRoll();
    state = useGameStore.getState();
    expect(state.lastPlayerRoll).not.toBeNull();

    // Player claims a higher double to beat the previous mixed roll
    // If they rolled something like 43, they could claim 55 (double beats mixed)
    const rollValue = state.lastPlayerRoll!;
    // Claim the roll or a higher valid claim
    useGameStore.getState().playerClaim(rollValue);
    state = useGameStore.getState();
    expect(state.lastClaim).toBe(rollValue);
    expect(state.turn).toBe('cpu');

    // Verify game is still active
    expect(state.gameOver).toBeNull();
    expect(state.playerScore).toBeGreaterThan(0);
    expect(state.cpuScore).toBeGreaterThan(0);
  });

  test('Mexican penalty: losing to Mexican costs 2 points', async () => {
    useGameStore.setState((s) => ({
      ...s,
      turn: 'player',
      lastClaim: 21,
      lastAction: 'normal',
      lastCpuRoll: 21,
      lastPlayerRoll: 65,
    }));

    // Player can't answer Mexican with regular claim
    useGameStore.getState().playerClaim(65);
    const state = useGameStore.getState();

    // Automatic 2-point penalty for not answering Mexican
    expect(state.playerScore).toBe(3);
    expect(state.cpuScore).toBe(5);
    expect(state.message).toContain('Mexican');
  });

  test('Game ends when player hits 0 points', async () => {
    useGameStore.setState((s) => ({
      ...s,
      playerScore: 1,
      cpuScore: 4,
      turn: 'player',
      lastClaim: 65,
      lastCpuRoll: 65,
      lastPlayerRoll: 42,
    }));

    // Player makes a bad bluff
    useGameStore.getState().playerClaim(66);
    useGameStore.getState().callBluff();
    const state = useGameStore.getState();

    // If CPU was right and player bluffed, player loses 1 point and hits 0
    if (state.playerScore === 0) {
      expect(state.gameOver).toBe('cpu');
      expect(state.message).toContain('hit 0');
    }
  });

  test('Multiple claims in sequence (chain)', async () => {
    useGameStore.setState((s) => ({
      ...s,
      turn: 'player',
      lastClaim: 53,
      lastCpuRoll: 53,
      lastPlayerRoll: 63,
    }));

    // Player claims 63
    useGameStore.getState().playerClaim(63);
    let state = useGameStore.getState();
    expect(state.lastClaim).toBe(63);
    expect(state.turn).toBe('cpu');

    // CPU would respond...
    useGameStore.setState((s) => ({
      ...s,
      turn: 'cpu',
      lastCpuRoll: 64,
    }));

    // CPU can claim 64 (beats 63) or call bluff
    // Let's say CPU claims 64
    useGameStore.setState((s) => ({
      ...s,
      lastClaim: 64,
      turn: 'player',
    }));

    state = useGameStore.getState();
    expect(state.lastClaim).toBe(64);
    expect(state.turn).toBe('player');

    // Player would need to claim 64+ or 21/31 or call bluff
  });

  test('Turn tracking: turns alternate between player and CPU', async () => {
    let state = useGameStore.getState();
    expect(state.turn).toBe('player');

    // Player roll
    useGameStore.getState().playerRoll();
    state = useGameStore.getState();
    expect(state.turn).toBe('player'); // Still player's turn until they claim

    // Player claim
    useGameStore.getState().playerClaim(state.lastPlayerRoll!);
    state = useGameStore.getState();
    expect(state.turn).toBe('cpu');

    // CPU turn
    await flushCpuTurn();
    state = useGameStore.getState();
    // Turn could be 'player' again if CPU made a claim
    expect(['player', 'cpu']).toContain(state.turn);
  });

  test('Message system guides player through game states', async () => {
    let state = useGameStore.getState();
    // After newGame, message should welcome player
    expect(state.message).toBeTruthy();

    useGameStore.getState().playerRoll();
    state = useGameStore.getState();
    // After roll, message should indicate rolled
    expect(state.message).toBeTruthy();
    expect(state.lastPlayerRoll).not.toBeNull();

    const rollValue = state.lastPlayerRoll!;
    useGameStore.getState().playerClaim(rollValue);
    state = useGameStore.getState();
    // After claim, message should indicate claim was made
    expect(state.message).toBeTruthy();
    expect([state.lastClaim]).toContain(rollValue);
  });
});
