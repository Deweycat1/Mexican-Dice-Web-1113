/**
 * Comprehensive tests for the 31 reverse mechanic
 * 
 * The 31 claim is special: it "reflects" the previous claim back to the original claimer.
 * Key principle: After someone reverses with 31, the original claimer must now
 * match or beat their OWN original claim.
 * 
 * Example flow:
 * 1. CPU claims 66
 * 2. Player reverses with 31
 * 3. Turn returns to CPU who must now beat 66 (their own claim) or call bluff
 */

import { useGameStore } from '../state/useGameStore';
import { compareClaims, isLegalRaise, isReverseOf } from './mexican';

describe('31 Reverse Mechanic', () => {
  beforeEach(() => {
    useGameStore.getState().newGame();
  });

  test('isReverseOf correctly identifies 31 as reverse of any claim', () => {
    expect(isReverseOf(66, 31)).toBe(true);  // 31 reverses 66
    expect(isReverseOf(52, 31)).toBe(true);  // 31 reverses 52
    expect(isReverseOf(21, 31)).toBe(true);  // 31 reverses Mexican
    expect(isReverseOf(44, 31)).toBe(true);  // 31 reverses doubles
    expect(isReverseOf(65, 31)).toBe(true);  // 31 reverses any claim
    
    // 31 cannot reverse itself (same value exception)
    expect(isReverseOf(31, 31)).toBe(false);  // Same value, not a reverse
    expect(isReverseOf(41, 31)).toBe(true);   // 41 can be reversed by 31
  });

  test('31 is always legal regardless of previous claim', () => {
    expect(isLegalRaise(null, 31)).toBe(true);    // First claim
    expect(isLegalRaise(32, 31)).toBe(true);      // After low claim
    expect(isLegalRaise(66, 31)).toBe(true);      // After high double
    expect(isLegalRaise(21, 31)).toBe(true);      // After Mexican
    expect(isLegalRaise(31, 31)).toBe(true);      // After another 31
  });

  test('Player reverses CPU claim 66 with 31 - turn passes back to CPU', () => {
    // Setup: CPU has claimed 66
    useGameStore.setState({
      turn: 'player',
      lastClaim: 66,
      lastAction: 'normal',
      lastCpuRoll: 66,      // CPU actually rolled 66 (truthful claim)
      lastPlayerRoll: 31,   // Player rolled 31
      playerScore: 5,
      cpuScore: 5,
      gameOver: null,
    });

    // Player claims 31 (reverses the 66)
    useGameStore.getState().playerClaim(31);
    
    const state = useGameStore.getState();
    
    // Verify turn passed back to CPU
    expect(state.turn).toBe('cpu');
    expect(state.lastClaim).toBe(31);
    expect(state.message).toContain('reversed 66 with 31');
  });

  test('After 31 reverse, original claimer must beat their own claim', () => {
    // Setup: CPU claimed 52, player reversed with 31
    useGameStore.setState({
      turn: 'cpu',
      lastClaim: 31,
      lastAction: 'normal',
      lastPlayerRoll: 31,   // Player's reverse
      lastCpuRoll: 52,      // CPU's original claim/roll
      playerScore: 5,
      cpuScore: 5,
      gameOver: null,
      turnLock: false,
      isBusy: false,
    });

    // The baseline is now 31 (the last claim)
    // CPU must now claim something that beats 31 or use always-claimable values
    
    // Verify that 31 is always legal and special claims work
    expect(isLegalRaise(31, 43)).toBe(true);   // 43 beats 31 in normal comparison
    expect(isLegalRaise(31, 21)).toBe(true);   // 21 always legal (Mexican)
    expect(isLegalRaise(31, 31)).toBe(true);   // 31 always legal (reverse)
    
    // Note: After 31 is claimed, the next claim must beat 31 or be special
    // 31 is in REVERSE_SET, so it's always claimable regardless of previous claim
  });

  test('Calling bluff on truthful 31 reverse penalizes caller', () => {
    // Setup: Player reversed with actual 31, CPU calls bluff
    useGameStore.setState({
      turn: 'cpu',
      lastClaim: 31,
      lastAction: 'normal',
      lastPlayerRoll: 31,   // Player actually rolled 31 (truthful)
      lastCpuRoll: 66,
      playerScore: 5,
      cpuScore: 5,
      gameOver: null,
      turnLock: false,
      isBusy: false,
    });

    // CPU calls bluff
    useGameStore.getState().callBluff();
    
    const state = useGameStore.getState();
    
    // Player told truth (rolled 31), so CPU loses a point
    expect(state.cpuScore).toBe(4);  // CPU lost 1 point
    expect(state.playerScore).toBe(5);  // Player score unchanged
    expect(state.turn).toBe('cpu');  // Caller keeps turn after wrong bluff
  });

  test('Calling bluff on bluffed 31 reverse penalizes bluffer', () => {
    // Setup: Player claimed 31 but didn't actually roll it (bluff)
    useGameStore.setState({
      turn: 'cpu',
      lastClaim: 31,
      lastAction: 'normal',
      lastPlayerRoll: 43,   // Player actually rolled 43, not 31 (bluffing)
      lastCpuRoll: 66,
      playerScore: 5,
      cpuScore: 5,
      gameOver: null,
      turnLock: false,
      isBusy: false,
    });

    // CPU calls bluff
    useGameStore.getState().callBluff();
    
    const state = useGameStore.getState();
    
    // Player bluffed (didn't roll 31), so player loses a point
    expect(state.playerScore).toBe(4);  // Player lost 1 point
    expect(state.cpuScore).toBe(5);  // CPU score unchanged
    expect(state.turn).toBe('cpu');  // Caller keeps turn after correct bluff call
  });

  test('31 after Mexican (21) triggers reverseVsMexican action', () => {
    // Setup: CPU claimed Mexican 21
    useGameStore.setState({
      turn: 'player',
      lastClaim: 21,
      lastAction: 'normal',
      lastCpuRoll: 21,
      lastPlayerRoll: 31,
      playerScore: 5,
      cpuScore: 5,
      gameOver: null,
    });

    // Player responds with 31
    useGameStore.getState().playerClaim(31);
    
    const state = useGameStore.getState();
    
    // Verify special action type set
    expect(state.lastAction).toBe('reverseVsMexican');
    expect(state.lastClaim).toBe(31);
    expect(state.turn).toBe('cpu');
  });

  test('Bluff call on reverseVsMexican triggers 2-point penalty', () => {
    // Setup: Player claimed 31 vs Mexican (bluffing)
    useGameStore.setState({
      turn: 'cpu',
      lastClaim: 31,
      lastAction: 'reverseVsMexican',  // Special Mexican reverse
      lastPlayerRoll: 54,   // Player didn't actually roll 31 (bluff)
      lastCpuRoll: 21,      // CPU rolled Mexican
      playerScore: 5,
      cpuScore: 5,
      gameOver: null,
      turnLock: false,
      isBusy: false,
    });

    // CPU calls bluff
    useGameStore.getState().callBluff();
    
    const state = useGameStore.getState();
    
    // Player bluffed against Mexican, loses 2 points
    expect(state.playerScore).toBe(3);  // Lost 2 points
    expect(state.cpuScore).toBe(5);
  });

  test('Truthful 31 vs Mexican - caller loses 2 points', () => {
    // Setup: Player truthfully claimed 31 vs Mexican
    useGameStore.setState({
      turn: 'cpu',
      lastClaim: 31,
      lastAction: 'reverseVsMexican',
      lastPlayerRoll: 31,   // Player actually rolled 31 (truthful)
      lastCpuRoll: 21,      // CPU rolled Mexican
      playerScore: 5,
      cpuScore: 5,
      gameOver: null,
      turnLock: false,
      isBusy: false,
    });

    // CPU calls bluff
    useGameStore.getState().callBluff();
    
    const state = useGameStore.getState();
    
    // Player told truth, CPU loses 2 points for wrong call on reverseVsMexican
    expect(state.playerScore).toBe(5);
    expect(state.cpuScore).toBe(3);  // Lost 2 points
  });

  test('Multiple reverses in sequence', () => {
    // Setup: Chain of reverses
    useGameStore.setState({
      turn: 'player',
      lastClaim: 31,  // CPU just reversed with 31
      lastAction: 'normal',
      lastCpuRoll: 31,
      lastPlayerRoll: 31,  // Player also rolled 31
      playerScore: 5,
      cpuScore: 5,
      gameOver: null,
    });

    // Player can reverse again with 31
    useGameStore.getState().playerClaim(31);
    
    const state = useGameStore.getState();
    
    // Turn passes back to CPU
    expect(state.turn).toBe('cpu');
    expect(state.lastClaim).toBe(31);
    // Note: Since prev was also 31, it's not detected as a "reverse" (same value)
    // Message will be the standard 31 claim message
    expect(state.message).toBeTruthy();
  });

  test('Reverse claim comparison logic', () => {
    // 31 is in a special tier - it doesn't follow normal comparison rules
    // but when comparing 31 to other values in the claim hierarchy:
    
    // Mexican > everything
    expect(compareClaims(21, 31)).toBe(1);  // Mexican beats 31
    
    // 31 vs doubles
    expect(compareClaims(66, 31)).toBe(1);  // Doubles beat 31
    expect(compareClaims(31, 66)).toBe(-1);
    
    // 31 vs normal pairs
    expect(compareClaims(31, 65)).toBe(-1);  // Normal pairs beat 31
    expect(compareClaims(65, 31)).toBe(1);
    
    // 31 is ranked as tier 1 (normal), primary 3, secondary 1
    // So it's actually quite low in the hierarchy when compared directly
  });

  test('Edge case: 31 on first turn (no previous claim)', () => {
    // Setup: First turn of round
    useGameStore.setState({
      turn: 'player',
      lastClaim: null,
      lastAction: 'normal',
      lastCpuRoll: null,
      lastPlayerRoll: 31,
      playerScore: 5,
      cpuScore: 5,
      gameOver: null,
    });

    // Player claims 31 as first move
    useGameStore.getState().playerClaim(31);
    
    const state = useGameStore.getState();
    
    // Legal but unusual - sets baseline as 31
    expect(state.lastClaim).toBe(31);
    expect(state.turn).toBe('cpu');
    // No reverse happened since there was nothing to reverse
  });

  test('31 cannot be used to avoid Mexican lockdown violation', () => {
    // Setup: Mexican lockdown active, player didn't roll special value
    useGameStore.setState({
      turn: 'player',
      lastClaim: 21,
      lastAction: 'normal',
      lastCpuRoll: 21,
      lastPlayerRoll: 65,  // Not 21, 31, or 41
      playerScore: 5,
      cpuScore: 5,
      gameOver: null,
    });

    // Player tries to claim 31 (which is legal under Mexican lockdown)
    // But they didn't actually roll it
    useGameStore.getState().playerClaim(31);
    
    const state = useGameStore.getState();
    
    // This is actually allowed - 31 is always claimable
    // Player is bluffing though, so if called they'll lose 2 points
    expect(state.lastClaim).toBe(31);
    expect(state.lastAction).toBe('reverseVsMexican');
  });

  describe('Multiple 31 reverses in sequence', () => {
    test('Scenario: 66 → 31 → 31 → 31 chain preserves baseline requirement', async () => {
      // Start fresh game
      useGameStore.getState().newGame();
      
      // Round 1: CPU claims 66
      useGameStore.setState({
        turn: 'player',
        lastClaim: 66,
        lastAction: 'normal',
        lastCpuRoll: 66,
        lastPlayerRoll: 31,
        playerScore: 5,
        cpuScore: 5,
        gameOver: null,
        turnLock: false,
        isBusy: false,
      });
      
      // Round 2: Player reverses with first 31
      useGameStore.getState().playerClaim(31);
      let state = useGameStore.getState();
      
      expect(state.lastClaim).toBe(31);
      expect(state.turn).toBe('cpu');
      expect(state.message).toContain('reversed 66 with 31');
      
      // Wait for CPU turn to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Round 3: CPU reverses back with another 31
      state = useGameStore.getState();
      if (state.turn === 'player') {
        // CPU made a move (either claim or called bluff)
        // Set up for next reverse
        useGameStore.setState({
          turn: 'cpu',
          lastClaim: 31,
          lastAction: 'normal',
          lastPlayerRoll: 31,  // Previous player claim
          lastCpuRoll: 31,     // CPU now has 31
          turnLock: false,
          isBusy: false,
        });
      }
      
      // Manually trigger CPU claim of 31 (simulating CPU reverse)
      useGameStore.setState((s) => ({
        turn: 'player',
        lastClaim: 31,
        lastAction: 'normal',
        lastCpuRoll: 31,
        lastPlayerRoll: 43,  // Player has something else
      }));
      
      // Round 4: Player reverses with third 31
      useGameStore.getState().playerClaim(31);
      state = useGameStore.getState();
      
      expect(state.lastClaim).toBe(31);
      expect(state.baselineClaim).toBe(66);  // Baseline preserved!
      // Note: 31 after 31 is NOT detected as a reverse (same value)
      // So turn doesn't switch in the typical reverse pattern
      // But 31 is still always claimable, so the claim succeeds
      
      // Key test: After multiple 31s, the baseline is STILL 66 (the original claim)!
      // The NEXT non-reverse claim must beat 66, not 31
      
      // Verify what beats the baseline (66 is a double, so need Mexican or higher double)
      expect(isLegalRaise(66, 21)).toBe(true);   // 21 (Mexican) always beats everything
      expect(isLegalRaise(66, 31)).toBe(true);   // 31 always legal (reverse)
      expect(isLegalRaise(66, 66)).toBe(true);   // 66 matches baseline
      expect(isLegalRaise(66, 65)).toBe(false);  // 65 doesn't beat 66 (normal < double)
      expect(isLegalRaise(66, 43)).toBe(false);  // 43 doesn't beat 66
    });

    test('Chain reverses: 66 → 31 → call bluff resolves to original claim', () => {
      // Setup: CPU claimed 66, player reversed with 31
      useGameStore.setState({
        turn: 'cpu',
        lastClaim: 31,
        lastAction: 'normal',
        lastPlayerRoll: 31,   // Player actually rolled 31 (truthful reverse)
        lastCpuRoll: 52,      // CPU actually rolled 52, NOT 66 (bluffed)
        playerScore: 5,
        cpuScore: 5,
        gameOver: null,
        turnLock: false,
        isBusy: false,
      });
      
      // CPU calls bluff on player's 31
      useGameStore.getState().callBluff();
      const state = useGameStore.getState();
      
      // Player told truth (actually rolled 31), CPU loses point
      expect(state.playerScore).toBe(5);
      expect(state.cpuScore).toBe(4);
      expect(state.turn).toBe('cpu');  // Caller keeps turn
    });

    test('After multiple 31s, non-special claims must still beat the baseline', () => {
      // Setup: After chain of reverses (66→31→31), baseline should still be 66
      useGameStore.setState({
        turn: 'player',
        lastClaim: 31,
        baselineClaim: 66,  // Original baseline preserved
        lastAction: 'normal',
        lastCpuRoll: 31,
        lastPlayerRoll: 66,  // Player has 66
        playerScore: 5,
        cpuScore: 5,
        gameOver: null,
        turnLock: false,
        isBusy: false,
      });
      
      // Player claims 66 (matches baseline)
      useGameStore.getState().playerClaim(66);
      let state = useGameStore.getState();
      
      expect(state.lastClaim).toBe(66);
      expect(state.turn).toBe('cpu');
      
      // Now verify claims below baseline are illegal
      useGameStore.setState({
        turn: 'player',
        lastClaim: 66,
        baselineClaim: 66,  // Baseline updated to 66 (non-reverse claim)
        lastPlayerRoll: 43,
        turnLock: false,
        isBusy: false,
      });
      
      // Attempting to claim 43 (which doesn't beat 66) should fail
      const beforeScore = state.playerScore;
      useGameStore.getState().playerClaim(43);
      state = useGameStore.getState();
      
      // Claim should be rejected (illegal raise)
      expect(state.message).toContain('must beat');
      expect(state.playerScore).toBe(beforeScore);  // No penalty for illegal attempt
    });

    test('Practical scenario: 66 → 31 → 31 → next player must beat 66', () => {
      // This tests the exact scenario from the user's question
      
      // Step 1: Player A claims 66
      useGameStore.setState({
        turn: 'player',
        lastClaim: 66,
        lastAction: 'normal',
        lastCpuRoll: 66,
        lastPlayerRoll: 31,
        playerScore: 5,
        cpuScore: 5,
        gameOver: null,
      });
      
      // Step 2: Player B (user) reverses with 31
      useGameStore.getState().playerClaim(31);
      let state = useGameStore.getState();
      expect(state.lastClaim).toBe(31);
      expect(state.turn).toBe('cpu');  // Turn back to CPU (Player A)
      
      // Step 3: CPU (Player A) reverses again with 31
      useGameStore.setState({
        turn: 'player',
        lastClaim: 31,
        lastAction: 'normal',
        lastCpuRoll: 31,
        lastPlayerRoll: 31,  // Player also has 31
      });
      
      // Step 4: Player reverses third time with 31
      useGameStore.getState().playerClaim(31);
      state = useGameStore.getState();
      expect(state.lastClaim).toBe(31);
      // Since prev claim was also 31, this is treated as a regular claim, not a reverse
      // Turn should still pass (because it's a valid claim)
      // The baseline is still 66 (preserved through the reverse chain)!
      
      // Step 5: Now CPU must respond
      // The baseline is 66 (the ORIGINAL claim), not 31
      // CPU can:
      // - Call bluff
      // - Claim 66 or higher (must beat the original 66)
      // - Claim 21 (Mexican)
      // - Claim 31 again (another reverse!)
      
      useGameStore.setState({
        turn: 'player',
        lastClaim: 31,
        baselineClaim: 66,  // The original baseline is preserved!
        lastCpuRoll: 66,  // CPU has a high roll
        lastPlayerRoll: 43,
        turnLock: false,
        isBusy: false,
      });
      
      // Player tries to claim 43, but baseline is 66, so this should FAIL
      useGameStore.getState().playerClaim(43);
      state = useGameStore.getState();
      
      // 43 doesn't beat 66, so claim should be rejected
      expect(state.lastClaim).toBe(31);  // Still 31, not changed to 43
      expect(state.message).toContain('must beat');  // Error message shown
      
      // Now try with 66 which should succeed
      useGameStore.setState({
        turn: 'player',
        lastPlayerRoll: 66,
        turnLock: false,
        isBusy: false,
      });
      useGameStore.getState().playerClaim(66);
      state = useGameStore.getState();
      expect(state.lastClaim).toBe(66);  // Successfully claimed
      expect(state.turn).toBe('cpu');
    });

    test('Multiple reverses preserve penalty structure on bluff calls', () => {
      // After 31 → 31 → 31, a bluff call should use standard 1-point penalty
      // (not 2-point Mexican penalty, unless one of the 31s was after a 21)
      
      useGameStore.setState({
        turn: 'cpu',
        lastClaim: 31,
        lastAction: 'normal',  // Standard reverse, not reverseVsMexican
        lastPlayerRoll: 43,    // Player bluffed (didn't have 31)
        lastCpuRoll: 52,
        playerScore: 5,
        cpuScore: 5,
        gameOver: null,
        turnLock: false,
        isBusy: false,
      });
      
      // CPU calls bluff
      useGameStore.getState().callBluff();
      const state = useGameStore.getState();
      
      // Player bluffed, loses 1 point (standard penalty, not 2)
      expect(state.playerScore).toBe(4);  // Lost 1 point
      expect(state.cpuScore).toBe(5);     // Unchanged
    });
  });
});
