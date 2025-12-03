import { create } from 'zustand';

import LearningAIDiceOpponent from '../ai/LearningAIOpponent';
import { loadAiState, saveAiState } from '../ai/persistence';
import type { DicePair } from '../engine/mexican';
import { loadBestStreak, saveBestStreak } from './survivalStorage';
import { MEXICAN_ICON } from '../lib/constants';

import {
    categorizeClaim,
    claimMatchesRoll,
    compareClaims,
    isAlwaysClaimable,
    isChallengeClaim,
    isLegalRaise,
    isMexican,
    isReverseOf,
    nextHigherClaim,
    normalizeRoll,
    resolveActiveChallenge,
    resolveBluff
} from '../engine/mexican';
import { formatCallBluffMessage } from '../utils/narration';
import { updatePersonalStatsOnGamePlayed } from '../stats/personalStats';

export type Turn = 'player' | 'cpu';
export type LastAction = 'normal' | 'reverseVsMexican';

const STARTING_SCORE = 5;

const other = (turn: Turn): Turn => (turn === 'player' ? 'cpu' : 'player');
const clampFloor = (value: number) => Math.max(0, value);

const aiOpponent = new LearningAIDiceOpponent('cpu');
aiOpponent.setRules(compareClaims, nextHigherClaim, categorizeClaim, claimMatchesRoll);

void loadAiState<ReturnType<typeof aiOpponent.state>>().then((state) => {
  if (state) {
    aiOpponent.loadState(state);
  }
}).catch(() => {
  // ignore persistence load errors; AI will learn from scratch
});

let roundIndexCounter = 0;
let pendingCpuRaise: { claim: number; roll: DicePair; normalized: number } | null = null;

const persistAiState = () => {
  void saveAiState(aiOpponent.state());
};

const settlePendingCpuRaise = (opponentCalled: boolean) => {
  if (!pendingCpuRaise) return;
  aiOpponent.observeOurRaiseResolved('player', pendingCpuRaise.claim, pendingCpuRaise.normalized, opponentCalled);
  pendingCpuRaise = null;
  persistAiState();
};

export type Store = {
  playerScore: number;
  cpuScore: number;
  turn: Turn;

  lastClaim: number | null;
  baselineClaim: number | null;  // Tracks original claim before any reverses (31/41)
  lastAction: LastAction;
  lastPlayerRoll: number | null;
  lastCpuRoll: number | null;

  isRolling: boolean;
  mustBluff: boolean;
  message: string;
  mexicanFlashNonce: number;
  cpuSocialDice: DicePair | null;
  cpuSocialRevealNonce: number;
  socialBannerNonce: number;
  lastBluffCaller: Turn | null;
  lastBluffDefenderTruth: boolean | null;
  bluffResultNonce: number;
  
  // Turn timing tracking
  playerTurnStartTime: number | null;

  // Recent score-change history (FIFO oldest->newest)
  history: { text: string; who: 'player' | 'cpu' }[];
  // Separate history for Survival mode so it doesn't mix with quick play
  survivalHistory: { text: string; who: 'player' | 'cpu' }[];
  // Quick Play mode: list of last 10 claims (player and cpu), tagging bluffs
  claims: (
    | { type: 'claim'; who: Turn; claim: number; bluff: boolean }
    | { type: 'event'; text: string }
  )[];
  // Survival mode: list of last 10 claims (player and cpu), tagging bluffs
  survivalClaims: (
    | { type: 'claim'; who: Turn; claim: number; bluff: boolean }
    | { type: 'event'; text: string }
  )[];

  turnLock: boolean;
  isBusy: boolean;
  gameOver: Turn | null;

  newGame(): void;
  resetRound(): void;

  playerRoll(): void;
  playerClaim(claim: number): void;
  callBluff(): void;
  cpuTurn(): Promise<void> | void;

  addHistory(entry: { text: string; who: 'player' | 'cpu' }): void;

  beginTurnLock(): void;
  endTurnLock(): void;

  buildBanner(): string;
  setMessage(msg: string): void;
  // Survival mode state
  mode: 'normal' | 'survival';
  currentStreak: number;
  bestStreak: number;
  globalBest: number;
  isSurvivalOver: boolean;
  survivalPlayerScore: number;
  survivalCpuScore: number;
  startSurvival(): void;
  restartSurvival(): void;
  stopSurvival(): void;
  endSurvival(reason: string): void;
  fetchGlobalBest(): Promise<void>;
  submitGlobalBest(streak: number): Promise<void>;
  recordWin(winner: 'player' | 'cpu'): Promise<void>;
  recordSurvivalRun(streak: number): Promise<void>;
};

const buildSurvivalChallengeReset = (): Pick<
  Store,
  | 'lastClaim'
  | 'baselineClaim'
  | 'lastAction'
  | 'lastPlayerRoll'
  | 'lastCpuRoll'
  | 'mustBluff'
  | 'history'
  | 'survivalHistory'
  | 'survivalClaims'
