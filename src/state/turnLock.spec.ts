import { useGameStore } from './useGameStore';

const flushCpuTurn = async () => {
  jest.advanceTimersByTime(1200);
  await Promise.resolve();
};

describe('turn lock and mustBluff behaviour', () => {
  let randomSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    randomSpy = jest.spyOn(Math, 'random').mockImplementation(() => 0.6);
    useGameStore.getState().newGame();
  });

  afterEach(() => {
    jest.useRealTimers();
    randomSpy.mockRestore();
  });

  test('ignores extra player taps while turn is locked', async () => {
    useGameStore.getState().playerRoll();
    useGameStore.getState().playerClaim(65);
    const duringLock = useGameStore.getState();

    useGameStore.getState().playerClaim(66);

    const stillLocked = useGameStore.getState();
    expect(stillLocked.lastClaim).toBe(duringLock.lastClaim);
    expect(stillLocked.turn).toBe('cpu');

    await flushCpuTurn();

    const postCpu = useGameStore.getState();
    expect(postCpu.turn).toBe('player');
    expect(postCpu.turnLock).toBe(false);
    expect(postCpu.isBusy).toBe(false);
  });

  test('player roll during CPU turn is ignored', async () => {
    useGameStore.getState().playerRoll();
    useGameStore.getState().playerClaim(64);

    await flushCpuTurn();

    const before = useGameStore.getState().lastClaim;
    useGameStore.getState().playerRoll();
    expect(useGameStore.getState().lastClaim).toBe(before);
  });

  test('CPU auto turn releases lock and busy flags', async () => {
    useGameStore.getState().playerRoll();
    useGameStore.getState().playerClaim(53);

    await flushCpuTurn();

    const state = useGameStore.getState();
    expect(state.turn).toBe('player');
    expect(state.turnLock).toBe(false);
    expect(state.isBusy).toBe(false);
  });

  test('player call bluff keeps their turn and no CPU auto-run', async () => {
    useGameStore.setState((s) => ({
      ...s,
      turn: 'player',
      lastClaim: 64,
      lastAction: 'normal',
      lastCpuRoll: 64,
      message: 'The Rival claims 64. Your move — roll & claim or call bluff.',
    }));
    useGameStore.getState().callBluff();

    const afterCall = useGameStore.getState();
    expect(afterCall.turn).toBe('player');
    expect(afterCall.lastClaim).toBeNull();

    await flushCpuTurn();

    const final = useGameStore.getState();
    expect(final.turn).toBe('player');
  });

  test('mustBluff true when roll cannot legally beat previous claim', () => {
    randomSpy.mockReset();
    randomSpy.mockReturnValueOnce(0.98).mockReturnValueOnce(0.4); // 6 and 3 => 63

    useGameStore.setState((s) => ({
      ...s,
      turn: 'player',
      lastClaim: 64,
      lastAction: 'normal',
      lastCpuRoll: 64,
      message: 'The Rival claims 64. Your move — roll & claim or call bluff.',
    }));

    useGameStore.getState().playerRoll();

    const state = useGameStore.getState();
    expect(state.lastPlayerRoll).toBe(63);
    expect(state.mustBluff).toBe(true);
    expect(state.turn).toBe('player');
    expect(state.turnLock).toBe(false);

    randomSpy.mockReset();
    randomSpy.mockImplementation(() => 0.6);
  });

  test('player cannot roll twice in the same turn', () => {
    useGameStore.getState().playerRoll();
    const firstRoll = useGameStore.getState().lastPlayerRoll;

    useGameStore.getState().playerRoll();
    expect(useGameStore.getState().lastPlayerRoll).toBe(firstRoll);
  });
});
