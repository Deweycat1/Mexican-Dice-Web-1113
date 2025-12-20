import { create } from 'zustand';

import LearningAIDiceOpponent from '../ai/LearningAIOpponent';
import { loadAiState, saveAiState } from '../ai/persistence';
import type { DicePair } from '../engine/mexican';
import { loadBestStreak, saveBestStreak } from './survivalStorage';
import { MEXICAN_ICON } from '../lib/constants';
import {
  playBluffCallFailHaptic,
  playBluffCallSuccessHaptic,
  playBluffDeclaredHaptic,
  playClaimHaptic,
  playLosePointHaptic,
  playRollHaptic,
  playSpecialClaimHaptic,
  playWinRoundHaptic,
} from '../lib/haptics';
import { playDiceRollSound } from '../lib/diceRollSound';
import { useSettingsStore } from './useSettingsStore';

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
  resolveBluff,
} from '../engine/mexican';
import { formatCallBluffMessage } from '../utils/narration';
import {
  incrementPersonalRollCount,
  incrementSuccessfulBluffs,
  updatePersonalStatsOnGamePlayed,
} from '../stats/personalStats';
import { awardBadge, incrementBluffCaught } from '../stats/badges';
import { updateRankFromGameResult } from '../stats/rank';

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

// Dev-only counters to measure softened call_bluff behavior in Survival streak 5–8
let surv_5_8_totalWouldCall = 0;
let surv_5_8_keptCall = 0;
let surv_5_8_overrodeToRaise = 0;

const persistAiState = () => {
  void saveAiState(aiOpponent.state());
};

const settlePendingCpuRaise = (opponentCalled: boolean) => {
  if (!pendingCpuRaise) return;
  aiOpponent.observeOurRaiseResolved('player', pendingCpuRaise.claim, pendingCpuRaise.normalized, opponentCalled);
  pendingCpuRaise = null;
  persistAiState();
};

const isHapticsEnabled = () => useSettingsStore.getState().hapticsEnabled;
const isSfxEnabled = () => useSettingsStore.getState().sfxEnabled;

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
  // Quick Play narration/status line
  message: string;
  // Survival mode narration/status line (kept separate so modes don't bleed)
  survivalMessage: string;
  mexicanFlashNonce: number;
  cpuSocialDice: DicePair | null;
  cpuSocialRevealNonce: number;
  socialBannerNonce: number;
  lastBluffCaller: Turn | null;
  lastBluffDefenderTruth: boolean | null;
  bluffResultNonce: number;
  pendingInfernoDelay: boolean;
  // Per-game bluff tracking for ranking
  playerBluffEventsThisGame: number;
  playerSuccessfulBluffsThisGame: number;
  
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

  playerRoll(): void;
  playerClaim(claim: number): void;
  callBluff(): void;
  cpuTurn(): Promise<void> | void;

  addHistory(entry: { text: string; who: 'player' | 'cpu' }): void;

  beginTurnLock(): void;
  endTurnLock(): void;

  buildBanner(): string;
  setMessage(msg: string): void;
  getBaseMessage(): string;
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
  | 'survivalHistory'
  | 'survivalClaims'