> => ({
  lastClaim: null,
  baselineClaim: null,
  lastAction: 'normal',
  lastPlayerRoll: null,
  lastCpuRoll: null,
  mustBluff: false,
  history: [] as Store['history'],
  survivalHistory: [] as Store['survivalHistory'],
  survivalClaims: [] as Store['survivalClaims'],
});

const isTestEnv = process.env.NODE_ENV === 'test';

export const useGameStore = create<Store>((set, get) => {
  const beginTurnLock = () => set({ turnLock: true });
  const endTurnLock = () => set({ turnLock: false });

  const rollDice = (): { values: [number, number]; normalized: number } => {
    const rollDie = () => Math.floor(Math.random() * 6) + 1;
    const d1 = rollDie();
    const d2 = rollDie();
    return {
      values: [d1, d2],
      normalized: normalizeRoll(d1, d2),
    };
  };

  const recordRollStat = async (normalized: number) => {
    if (isTestEnv) return;
    try {
      // Convert normalized roll to string format (high die first)
      const rollStr = String(normalized);
      await fetch('/api/roll-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll: rollStr }),
      });
      // Silently ignore errors - don't break gameplay
    } catch (error) {
      // Network failures must not break gameplay
      console.error('Failed to record roll stat:', error);
    }
  };

  const recordClaimStat = async (claim: number) => {
    if (isTestEnv) return;
    try {
      const claimStr = String(claim);
      await fetch('/api/claim-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim: claimStr }),
      });
    } catch (error) {
      console.error('Failed to record claim stat:', error);
    }
  };

  const recordWin = async (winner: 'player' | 'cpu') => {
    if (isTestEnv) return;
    try {
      await fetch('/api/win-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner }),
      });
    } catch (error) {
      console.error('Failed to record win:', error);
    }
  };

  const recordSurvivalRun = async (streak: number) => {
    if (isTestEnv) return;
    try {
      try {
        // Notify server of this device's survival run so we can track per-device bests
        // Use deviceId stored locally (getOrCreateDeviceId)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getOrCreateDeviceId } = require('../utils/deviceId');
        const deviceId = await getOrCreateDeviceId();
        await fetch('/api/survival-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, streak }),
        });
      } catch (err) {
        // Non-fatal: don't block gameplay if server per-device tracking fails
        console.error('Failed to record per-device survival run:', err);
      }
    } catch (error) {
      console.error('Failed to record survival run:', error);
    }
  };

  const postClaimOutcome = async (params: { 
    winner: 'player' | 'cpu'; 
    winningClaim?: string | null; 
    losingClaim?: string | null;
  }) => {
    if (isTestEnv) return;
    try {
      await fetch('/api/claim-outcome-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    } catch (error) {
      console.error('Failed to record claim outcome:', error);
    }
  };

  type BehaviorEvent = 
    | { type: 'rival-claim'; truth: boolean; bluffWon?: boolean }
    | { type: 'bluff-call'; caller: 'player' | 'rival'; correct: boolean };

  const postBehaviorEvent = async (event: BehaviorEvent) => {
    if (isTestEnv) return;
    try {
      await fetch('/api/behavior-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error('Failed to record behavior event:', error);
    }
  };

  // Meta-stats helpers
  const incrementKV = async (key: string) => {
    if (isTestEnv) return;
    try {
      await fetch('/api/increment-kv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
    } catch (error) {
      console.error(`Failed to increment ${key}:`, error);
    }
  };

  const trackHonesty = async (truthful: boolean) => {
    const key = truthful ? 'stats:player:truthfulClaims' : 'stats:player:bluffClaims';
    void incrementKV(key);
  };

  const trackAggression = async (who: 'player' | 'rival', aggressive: boolean) => {
    void incrementKV(`stats:${who}:totalDecisionEvents`);
    if (aggressive) {
      void incrementKV(`stats:${who}:aggressiveEvents`);
    }
  };

  const trackClaimRisk = async (code: string, won: boolean) => {
    const suffix = won ? 'wins' : 'losses';
    void incrementKV(`stats:claims:${code}:${suffix}`);
  };

  // Track turn timing for Random Stats
  const recordTurnDuration = async (durationMs: number) => {
    if (isTestEnv) return;
    try {
      await fetch('/api/random-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'turn', durationMs }),
      });
    } catch (error) {
      console.error('Failed to record turn duration:', error);
    }
  };

  // Track low-roll bluff behavior for Random Stats
  const recordLowRollBehavior = async (actualRoll: number, wasBluff: boolean) => {
    if (isTestEnv) return;
    try {
      if (actualRoll < 61) {
        await fetch('/api/random-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'lowRoll', actualRoll, wasBluff }),
        });
      }
    } catch (error) {
      console.error('Failed to record low-roll behavior:', error);
    }
  };

  const pushSurvivalClaim = (who: Turn, claim: number, actual: number | null | undefined) => {
    const s = get();
    if (s.mode !== 'survival') return;
    const bluff = typeof actual === 'number' && !Number.isNaN(actual) ? claim !== actual : true;
    const entry: { type: 'claim'; who: Turn; claim: number; bluff: boolean } = { 
      type: 'claim', 
      who, 
      claim, 
      bluff 
    };
    set((prev) => ({
      survivalClaims: [...(prev.survivalClaims ?? []), entry].slice(-10),
    }));
  };

  const pushSurvivalEvent = (text: string) => {
    const s = get();
    if (s.mode !== 'survival') return;
    const entry: { type: 'event'; text: string } = { type: 'event', text };
    set((prev) => ({
      survivalClaims: [...(prev.survivalClaims ?? []), entry].slice(-10),
    }));
  };

  const pushClaim = (who: Turn, claim: number, actual: number | null | undefined) => {
    const s = get();
    if (s.mode !== 'normal') return;
    const bluff = typeof actual === 'number' && !Number.isNaN(actual) ? claim !== actual : true;
    const entry: { type: 'claim'; who: Turn; claim: number; bluff: boolean } = { 
      type: 'claim', 
      who, 
      claim, 
      bluff 
    };
    set((prev) => ({
      claims: [...(prev.claims ?? []), entry].slice(-10),
    }));
  };

  const pushEvent = (text: string) => {
    const s = get();
    if (s.mode !== 'normal') return;
    const entry: { type: 'event'; text: string } = { type: 'event', text };
    set((prev) => ({
      claims: [...(prev.claims ?? []), entry].slice(-10),
    }));
  };
  const applyLoss = (who: Turn, amount: 1 | 2, message: string) => {
    const state = get();
    const updatedPlayer = clampFloor(state.playerScore - (who === 'player' ? amount : 0));
    const updatedCpu = clampFloor(state.cpuScore - (who === 'cpu' ? amount : 0));
    const loserScore = who === 'player' ? updatedPlayer : updatedCpu;
    const finished = loserScore <= 0;
    if (finished) {
      void updatePersonalStatsOnGamePlayed();
    }
    const finalMessage = finished
      ? who === 'player'
        ? 'You hit 0 points. The Rival wins.'
        : 'The Rival hit 0 points. You win!'
      : message;

    // Create a concise history entry object for scoreboard changes
    const entry = who === 'player'
      ? { text: `${finalMessage} You: ${updatedPlayer} | The Rival: ${updatedCpu}`, who: 'player' as const }
      : { text: `${finalMessage} You: ${updatedPlayer} | The Rival: ${updatedCpu}`, who: 'cpu' as const };

    // Update the appropriate score bucket depending on mode
    if (state.mode === 'survival') {
      const updatedSP = clampFloor(state.survivalPlayerScore - (who === 'player' ? amount : 0));
      const updatedSC = clampFloor(state.survivalCpuScore - (who === 'cpu' ? amount : 0));
      set((prev) => ({
        survivalPlayerScore: updatedSP,
        survivalCpuScore: updatedSC,
        gameOver: finished ? other(who) : null,
        message: finalMessage,
        survivalHistory: [...(prev.survivalHistory ?? []), entry].slice(-3),
      }));
    } else {
      // Quick Play mode - record win if game ends
      if (finished) {
        const winner = other(who); // The winner is the opposite of who lost
        const loser = who; // who lost the point
        void recordWin(winner);
        
        // Record winning/losing claims for Quick Play
        // Use the last claim made (normalized roll code)
        const finalClaim = state.lastClaim ? String(state.lastClaim) : null;
        
        void postClaimOutcome({
          winner,
          winningClaim: winner === 'player' ? finalClaim : null,
          losingClaim: winner === 'cpu' ? finalClaim : null,
        });

        // Track claim risk: Find the last claim made by each player from claims history
        // This ensures we track both winner's wins and loser's losses
        const playerLastClaim = state.claims
          .slice()
          .reverse()
          .find((c) => c.type === 'claim' && c.who === 'player');
        const cpuLastClaim = state.claims
          .slice()
          .reverse()
          .find((c) => c.type === 'claim' && c.who === 'cpu');

        if (winner === 'player' && playerLastClaim && playerLastClaim.type === 'claim') {
          void trackClaimRisk(String(playerLastClaim.claim), true); // Player won
        } else if (winner === 'cpu' && cpuLastClaim && cpuLastClaim.type === 'claim') {
          void trackClaimRisk(String(cpuLastClaim.claim), true); // CPU won
        }

        if (loser === 'player' && playerLastClaim && playerLastClaim.type === 'claim') {
          void trackClaimRisk(String(playerLastClaim.claim), false); // Player lost
        } else if (loser === 'cpu' && cpuLastClaim && cpuLastClaim.type === 'claim') {
          void trackClaimRisk(String(cpuLastClaim.claim), false); // CPU lost
        }
      }
      // Add point event to normal mode claims history
      pushEvent(finalMessage);
      set((prev) => ({
        playerScore: updatedPlayer,
        cpuScore: updatedCpu,
        gameOver: finished ? other(who) : null,
        message: finalMessage,
        history: [...(prev.history ?? []), entry].slice(-3),
      }));
    }

    // Survival mode handling: if survival is active update streaks/run state
    try {
      const s = get();
      if (s.mode === 'survival' && !s.isSurvivalOver) {
        if (who === 'player' && amount > 0) {
          // player lost -> mark run over but keep the last streak value visible until restart
          const prevStreak = s.currentStreak || 0;
          const newBest = Math.max(s.bestStreak || 0, prevStreak);
          void saveBestStreak(newBest);
          set({ bestStreak: newBest, isSurvivalOver: true });
          // record streak end event using the final streak value
          pushSurvivalEvent(`💀 Streak ended at ${prevStreak}`);
          // Submit the streak to global best
          void submitGlobalBest(prevStreak);
          // Record survival run to average calculation
          void recordSurvivalRun(prevStreak);
          void updatePersonalStatsOnGamePlayed();
        } else if (who === 'cpu') {
          // cpu lost -> player survived the round
          // increment streak and update/persist bestStreak if we've reached a new high
          const streakIncrement = amount === 2 ? 2 : 1;
          set((prev) => {
            const prevStreak = prev.currentStreak || 0;
            const newStreak = prevStreak + streakIncrement;
            const prevBest = prev.bestStreak || 0;
            const newBest = Math.max(prevBest, newStreak);
            // persist new best if it changed
            if (newBest !== prevBest) {
              void saveBestStreak(newBest);
            }
            return { currentStreak: newStreak, bestStreak: newBest };
          });
          // record point gain event
          pushSurvivalEvent(`✨ You survived! Streak: ${get().currentStreak}`);
        }
      }
    } catch {
      // ignore survival persistence errors
    }

    return { gameOver: finished };
  };

  const resetRound = () => {
    roundIndexCounter += 1;
    pendingCpuRaise = null;
    set({
      lastClaim: null,
      baselineClaim: null,  // Reset baseline at round start
      lastAction: 'normal',
      lastPlayerRoll: null,
      lastCpuRoll: null,
      mustBluff: false,
      isRolling: false,
      cpuSocialDice: null,
    });
  };

  // Survival controls
  const startSurvival = () => {
    // Reset survival scores and round state when starting a run
    const survivalReset = buildSurvivalChallengeReset();
    set({
      ...survivalReset,
      mode: 'survival',
      currentStreak: 0,
      isSurvivalOver: false,
      survivalPlayerScore: STARTING_SCORE,
      survivalCpuScore: STARTING_SCORE,
      turnLock: false,
      isBusy: false,
      gameOver: null,
      mexicanFlashNonce: 0,
      cpuSocialDice: null,
      cpuSocialRevealNonce: 0,
      socialBannerNonce: 0,
      lastBluffCaller: null,
      lastBluffDefenderTruth: null,
      bluffResultNonce: 0,
      playerTurnStartTime: null,
      turn: 'player',
    });
    void loadBestStreak().then((b) => set({ bestStreak: b || 0 })).catch(() => {});
    // Fetch global best when starting survival mode
    void fetchGlobalBest();
  };

  const restartSurvival = () => {
    const survivalReset = buildSurvivalChallengeReset();
    set({
      ...survivalReset,
      currentStreak: 0,
      isSurvivalOver: false,
      survivalPlayerScore: STARTING_SCORE,
      survivalCpuScore: STARTING_SCORE,
      turnLock: false,
      isBusy: false,
      gameOver: null,
      mexicanFlashNonce: 0,
      cpuSocialDice: null,
      cpuSocialRevealNonce: 0,
      socialBannerNonce: 0,
      lastBluffCaller: null,
      lastBluffDefenderTruth: null,
      bluffResultNonce: 0,
      playerTurnStartTime: null,
      turn: 'player',
    });
  };

  const endSurvival = (reason: string) => {
    set({ isSurvivalOver: true, message: reason });
  };

  const stopSurvival = () => {
    // exit survival mode and restore normal play
    set({ mode: 'normal', isSurvivalOver: false, currentStreak: 0 });
  };

  const fetchGlobalBest = async () => {
    if (isTestEnv) return;
    try {
      const response = await fetch('/api/survival-best', { method: 'GET' });
      if (!response.ok) throw new Error('Failed to fetch global best');
      const data = await response.json();
      // Handle both old (number) and new (SurvivalBest object) formats
      const streak = typeof data === 'number' ? data : (data.streak ?? 0);
      set({ globalBest: streak });
    } catch (error) {
      console.error('Error fetching global best:', error);
      // Keep current globalBest value on error
    }
  };

  const submitGlobalBest = async (streak: number) => {
    if (isTestEnv) return;
    try {
      const response = await fetch('/api/survival-best', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streak }),
      });
      if (!response.ok) throw new Error('Failed to submit global best');
      const data = await response.json();
      // Handle response with new format (SurvivalBest object)
      const bestStreak = data.streak ?? 0;
      set({ globalBest: bestStreak });
    } catch (error) {
      console.error('Error submitting global best:', error);
      // Keep current globalBest value on error
    }
  };

  const computeLegalTruth = (prev: number | null, actual: number) => {
    if (isAlwaysClaimable(actual)) return true;
    if (prev == null) return true;
    if (isReverseOf(prev, actual)) return true;
    return compareClaims(actual, prev) >= 0;
  };

  const processCallBluff = (caller: Turn) => {
    const state = get();
    const { lastClaim, lastAction, lastPlayerRoll, lastCpuRoll } = state;

    if (lastClaim == null) {
      set({ message: 'No claim to challenge yet.' });
      return { gameOver: false };
    }

    const prevBy: Turn = other(caller);
    const prevActual = prevBy === 'player' ? lastPlayerRoll : lastCpuRoll;

    if (caller === 'cpu') {
      aiOpponent.observeShowdown('player', lastClaim, lastPlayerRoll);
    }

    const { outcome, penalty } = resolveBluff(
      lastClaim,
      prevActual ?? Number.NaN,
      lastAction === 'reverseVsMexican'
    );

    if (prevActual === 21) {
      set({ mexicanFlashNonce: Date.now() });
    }

    const liar = outcome === +1;
    const loser = liar ? prevBy : caller;
    const lossAmount: 1 | 2 = penalty === 2 ? 2 : 1;

    // Track bluff call behavior
    const callerWasCorrect = liar; // If the defender was lying, the caller was correct
    void postBehaviorEvent({
      type: 'bluff-call',
      caller: caller === 'player' ? 'player' : 'rival',
      correct: callerWasCorrect,
    });

    const callerName = caller === 'player' ? 'You' : 'The Rival';
    const defenderName = prevBy === 'player' ? 'You' : 'The Rival';
    const defenderToldTruth = !liar;

    // In survival mode, always show penalty as 1 in the message (even if actual loss is 2)
    const displayPenalty = state.mode === 'survival' ? 1 : lossAmount;

    const message = formatCallBluffMessage({
      callerName,
      defenderName,
      defenderToldTruth,
      penalty: displayPenalty,
      useEmDash: false,
    });

    set((prevState) => ({
      lastBluffCaller: caller,
      lastBluffDefenderTruth: defenderToldTruth,
      bluffResultNonce: (prevState.bluffResultNonce ?? 0) + 1,
    }));

    // Add history entry when Rival incorrectly calls player's bluff
    if (caller === 'cpu' && prevBy === 'player' && defenderToldTruth) {
      if (state.mode === 'survival') {
        pushSurvivalEvent('The Rival called your bluff incorrectly.');
      } else if (state.mode === 'normal') {
        pushEvent('The Rival called your bluff incorrectly.');
      }
    }

    const result = applyLoss(loser, lossAmount, message);
    aiOpponent.observeRoundOutcome(loser === 'player');
    persistAiState();
    pendingCpuRaise = null;

    if (!result.gameOver) {
      resetRound();
      set({ turn: caller });
    }

    return result;
  };

  const cpuTurn = async () => {
    const start = get();
    if (start.gameOver || start.turn !== 'cpu' || start.turnLock) {
      return;
    }

    beginTurnLock();
    set({ isBusy: true });

    try {
      // Add suspense when game is close to ending (either player has 1-2 points left)
      const isCloseGame = start.playerScore <= 2 || start.cpuScore <= 2;
      const thinkingDelay = isCloseGame ? 3000 : 1000;
      
      await new Promise((resolve) => setTimeout(resolve, thinkingDelay));

      const state = get();
      if (state.gameOver || state.turn !== 'cpu') return;

  const { lastClaim, baselineClaim } = state;
      const previousClaim = lastClaim ?? null;
      const roll = rollDice();
      const dicePair: DicePair = roll.values;
      const actual = roll.normalized;
      set({ lastCpuRoll: actual });

      // Record roll statistics (async, non-blocking)
      void recordRollStat(actual);

      if (actual === 41) {
        // Record CPU showing Social in history BEFORE resetting
        pushSurvivalClaim('cpu', 41, 41);
        pushClaim('cpu', 41, 41);
        // Record claim statistics (async, non-blocking)
        void recordClaimStat(41);

        pendingCpuRaise = null;
        const socialDice: DicePair = [
          Math.max(dicePair[0], dicePair[1]),
          Math.min(dicePair[0], dicePair[1]),
        ];
        resetRound();
        set((prevState) => ({
          cpuSocialDice: socialDice,
          cpuSocialRevealNonce: prevState.cpuSocialRevealNonce + 1,
          socialBannerNonce: prevState.socialBannerNonce + 1,
          turn: 'player',
          message: 'The Rival shows Social (41). Round resets.',
        }));
        return;
      }

      // Use baselineClaim for AI decisions (preserves original claim through reverses)
      const claimForAI = resolveActiveChallenge(baselineClaim, lastClaim);
      const action = aiOpponent.decideAction('player', claimForAI, dicePair, roundIndexCounter, lastClaim);

      if (action.type === 'call_bluff') {
        pendingCpuRaise = null;
        const result = processCallBluff('cpu');
        endTurnLock();
        set({ isBusy: false });
        if (!result.gameOver && get().turn === 'cpu') {
          await cpuTurn();
        }
        return;
      }

      const legalTruth = computeLegalTruth(lastClaim, actual);
      let claim = action.claim;

      if (claim === 41 && actual !== 41) {
        claim = legalTruth ? actual : nextHigherClaim(lastClaim ?? actual) ?? 21;
      }

      // Check if we're in Mexican lockdown (either direct 21, or 31 from reverseVsMexican)
      const activeChallenge = resolveActiveChallenge(state.baselineClaim, lastClaim);
      const inMexicanLockdown = isMexican(activeChallenge) || state.lastAction === 'reverseVsMexican';
      
      // Use baselineClaim for legality checks (preserves original claim through reverses)
      const claimToCheck = resolveActiveChallenge(state.baselineClaim, lastClaim);
      
      if (inMexicanLockdown) {
        // In Mexican lockdown, only 21, 31, 41 are legal
        if (!isAlwaysClaimable(claim)) {
          // If AI suggested a non-special value, force it to a special one
          // Prefer the actual roll if it's special, otherwise default to 21
          claim = isAlwaysClaimable(actual) ? actual : 21;
        }
      } else if (!isLegalRaise(claimToCheck, claim)) {
        claim = legalTruth ? actual : nextHigherClaim(claimToCheck ?? actual) ?? 21;
      }

      const actionFlag: LastAction =
        lastClaim === 21 && claim === 31 ? 'reverseVsMexican' : 'normal';

      if (previousClaim != null) {
        aiOpponent.observeOpponentRaiseSize('player', previousClaim, claim);
        persistAiState();
      }

      pendingCpuRaise = {
        claim,
        roll: dicePair,
        normalized: actual,
      };

      const message = (() => {
        if (previousClaim != null && isReverseOf(previousClaim, claim)) {
          return `The Rival reversed ${previousClaim} with ${claim}. Your move...roll & claim or call bluff.`;
        }
        if (claim === 21) {
          return `The Rival claims 21 (Mexican ${MEXICAN_ICON}). You must roll a real 21, 31, or 41 or bluff 21/31...otherwise call bluff.`;
        }
        if (isAlwaysClaimable(claim)) {
          return `The Rival claims ${claim}. Your move...roll & claim or call bluff.`;
        }
        return `The Rival claims ${claim}. Your move...roll & claim or call bluff.`;
      })();

      // record CPU claim in survival mode (truth vs bluff)
      pushSurvivalClaim('cpu', claim, actual);
      // record CPU claim in normal mode too
      pushClaim('cpu', claim, actual);

      // Record claim statistics (async, non-blocking)
      void recordClaimStat(claim);

      // Track Rival behavior: truth vs bluff
      const truth = claim === actual;
      void postBehaviorEvent({
        type: 'rival-claim',
        truth,
        bluffWon: false, // We'll update this when the round resolves
      });

      // Track Rival aggression
      const isBluff = !truth;
      void trackAggression('rival', isBluff);
      
      // Track aggression for high-risk claims (65, 66, 21)
      if (claim === 65 || claim === 66 || claim === 21) {
        void trackAggression('rival', true);
      }

      // Update baseline logic: preserve baseline through reverses
      const currentState = get();
      const nextBaseline = (() => {
        if (claim === 41) return null;
        if (claim === 31) {
          return currentState.baselineClaim ?? (isChallengeClaim(previousClaim) ? previousClaim : null);
        }
        return claim;
      })();

      set({
        lastClaim: claim,
        baselineClaim: nextBaseline,
        lastAction: actionFlag,
        turn: 'player',
        lastPlayerRoll: null,
        mustBluff: false,
        message,
      });
    } finally {
      set({ isBusy: false });
      endTurnLock();
    }
  };

  return {
    playerScore: STARTING_SCORE,
    cpuScore: STARTING_SCORE,
    turn: 'player',

      // last 3 messages shown in the black narration box
      history: [],
      // separate survival history
      survivalHistory: [],
  // normal mode claims list
  claims: [],
  // survival claims list
  survivalClaims: [],

    lastClaim: null,
    baselineClaim: null,  // Initialize baseline claim tracking
    lastAction: 'normal',
    lastPlayerRoll: null,
    lastCpuRoll: null,

    isRolling: false,
    mustBluff: false,
    message: `Welcome to Mexican ${MEXICAN_ICON} Dice!`,
    mexicanFlashNonce: 0,
    cpuSocialDice: null,
    cpuSocialRevealNonce: 0,
    socialBannerNonce: 0,
    lastBluffCaller: null,
    lastBluffDefenderTruth: null,
    bluffResultNonce: 0,
    
    // Turn timing tracking
    playerTurnStartTime: null,

  turnLock: false,
  isBusy: false,
  gameOver: null,
  // survival score bucket (kept separate from normal game scores)
  survivalPlayerScore: STARTING_SCORE,
  survivalCpuScore: STARTING_SCORE,
  // Survival defaults
  mode: 'normal',
  currentStreak: 0,
  bestStreak: 0,
  globalBest: 0,
  isSurvivalOver: false,

    newGame: () => {
      roundIndexCounter = 0;
      pendingCpuRaise = null;
      set({
        playerScore: STARTING_SCORE,
        cpuScore: STARTING_SCORE,
        turn: 'player',
        lastClaim: null,
        baselineClaim: null,  // Reset baseline
        lastAction: 'normal',
        lastPlayerRoll: null,
        lastCpuRoll: null,
        isRolling: false,
        mustBluff: false,
        message: 'New game. Good luck!',
        history: [],
        claims: [],
        playerTurnStartTime: null,
        survivalPlayerScore: STARTING_SCORE,
        survivalCpuScore: STARTING_SCORE,
        // do not touch survivalHistory here; it is for survival mode sessions
        survivalClaims: [],
        turnLock: false,
        isBusy: false,
        gameOver: null,
        mexicanFlashNonce: 0,
        cpuSocialDice: null,
        cpuSocialRevealNonce: 0,
        socialBannerNonce: 0,
      });
    },

    resetRound,

    playerRoll: () => {
      const state = get();
      if (state.gameOver || state.turn !== 'player' || state.turnLock) return;
      if (state.lastPlayerRoll !== null) return;

      if (pendingCpuRaise) {
        settlePendingCpuRaise(false);
      }

      beginTurnLock();
      set({ isRolling: true });

      const { normalized: actual } = rollDice();
      const legalTruth = computeLegalTruth(state.lastClaim, actual);

      // Record roll statistics (async, non-blocking)
      void recordRollStat(actual);
      
      // Start timing player's turn
      const turnStartTime = Date.now();

      set((prev) => ({
        lastPlayerRoll: actual,
        mustBluff: !legalTruth,
        isRolling: false,
        message: legalTruth
          ? `You rolled ${actual}. Claim it or choose a bluff.`
          : `You rolled ${actual}. You must bluff with a higher claim (21 or 31 are always available).`,
        mexicanFlashNonce: actual === 21 ? Date.now() : prev.mexicanFlashNonce,
        playerTurnStartTime: turnStartTime,
      }));

      endTurnLock();
    },

    addHistory: (entry: { text: string; who: 'player' | 'cpu' }) => {
      const mode = get().mode;
      if (mode === 'survival') {
        set((prev) => ({ survivalHistory: [...(prev.survivalHistory ?? []), entry].slice(-3) }));
      } else {
        set((prev) => ({ history: [...(prev.history ?? []), entry].slice(-3) }));
      }
    },
    startSurvival,
    restartSurvival,
    endSurvival,
    stopSurvival,
    fetchGlobalBest,
    submitGlobalBest,
    recordWin,
    recordSurvivalRun,

    playerClaim: (claim: number) => {
      const state = get();
      if (state.gameOver || state.turn !== 'player' || state.turnLock) return;

      // Record claim statistics (async, non-blocking)
      void recordClaimStat(claim);
      
      // Record turn duration if we have a start time
      if (state.playerTurnStartTime !== null) {
        const turnDuration = Date.now() - state.playerTurnStartTime;
        void recordTurnDuration(turnDuration);
      }

      if (pendingCpuRaise) {
        settlePendingCpuRaise(false);
      }

      beginTurnLock();
      set({ isBusy: true });

      const prev = state.lastClaim;
      const activeChallenge = resolveActiveChallenge(state.baselineClaim, prev);

      if (activeChallenge === 21 && claim !== 21 && claim !== 31 && claim !== 41) {
        const result = applyLoss('player', 2, `You failed to answer Mexican ${MEXICAN_ICON} with 21, 31, or 41. You lose 2.`);
        aiOpponent.observeRoundOutcome(true);
        persistAiState();
        if (!result.gameOver) {
          resetRound();
          set({ turn: 'cpu' });
          endTurnLock();
          set({ isBusy: false });
          cpuTurn();
        } else {
          set({ isBusy: false });
          endTurnLock();
        }
        return;
      }

      // Use baselineClaim for legality checks (preserves original claim through reverses)
      const claimToCheck = resolveActiveChallenge(state.baselineClaim, prev);
      
      if (!isLegalRaise(claimToCheck, claim)) {
        set({
          message:
            claimToCheck == null
              ? 'Choose a valid claim.'
              : `Claim ${claim} must beat ${claimToCheck}.`,
          isBusy: false,
        });
        endTurnLock();
        return;
      }

      if (claim === 41) {
        if (state.lastPlayerRoll !== 41) {
          set({
            message: '41 is Social and must be shown, not bluffed.',
            isBusy: false,
          });
          endTurnLock();
          return;
        }

        // record player's Social show in survival mode
        pushSurvivalClaim('player', 41, state.lastPlayerRoll);
        // record player's Social show in normal mode
        pushClaim('player', 41, state.lastPlayerRoll);

        resetRound();
        set((prevState) => ({
          turn: 'cpu',
          message: 'Social (41) shown. Round resets.',
          socialBannerNonce: prevState.socialBannerNonce + 1,
        }));
        set({ isBusy: false });
        endTurnLock();
        cpuTurn();
        return;
      }

      const action: LastAction =
        prev === 21 && claim === 31 ? 'reverseVsMexican' : 'normal';

      const message = (() => {
        if (prev != null && isReverseOf(prev, claim)) {
          return `You reversed ${prev} with ${claim}.`;
        }
        if (claim === 21) {
          return `You claim 21 (Mexican ${MEXICAN_ICON}). The Rival must roll a real 21, 31, or 41 or bluff 21/31, otherwise call bluff.`;
        }
        if (claim === 31 || claim === 41) {
          return `You claim ${claim}. The Rival must roll a real 21 or bluff 21/31, otherwise call bluff.`;
        }
        return `You claim ${claim}.`;
      })();

      // record player's claim in survival mode
      pushSurvivalClaim('player', claim, state.lastPlayerRoll);
      // record player's claim in normal mode
      pushClaim('player', claim, state.lastPlayerRoll);

      // Track honesty: is this claim truthful or a bluff?
      const playerRoll = state.lastPlayerRoll;
      if (playerRoll !== null && !Number.isNaN(playerRoll)) {
        const isTruthful = claim === playerRoll;
        void trackHonesty(isTruthful);
        
        // Track aggression: bluffing is aggressive
        const isBluff = !isTruthful;
        void trackAggression('player', isBluff);
        
        // Track low-roll bluff behavior (for Player Tendencies)
        void recordLowRollBehavior(playerRoll, isBluff);
      }

      // Track aggression for high-risk claims (65, 66, 21)
      if (claim === 65 || claim === 66 || claim === 21) {
        void trackAggression('player', true);
      }

      // Update baseline logic: preserve baseline through reverses
      const nextBaseline = (() => {
        if (claim === 41) return null;
        if (claim === 31) {
          return state.baselineClaim ?? (isChallengeClaim(prev) ? prev : null);
        }
        return claim;
      })();

      set({
        lastClaim: claim,
        baselineClaim: nextBaseline,
        lastAction: action,
        turn: 'cpu',
        mustBluff: false,
        lastPlayerRoll: state.lastPlayerRoll,
        message,
      });

      set({ isBusy: false });
      endTurnLock();

      if (!get().gameOver) {
        cpuTurn();
      }
    },

    callBluff: () => {
      const state = get();
      if (state.gameOver || state.turnLock) return;
      
      // Record turn duration if we have a start time and it's player's turn
      if (state.turn === 'player' && state.playerTurnStartTime !== null) {
        const turnDuration = Date.now() - state.playerTurnStartTime;
        void recordTurnDuration(turnDuration);
      }

      if (state.turn === 'player' && pendingCpuRaise) {
        settlePendingCpuRaise(true);
      }

      beginTurnLock();
      set({ isBusy: true });

      const caller = state.turn;
      
      // Track aggression: calling bluff is an aggressive move
      const who = caller === 'player' ? 'player' : 'rival';
      void trackAggression(who, true);
      
      const result = processCallBluff(caller);

      set({ isBusy: false });
      endTurnLock();

      if (!result.gameOver && get().turn === 'cpu') {
        cpuTurn();
      }
    },

    cpuTurn,

    beginTurnLock,
    endTurnLock,

    buildBanner: () => {
      const state = get();
      if (isMexican(state.lastClaim)) {
        return state.turn === 'player'
          ? `The Rival claims 21 (Mexican ${MEXICAN_ICON}). You must roll a real 21, 31, or 41 or bluff 21/31, otherwise call bluff.`
          : `You claimed 21 (Mexican ${MEXICAN_ICON}). The Rival must roll a real 21, 31, or 41 or bluff 21/31, otherwise call bluff.`;
      }
      return state.message;
    },

    setMessage: (msg: string) => set({ message: msg }),
  };
});
