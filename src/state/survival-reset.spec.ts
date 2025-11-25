import { useGameStore } from './useGameStore';

(global.fetch as typeof fetch) = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({ streak: 0 }),
  } as any)
) as typeof fetch;

beforeEach(() => {
  (global.fetch as jest.Mock).mockClear();
  useGameStore.getState().newGame();
});

describe('Survival reset', () => {
  it('startSurvival clears any lingering challenge state', () => {
    useGameStore.setState({
      lastClaim: 65,
      baselineClaim: 65,
      mustBluff: true,
      history: [{ text: 'Old', who: 'player' }],
      survivalHistory: [{ text: 'Old', who: 'player' }],
      survivalClaims: [{ type: 'event', text: 'Old' }],
    });

    useGameStore.getState().startSurvival();
    const state = useGameStore.getState();
    expect(state.lastClaim).toBeNull();
    expect(state.baselineClaim).toBeNull();
    expect(state.mustBluff).toBe(false);
    expect(state.history).toHaveLength(0);
    expect(state.survivalHistory).toHaveLength(0);
    expect(state.survivalClaims).toHaveLength(0);
  });

  it('restartSurvival wipes the current challenge between runs', () => {
    const store = useGameStore.getState();
    store.startSurvival();
    useGameStore.setState({
      lastClaim: 43,
      baselineClaim: 43,
      mustBluff: true,
    });

    store.restartSurvival();
    const state = useGameStore.getState();
    expect(state.lastClaim).toBeNull();
    expect(state.baselineClaim).toBeNull();
    expect(state.mustBluff).toBe(false);
  });
});