> => ({
  lastClaim: null,
  baselineClaim: null,
  lastAction: 'normal',
  lastPlayerRoll: null,
  lastCpuRoll: null,
  mustBluff: false,
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
    const hapticsEnabled = isHapticsEnabled();
    if (who === 'player') {
      void playLosePointHaptic(hapticsEnabled);
    } else {
      void playWinRoundHaptic(hapticsEnabled);
    }
    const updatedPlayer = clampFloor(state.playerScore - (who === 'player' ? amount : 0));
    const updatedCpu = clampFloor(state.cpuScore - (who === 'cpu' ? amount : 0));
    const loserScore = who === 'player' ? updatedPlayer : updatedCpu;
    const finished = loserScore <= 0;
    if (finished) {
      // Update personal stats and check day-based badges in the background
      void (async () => {
        try {
          const stats = await updatePersonalStatsOnGamePlayed();
          if (stats.totalDaysPlayed >= 7) {
            void awardBadge('welcome_back_7_days');
          }
          if (stats.currentDailyStreak >= 7) {
            void awardBadge('inferno_week_7_day_streak');
          }
        } catch (err) {
          console.error('Failed to update personal stats after game end', err);
        }
      })();
    }
    const finalMessage = finished
      ? who === 'player'
        ? 'You hit 0 points. Infernoman wins.'
        : 'Infernoman hit 0 points. You win!'
      : message;

    // Create a concise history entry object for scoreboard changes
    const entry = who === 'player'
      ? { text: `${finalMessage} You: ${updatedPlayer} | Infernoman: ${updatedCpu}`, who: 'player' as const }
      : { text: `${finalMessage} You: ${updatedPlayer} | Infernoman: ${updatedCpu}`, who: 'cpu' as const };

    // Update the appropriate score bucket depending on mode
    if (state.mode === 'survival') {
      const updatedSP = clampFloor(state.survivalPlayerScore - (who === 'player' ? amount : 0));
      const updatedSC = clampFloor(state.survivalCpuScore - (who === 'cpu' ? amount : 0));
      set((prev) => ({
        survivalPlayerScore: updatedSP,
        survivalCpuScore: updatedSC,
        gameOver: finished ? other(who) : null,
        survivalHistory: [...(prev.survivalHistory ?? []), entry].slice(-3),
      }));
      setModeMessage(finalMessage);
    } else {
      // Quick Play mode - record win if game ends
      if (finished) {
        const winner = other(who); // The winner is the opposite of who lost
        const loser = who; // who lost the point
        void recordWin(winner);
        // Update global rank for quick play (non-blocking).
        void updateRankFromGameResult({
          mode: 'quick_play',
          won: winner === 'player',
          bluffEvents: state.playerBluffEventsThisGame,
          correctBluffEvents: state.playerSuccessfulBluffsThisGame,
        });
        
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

        // Quick Play style badges that depend on the outcome and claim history
        if (winner === 'player') {
          try {
            const claimsSnapshot = state.claims ?? [];

            const playerClaims = claimsSnapshot.filter(
              (e): e is { type: 'claim'; who: Turn; claim: number; bluff: boolean } =>
                e.type === 'claim' && e.who === 'player'
            );

            const hasPlayerBluff = playerClaims.some((c) => c.bluff);
            if (!hasPlayerBluff) {
              void awardBadge('pure_honesty');
            }

            if (playerClaims.length <= 3) {
              void awardBadge('silent_strategist');
            }
          } catch (err) {
            console.error('Failed to evaluate Quick Play style badges', err);
          }
        }
      }
      // Add point event to normal mode claims history
      pushEvent(finalMessage);
      set((prev) => ({
        playerScore: updatedPlayer,
        cpuScore: updatedCpu,
        gameOver: finished ? other(who) : null,
        history: [...(prev.history ?? []), entry].slice(-3),
      }));
      setModeMessage(finalMessage);
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
          // Award global record breaker badge only when this run beats the known global best
          if (prevStreak > (s.globalBest || 0)) {
            void awardBadge('inferno_record_breaker');
          }
          // record streak end event using the final streak value
          pushSurvivalEvent(`💀 Streak ended at ${prevStreak}`);
          // Submit the streak to global best
          void submitGlobalBest(prevStreak);
          // Record survival run to average calculation
          void recordSurvivalRun(prevStreak);
          // Update global rank based on survival streak and bluff behavior (non-blocking).
          void updateRankFromGameResult({
            mode: 'survival',
            survivalStreak: prevStreak,
            bluffEvents: s.playerBluffEventsThisGame,
            correctBluffEvents: s.playerSuccessfulBluffsThisGame,
          });
          // Update global rank based on survival streak (non-blocking).
          void updateRankFromGameResult({
            mode: 'survival',
            survivalStreak: prevStreak,
          });
          // Survival run completion also counts as a played game for personal stats
          void (async () => {
            try {
              const stats = await updatePersonalStatsOnGamePlayed();
              if (stats.totalDaysPlayed >= 7) {
                void awardBadge('welcome_back_7_days');
              }
              if (stats.currentDailyStreak >= 7) {
                void awardBadge('inferno_week_7_day_streak');
              }
            } catch (err) {
              console.error('Failed to update personal stats after survival run', err);
            }
          })();
        } else if (who === 'cpu') {
          // cpu lost -> player survived the round
          // increment streak and update/persist bestStreak if we've reached a new high
          const streakIncrement = amount === 2 ? 2 : 1;
          let newStreak = 0;
          let prevBest = 0;
          let newBest = 0;
          set((prev) => {
            const prevStreak = prev.currentStreak || 0;
            newStreak = prevStreak + streakIncrement;
            prevBest = prev.bestStreak || 0;
            newBest = Math.max(prevBest, newStreak);
            // persist new best if it changed
            if (newBest !== prevBest) {
              void saveBestStreak(newBest);
            }
            return { currentStreak: newStreak, bestStreak: newBest };
          });

          // Survival streak badges (per-run and record-based)
          try {
            if (newStreak >= 5) {
              void awardBadge('inferno_streak_5');
              void awardBadge('first_survivor');
            }
            if (newStreak >= 10) {
              void awardBadge('inferno_streak_10');
            }
            if (newStreak >= 20) {
              void awardBadge('true_survivor_20');
            }
            if (newBest >= 20) {
              void awardBadge('inferno_immortal');
            }
          } catch (err) {
            console.error('Failed to evaluate survival streak badges', err);
          }

          // record point gain event
          pushSurvivalEvent(`✨ You survived! Streak: ${get().currentStreak}`);
        }
      }
    } catch {
      // ignore survival persistence errors
    }

    return { gameOver: finished, loser: who, amount };
  };

  const resetRoundState = () => {
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
      playerBluffEventsThisGame: 0,
      playerSuccessfulBluffsThisGame: 0,
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
      playerBluffEventsThisGame: 0,
      playerSuccessfulBluffsThisGame: 0,
      turn: 'player',
    });
  };

  const endSurvival = (reason: string) => {
    set({ isSurvivalOver: true });
    setModeMessage(reason);
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

  const computeLegalTruth = (activeChallenge: number | null, actual: number) => {
    if (isAlwaysClaimable(actual)) return true;
    if (activeChallenge == null) return true;
    if (isReverseOf(activeChallenge, actual)) return true;
    return compareClaims(actual, activeChallenge) >= 0;
  };

  const processCallBluff = (caller: Turn) => {
    const state = get();
    const hapticsEnabled = isHapticsEnabled();
    const { lastClaim, lastAction, lastPlayerRoll, lastCpuRoll } = state;

    if (lastClaim == null) {
      setModeMessage('No claim to challenge yet.');
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
      void playSpecialClaimHaptic(21, hapticsEnabled);
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

    // Track per-game bluff events for ranking when the player calls bluff
    if (caller === 'player') {
      set((prev) => ({
        ...prev,
        playerBluffEventsThisGame: (prev.playerBluffEventsThisGame ?? 0) + 1,
        playerSuccessfulBluffsThisGame:
          (prev.playerSuccessfulBluffsThisGame ?? 0) + (callerWasCorrect ? 1 : 0),
      }));
    }

    // Lifetime bluff-catcher badges: only count when the player correctly calls Infernoman's bluff
    if (caller === 'player' && callerWasCorrect) {
      (async () => {
        try {
          const totalCaught = await incrementBluffCaught();
          if (totalCaught >= 5) {
            void awardBadge('bluff_catcher_5');
          }
          if (totalCaught >= 10) {
            void awardBadge('bluff_catcher_10');
          }
          if (totalCaught >= 20) {
            void awardBadge('bluff_catcher_20');
          }
        } catch (err) {
          console.error('Failed to evaluate bluff-catcher badges', err);
        }
      })();
    }

    // TODO: Lifetime "successful bluff" tracking for the player currently has
    // no unambiguous signal in this resolution path. When caller === 'cpu'
    // and callerWasCorrect is false, the defender (player) was truthful,
    // so there was no bluff. Counting uncalled bluffs that later lead to a win
    // would require explicit engine support to mark "player bluff succeeded".
    // Once that exists, we can call incrementSuccessfulBluffs() at that point.

    const callerName = caller === 'player' ? 'You' : 'Infernoman';
    const defenderName = prevBy === 'player' ? 'You' : 'Infernoman';
    const defenderToldTruth = !liar;
    if (caller === 'player') {
      if (liar) {
        void playBluffCallSuccessHaptic(hapticsEnabled);
      } else {
        void playBluffCallFailHaptic(hapticsEnabled);
      }
    }

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

    // Add history entry when Infernoman incorrectly calls player's bluff
    if (caller === 'cpu' && prevBy === 'player' && defenderToldTruth) {
      if (state.mode === 'survival') {
        pushSurvivalEvent('Infernoman called your bluff incorrectly.');
      } else if (state.mode === 'normal') {
        pushEvent('Infernoman called your bluff incorrectly.');
      }
    }

    const result = applyLoss(loser, lossAmount, message);

    console.log('[INFERNO] processCallBluff resolved', {
      mode: state.mode,
      caller,
      loser,
      lossAmount,
      gameOver: result.gameOver,
      lastClaim,
      lastPlayerRoll,
      lastCpuRoll,
    });
    aiOpponent.observeRoundOutcome(loser === 'player');
    persistAiState();
    pendingCpuRaise = null;

    if (!result.gameOver) {
      resetRoundState();
      set({ turn: caller });
    }

    return result;
  };

  // Helper: set the appropriate per-mode narration message without leaking between modes
  const setModeMessage = (msg: string) => {
    const mode = get().mode;
    if (mode === 'survival') {
      set({ survivalMessage: msg });
    } else {
      set({ message: msg });
    }
  };

  const cpuTurn = async () => {
    const start = get();
    if (start.gameOver || start.turn !== 'cpu' || start.turnLock) {
      return;
    }
    const hapticsEnabled = isHapticsEnabled();

    const shouldForceInfernoDelay = start.pendingInfernoDelay;
    if (shouldForceInfernoDelay) {
      set({ pendingInfernoDelay: false });
    }

    beginTurnLock();
    set({ isBusy: true });

    try {
      // Add suspense when game is close to ending (either player has 1-2 points left)
      const isCloseGame = start.playerScore <= 2 || start.cpuScore <= 2;
      const thinkingDelay = shouldForceInfernoDelay ? 3000 : isCloseGame ? 3000 : 1000;
      
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
        void playSpecialClaimHaptic(41, hapticsEnabled);
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
        resetRoundState();
        set((prevState) => ({
          cpuSocialDice: socialDice,
          cpuSocialRevealNonce: prevState.cpuSocialRevealNonce + 1,
          socialBannerNonce: prevState.socialBannerNonce + 1,
          turn: 'player',
        }));
        setModeMessage('Infernoman shows Social (41). Round resets.');
        return;
      }

      // Use baselineClaim for AI decisions (preserves original claim through reverses)
      const claimForAI = resolveActiveChallenge(baselineClaim, lastClaim);
      let action = aiOpponent.decideAction(
        'player',
        claimForAI,
        dicePair,
        roundIndexCounter,
        lastClaim
      );

      const streak = state.currentStreak ?? 0;
      const isSurvival = state.mode === 'survival';

      if (isSurvival && action.type === 'call_bluff') {
        const inSoftBand = streak >= 5 && streak < 8;
        const inNoCallBand = streak < 5;

        if (__DEV__ && inSoftBand) {
          surv_5_8_totalWouldCall += 1;
        }

        let keepCall = true;

        if (inNoCallBand) {
          // Streak < 5: never call bluff, always soften to a raise
          keepCall = false;
        } else if (inSoftBand) {
          // Streak 5–7: keep call only ~40% of the time
          keepCall = Math.random() < 0.4;
        }

        if (inSoftBand && __DEV__) {
          if (keepCall) {
            surv_5_8_keptCall += 1;
          } else {
            surv_5_8_overrodeToRaise += 1;
          }

          if (surv_5_8_totalWouldCall > 0 && surv_5_8_totalWouldCall % 10 === 0) {
            const keptRate =
              surv_5_8_totalWouldCall > 0
                ? surv_5_8_keptCall / surv_5_8_totalWouldCall
                : 0;
            console.log('[survival-ai] streak5-8 call_bluff stats', {
              wouldCall: surv_5_8_totalWouldCall,
              kept: surv_5_8_keptCall,
              overrode: surv_5_8_overrodeToRaise,
              keptRate,
            });
          }
        }

        if (!keepCall) {
          const activeChallenge = resolveActiveChallenge(state.baselineClaim, lastClaim);
          const legalTruth = computeLegalTruth(activeChallenge, actual);
          const baseRaise =
            legalTruth ? actual : nextHigherClaim(activeChallenge ?? actual) ?? 21;
          action = { type: 'raise', claim: baseRaise };
        }
      }

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

      const activeChallenge = resolveActiveChallenge(state.baselineClaim, lastClaim);
      const legalTruth = computeLegalTruth(activeChallenge, actual);
      let claim = action.claim;

      if (claim === 41 && actual !== 41) {
        claim = legalTruth ? actual : nextHigherClaim(lastClaim ?? actual) ?? 21;
      }

      // Check if we're in Mexican lockdown (either direct 21, or 31 from reverseVsMexican)
      const inMexicanLockdown = isMexican(activeChallenge) || state.lastAction === 'reverseVsMexican';
      
      // Use baselineClaim for legality checks (preserves original claim through reverses)
      const claimToCheck = activeChallenge;
      
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
          return `Infernoman reversed ${previousClaim} with ${claim}. Your move...roll & claim or call bluff.`;
        }
        if (claim === 21) {
          return `Infernoman claims 21 (Inferno${MEXICAN_ICON}). You must roll a real 21, 31, or 41 or bluff 21/31...otherwise call bluff.`;
        }
        if (isAlwaysClaimable(claim)) {
          return `Infernoman claims ${claim}. Your move...roll & claim or call bluff.`;
        }
        return `Infernoman claims ${claim}. Your move...roll & claim or call bluff.`;
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

      if (claim === 21 || claim === 31 || claim === 41) {
        void playSpecialClaimHaptic(claim, hapticsEnabled);
      }

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
    message: `Welcome to Inferno ${MEXICAN_ICON} Dice!`,
    survivalMessage: 'Survive as long as you can in Inferno Mode.',
    pendingInfernoDelay: false,
    mexicanFlashNonce: 0,
    cpuSocialDice: null,
    cpuSocialRevealNonce: 0,
    socialBannerNonce: 0,
    lastBluffCaller: null,
    lastBluffDefenderTruth: null,
    bluffResultNonce: 0,
    playerBluffEventsThisGame: 0,
    playerSuccessfulBluffsThisGame: 0,
    
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
        pendingInfernoDelay: false,
        // do not touch survivalHistory here; it is for survival mode sessions
        survivalClaims: [],
        turnLock: false,
        isBusy: false,
        gameOver: null,
        mexicanFlashNonce: 0,
        cpuSocialDice: null,
        cpuSocialRevealNonce: 0,
        socialBannerNonce: 0,
        playerBluffEventsThisGame: 0,
        playerSuccessfulBluffsThisGame: 0,
      });
    },

    playerRoll: () => {
      const state = get();
      if (state.gameOver || state.turn !== 'player' || state.turnLock) return;
      if (state.lastPlayerRoll !== null) return;

      const hapticsEnabled = isHapticsEnabled();
      void playRollHaptic(hapticsEnabled);
      void playDiceRollSound(isSfxEnabled());

      if (pendingCpuRaise) {
        settlePendingCpuRaise(false);
      }

      beginTurnLock();
      set({ isRolling: true });

      const { normalized: actual } = rollDice();
      const activeChallenge = resolveActiveChallenge(state.baselineClaim, state.lastClaim);
      const legalTruth = computeLegalTruth(activeChallenge, actual);

      // Record roll statistics (async, non-blocking)
      void recordRollStat(actual);
      void incrementPersonalRollCount(actual);
      
      // Start timing player's turn
      const turnStartTime = Date.now();

      set((prev) => ({
        lastPlayerRoll: actual,
        mustBluff: !legalTruth,
        isRolling: false,
        mexicanFlashNonce: actual === 21 ? Date.now() : prev.mexicanFlashNonce,
        playerTurnStartTime: turnStartTime,
      }));
      setModeMessage(
        legalTruth
          ? `You rolled ${actual}. Claim it or choose a bluff.`
          : `You rolled ${actual}. You must bluff with a higher claim (21 or 31 are always available).`
      );

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
      const hapticsEnabled = isHapticsEnabled();
      void playClaimHaptic(hapticsEnabled);

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
        const result = applyLoss('player', 2, `You failed to answer Inferno${MEXICAN_ICON} with 21, 31, or 41. You lose 2.`);
        aiOpponent.observeRoundOutcome(true);
        persistAiState();
        if (!result.gameOver) {
          resetRoundState();
          set({ turn: 'cpu', pendingInfernoDelay: false });
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
        const msg =
          claimToCheck == null
            ? 'Choose a valid claim.'
            : `Claim ${claim} must beat ${claimToCheck}.`;
        set({ isBusy: false });
        setModeMessage(msg);
        endTurnLock();
        return;
      }

      if (claim === 41) {
        if (state.lastPlayerRoll !== 41) {
          set({ isBusy: false });
          setModeMessage('41 is Social and must be shown, not bluffed.');
          endTurnLock();
          return;
        }

        void playSpecialClaimHaptic(41, hapticsEnabled);

        // record player's Social show in survival mode
        pushSurvivalClaim('player', 41, state.lastPlayerRoll);
        // record player's Social show in normal mode
        pushClaim('player', 41, state.lastPlayerRoll);

        resetRoundState();
        set((prevState) => ({
          turn: 'cpu',
          socialBannerNonce: prevState.socialBannerNonce + 1,
          pendingInfernoDelay: false,
        }));
        setModeMessage('Social (41) shown. Round resets.');
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
        return `You claim 21 (Inferno${MEXICAN_ICON}). Infernoman must roll a real 21, 31, or 41 or bluff 21/31, otherwise call bluff.`;
      }
      if (claim === 31 || claim === 41) {
        return `You claim ${claim}. Infernoman must roll a real 21 or bluff 21/31, otherwise call bluff.`;
      }
      return `You claim ${claim}.`;
    })();

      if (claim === 21 || claim === 31) {
        void playSpecialClaimHaptic(claim, hapticsEnabled);
      }

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
        if (isBluff) {
          void playBluffDeclaredHaptic(hapticsEnabled);
        }
        
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
        pendingInfernoDelay: claim === 21,
      });
      setModeMessage(message);

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

      console.log('[INFERNO] callBluff result', {
        mode: state.mode,
        caller,
        result,
        turnAfter: get().turn,
      });

      set({ isBusy: false });
      endTurnLock();

      const after = get();

      // In Survival/Inferno, when the player correctly calls bluff (CPU loses),
      // immediately advance to the next Rival challenge.
      if (
        !result.gameOver &&
        after.mode === 'survival' &&
        caller === 'player' &&
        result.loser === 'cpu'
      ) {
        console.log('[INFERNO] player won point, starting next Rival turn');
        set({ pendingInfernoDelay: false, turn: 'cpu' });
        cpuTurn();
        return;
      }

      if (!result.gameOver && after.turn === 'cpu') {
        set({ pendingInfernoDelay: false });
        cpuTurn();
      }
    },

    cpuTurn,

    beginTurnLock,
    endTurnLock,

    buildBanner: () => {
      const state = get();
      const baseMessage =
        state.mode === 'survival' ? state.survivalMessage : state.message;
      if (isMexican(state.lastClaim)) {
        return state.turn === 'player'
          ? `Infernoman claims 21 (Inferno${MEXICAN_ICON}). You must roll a real 21, 31, or 41 or bluff 21/31, otherwise call bluff.`
          : `You claimed 21 (Inferno${MEXICAN_ICON}). Infernoman must roll a real 21, 31, or 41 or bluff 21/31, otherwise call bluff.`;
      }
      return baseMessage;
    },

    setMessage: (msg: string) => setModeMessage(msg),
    getBaseMessage: () => {
      const state = get();
      return state.mode === 'survival' ? state.survivalMessage : state.message;
    },
  };
});
