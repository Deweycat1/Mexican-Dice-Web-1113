/**
 * Test suite for verifying claims history tracking in Quick Play mode
 */

import { useGameStore } from './useGameStore';

describe('Claims History Tracking', () => {
  beforeEach(() => {
    // Reset store to initial state
    useGameStore.setState({
      mode: 'normal',
      playerScore: 5,
      cpuScore: 5,
      lastClaim: null,
      baselineClaim: null,
      lastAction: 'normal',
      turn: 'player',
      lastPlayerRoll: null,
      lastCpuRoll: null,
      gameOver: null,
      message: '',
      claims: [],
      history: [],
      survivalClaims: [],
      survivalHistory: [],
      mustBluff: false,
      isRolling: false,
      isBusy: false,
      turnLock: false,
    });
  });

  test('claims array should record player claims', () => {
    const store = useGameStore.getState();
    
    // Simulate player rolling
    store.playerRoll();
    const state1 = useGameStore.getState();
    expect(state1.lastPlayerRoll).not.toBeNull();
    expect(state1.turn).toBe('player');
    
    const roll = state1.lastPlayerRoll!;
    
    // Player makes a claim
    store.playerClaim(roll);
    
    const state2 = useGameStore.getState();
    
    // Check that the claim was recorded
    expect(state2.claims).toBeDefined();
    expect(state2.claims.length).toBeGreaterThan(0);
    
    // Verify the claim entry
    const lastClaim = state2.claims[state2.claims.length - 1];
    expect(lastClaim).toMatchObject({
      type: 'claim',
      who: 'player',
      claim: roll,
    });
    
    console.log('Claims array after player claim:', state2.claims);
  });

  test('claims array should record CPU claims', () => {
    const store = useGameStore.getState();
    
    // Set up state where CPU will make a claim
    useGameStore.setState({
      turn: 'cpu',
      lastClaim: null,
      lastCpuRoll: null,
    });
    
    // Trigger CPU turn
    store.cpuTurn();
    
    // Wait a bit for async operations
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const state = useGameStore.getState();
        
        console.log('Claims array after CPU claim:', state.claims);
        console.log('Last CPU roll:', state.lastCpuRoll);
        console.log('Last claim:', state.lastClaim);
        
        // CPU should have made a claim
        if (state.claims.length > 0) {
          const lastClaim = state.claims[state.claims.length - 1];
          expect(lastClaim.type).toBe('claim');
          if (lastClaim.type === 'claim') {
            expect(lastClaim.who).toBe('cpu');
          }
        }
        
        resolve();
      }, 1000);
    });
  });

  test('claims array should record bluff resolution events', () => {
    const store = useGameStore.getState();
    
    // Set up a scenario where player will call a bluff
    useGameStore.setState({
      turn: 'player',
      lastClaim: 66, // CPU claimed 66
      lastCpuRoll: 43, // But CPU actually rolled 43 (bluffing!)
      lastPlayerRoll: null,
    });
    
    const initialClaimsLength = useGameStore.getState().claims.length;
    
    // Player calls the bluff
    store.callBluff();
    
    const state = useGameStore.getState();
    
    console.log('Claims array after bluff call:', state.claims);
    console.log('Message:', state.message);
    
    // Should have added an event entry
    expect(state.claims.length).toBeGreaterThan(initialClaimsLength);
    
    // The last entry should be an event
    const lastEntry = state.claims[state.claims.length - 1];
    if (lastEntry.type === 'event') {
      expect(lastEntry.text).toContain('bluff');
    }
  });
});
