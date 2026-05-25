import { claimMatchesRoll } from '../engine/mexican';
import { supabase } from '../lib/supabase';

export type PlayerStatsMode = 'quick_play' | 'survival' | 'online';

export type SupabasePlayerStats = {
  userId: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  quickPlayGames: number;
  quickPlayWins: number;
  quickPlayLosses: number;
  onlineGames: number;
  onlineWins: number;
  onlineLosses: number;
  survivalRuns: number;
  survivalTotalStreak: number;
  survivalBest: number;
  averageSurvivalStreak: number;
  currentWinStreak: number;
  longestWinStreak: number;
  currentLossStreak: number;
  longestLossStreak: number;
  rollsTotal: number;
  claimsTotal: number;
  truthfulClaims: number;
  bluffClaims: number;
  honestyRate: number;
  bluffCallsTotal: number;
  bluffCallsCorrect: number;
  bluffCallAccuracy: number;
  favoriteRoll: string | null;
  favoriteRollCount: number;
  favoriteClaim: string | null;
  favoriteClaimCount: number;
  rolls21: number;
  rolls31: number;
  rolls41: number;
  claims21: number;
  claims31: number;
  claims41: number;
};

type PlayerStatsRow = {
  user_id: string;
  games_played: number;
  wins: number;
  losses: number;
  quick_play_games: number;
  quick_play_wins: number;
  quick_play_losses: number;
  online_games: number;
  online_wins: number;
  online_losses: number;
  survival_runs: number;
  survival_total_streak: number;
  survival_best: number;
  average_survival_streak: number | string;
  current_win_streak: number;
  longest_win_streak: number;
  current_loss_streak: number;
  longest_loss_streak: number;
  rolls_total: number;
  claims_total: number;
  truthful_claims: number;
  bluff_claims: number;
  honesty_rate: number | string;
  bluff_calls_total: number;
  bluff_calls_correct: number;
  bluff_call_accuracy: number | string;
  favorite_roll: string | null;
  favorite_roll_count: number;
  favorite_claim: string | null;
  favorite_claim_count: number;
  rolls_21: number;
  rolls_31: number;
  rolls_41: number;
  claims_21: number;
  claims_31: number;
  claims_41: number;
};

const isTestEnv = process.env.NODE_ENV === 'test';

const toDiceCode = (value: number | string | null | undefined) => {
  if (value === null || typeof value === 'undefined') return null;
  return String(value);
};

const toNumber = (value: number | string | null | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const hasAuthSession = async () => {
  const { data } = await supabase.auth.getSession();
  return !!data.session?.user;
};

const callStatsRpc = async (fn: string, args: Record<string, unknown>) => {
  if (isTestEnv) return;

  try {
    if (!(await hasAuthSession())) return;
    const { error } = await supabase.rpc(fn, args);
    if (error && __DEV__) {
      console.debug(`[player-stats] ${fn} failed`, error);
    }
  } catch (err) {
    if (__DEV__) {
      console.debug(`[player-stats] ${fn} exception`, err);
    }
  }
};

export const recordPlayerRoll = (params: { roll: number | string }) => {
  const roll = toDiceCode(params.roll);
  if (!roll) return;
  void callStatsRpc('record_player_roll', { p_roll: roll });
};

export const recordPlayerClaim = (params: {
  claim: number | string;
  actualRoll?: number | string | null;
  truthful?: boolean | null;
}) => {
  const claim = toDiceCode(params.claim);
  if (!claim) return;

  const actualRoll =
    typeof params.actualRoll === 'number'
      ? params.actualRoll
      : typeof params.actualRoll === 'string'
        ? Number(params.actualRoll)
        : null;
  const numericClaim = typeof params.claim === 'number' ? params.claim : Number(params.claim);
  const truthful =
    typeof params.truthful === 'boolean'
      ? params.truthful
      : Number.isFinite(numericClaim) && typeof actualRoll === 'number'
        ? claimMatchesRoll(numericClaim, actualRoll)
        : null;

  void callStatsRpc('record_player_claim', {
    p_claim: claim,
    p_truthful: truthful,
  });
};

export const recordPlayerBluffCall = (params: { correct: boolean }) => {
  void callStatsRpc('record_player_bluff_call', { p_correct: params.correct });
};

export const recordPlayerMatchResult = (params: {
  mode: Extract<PlayerStatsMode, 'quick_play' | 'online'>;
  won: boolean;
}) => {
  void callStatsRpc('record_player_match_result', {
    p_mode: params.mode,
    p_won: params.won,
  });
};

export const recordPlayerSurvivalRun = (params: { streak: number }) => {
  void callStatsRpc('record_player_survival_run', {
    p_streak: Math.max(0, Math.floor(params.streak)),
  });
};

const mapPlayerStatsRow = (row: PlayerStatsRow): SupabasePlayerStats => ({
  userId: row.user_id,
  gamesPlayed: row.games_played ?? 0,
  wins: row.wins ?? 0,
  losses: row.losses ?? 0,
  quickPlayGames: row.quick_play_games ?? 0,
  quickPlayWins: row.quick_play_wins ?? 0,
  quickPlayLosses: row.quick_play_losses ?? 0,
  onlineGames: row.online_games ?? 0,
  onlineWins: row.online_wins ?? 0,
  onlineLosses: row.online_losses ?? 0,
  survivalRuns: row.survival_runs ?? 0,
  survivalTotalStreak: row.survival_total_streak ?? 0,
  survivalBest: row.survival_best ?? 0,
  averageSurvivalStreak: toNumber(row.average_survival_streak),
  currentWinStreak: row.current_win_streak ?? 0,
  longestWinStreak: row.longest_win_streak ?? 0,
  currentLossStreak: row.current_loss_streak ?? 0,
  longestLossStreak: row.longest_loss_streak ?? 0,
  rollsTotal: row.rolls_total ?? 0,
  claimsTotal: row.claims_total ?? 0,
  truthfulClaims: row.truthful_claims ?? 0,
  bluffClaims: row.bluff_claims ?? 0,
  honestyRate: toNumber(row.honesty_rate),
  bluffCallsTotal: row.bluff_calls_total ?? 0,
  bluffCallsCorrect: row.bluff_calls_correct ?? 0,
  bluffCallAccuracy: toNumber(row.bluff_call_accuracy),
  favoriteRoll: row.favorite_roll ?? null,
  favoriteRollCount: row.favorite_roll_count ?? 0,
  favoriteClaim: row.favorite_claim ?? null,
  favoriteClaimCount: row.favorite_claim_count ?? 0,
  rolls21: row.rolls_21 ?? 0,
  rolls31: row.rolls_31 ?? 0,
  rolls41: row.rolls_41 ?? 0,
  claims21: row.claims_21 ?? 0,
  claims31: row.claims_31 ?? 0,
  claims41: row.claims_41 ?? 0,
});

export async function getMySupabasePlayerStats(): Promise<SupabasePlayerStats | null> {
  try {
    if (!(await hasAuthSession())) return null;
    const { data, error } = await supabase.rpc('get_my_player_stats');
    if (error) {
      console.error('get_my_player_stats error', error);
      return null;
    }

    const row = Array.isArray(data) ? (data[0] as PlayerStatsRow | undefined) : null;
    return row ? mapPlayerStatsRow(row) : null;
  } catch (err) {
    console.error('Failed to load Supabase player stats', err);
    return null;
  }
}
