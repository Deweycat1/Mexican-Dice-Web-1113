import { supabase } from '../lib/supabase';
import { ensureUserProfile } from '../lib/auth';

export type PlayerRank = {
  userId: string;
  username: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  survivalBest: number;
  survivalRuns: number;
  bluffEvents: number;
  correctBluffEvents: number;
  infernoRating: number;
  percentile: number;
  lastMode: string | null;
  lastUpdatedAt: string;
  quickplayWins: number;
};

export type RankTier =
  | 'Ember'
  | 'Spark'
  | 'Flame'
  | 'Wildfire'
  | 'Inferno'
  | 'Hellstorm'
  | 'Demon Lord';

export function getRankTier(rating: number): RankTier {
  if (rating >= 2000) return 'Demon Lord';
  if (rating >= 1800) return 'Hellstorm';
  if (rating >= 1600) return 'Inferno';
  if (rating >= 1400) return 'Wildfire';
  if (rating >= 1200) return 'Flame';
  if (rating >= 1000) return 'Spark';
  return 'Ember';
}

type PlayerRankRow = {
  user_id: string;
  username: string;
  games_played: number;
  wins: number;
  losses: number;
  survival_best: number;
  survival_runs: number;
  bluff_events: number;
  correct_bluff_events: number;
  inferno_rating: number;
  percentile: number;
  last_mode: string | null;
  last_updated_at: string;
  quickplay_wins: number;
};

function mapRowToPlayerRank(row: PlayerRankRow): PlayerRank {
  return {
    userId: row.user_id,
    username: row.username,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses,
    survivalBest: row.survival_best,
    survivalRuns: row.survival_runs,
    bluffEvents: row.bluff_events,
    correctBluffEvents: row.correct_bluff_events,
    infernoRating: row.inferno_rating,
    percentile: row.percentile,
    lastMode: row.last_mode,
    lastUpdatedAt: row.last_updated_at,
    quickplayWins: row.quickplay_wins,
  };
}

export async function getMyRank(): Promise<PlayerRank | null> {
  try {
    const profile = await ensureUserProfile();
    const { data, error } = await supabase.rpc('get_player_rank', {
      p_user_id: profile.id,
    });

    if (error) {
      console.error('get_player_rank error', error);
      return null;
    }

    const row = Array.isArray(data) ? (data[0] as PlayerRankRow | undefined) : (data as PlayerRankRow | null);
    if (!row) {
      return null;
    }

    return mapRowToPlayerRank(row);
  } catch (err) {
    console.error('Failed to get player rank', err);
    return null;
  }
}

export async function getTop10Ranks(): Promise<PlayerRank[]> {
  try {
    const { data, error } = await supabase.rpc('get_top10_ranks');
    if (error) {
      console.error('get_top10_ranks error', error);
      return [];
    }

    if (!data || !Array.isArray(data)) {
      return [];
    }

    return (data as PlayerRankRow[]).map(mapRowToPlayerRank);
  } catch (err) {
    console.error('Failed to get top 10 ranks', err);
    return [];
  }
}

export async function getTopBluffersBySuccess(limit = 5): Promise<PlayerRank[]> {
  try {
    const { data, error } = await supabase.rpc('get_top_bluffers_by_success', {
      p_limit: limit,
    });

    if (error) {
      console.error('get_top_bluffers_by_success error', error);
      return [];
    }

    if (!data || !Array.isArray(data)) {
      return [];
    }

    return (data as PlayerRankRow[]).map(mapRowToPlayerRank);
  } catch (err) {
    console.error('Failed to get top bluffers by success', err);
    return [];
  }
}

export async function getTopSurvivalPlayers(
  limit = 5,
  minBest = 1
): Promise<PlayerRank[]> {
  try {
    const { data, error } = await supabase.rpc('get_top_survival_players', {
      p_limit: limit,
      p_min_best: minBest,
    });

    if (error) {
      console.error('get_top_survival_players error', error);
      return [];
    }

    if (!data || !Array.isArray(data)) {
      return [];
    }

    return (data as PlayerRankRow[]).map(mapRowToPlayerRank);
  } catch (err) {
    console.error('Failed to get top survival players', err);
    return [];
  }
}

export async function getGlobalSurvivalBest(minBest = 1): Promise<number> {
  const top = await getTopSurvivalPlayers(1, minBest);
  return top[0]?.survivalBest ?? 0;
}

export async function getTopQuickplayWins(
  limit = 5,
  minWins = 1
): Promise<PlayerRank[]> {
  try {
    const { data, error } = await supabase.rpc('get_top_quickplay_wins', {
      p_limit: limit,
      p_min_wins: minWins,
    });

    if (!error && data && Array.isArray(data) && data.length > 0) {
      return (data as PlayerRankRow[]).map(mapRowToPlayerRank);
    }

    if (error) {
      console.error('get_top_quickplay_wins error', error);
    }

    // Fallback: derive quick play wins leaderboard from general rank data
    const ranks = await getTop10Ranks();
    if (!ranks.length) {
      return [];
    }

    return ranks
      .filter((r) => (r.quickplayWins ?? 0) >= minWins)
      .sort((a, b) => (b.quickplayWins ?? 0) - (a.quickplayWins ?? 0))
      .slice(0, limit);
  } catch (err) {
    console.error('Failed to get top quick play wins', err);
    return [];
  }
}

export async function updateRankFromGameResult(opts: {
  mode: 'quick_play' | 'survival' | 'online';
  won?: boolean;
  survivalStreak?: number;
  bluffEvents?: number;
  correctBluffEvents?: number;
}): Promise<PlayerRank | null> {
  try {
    const profile = await ensureUserProfile();

    const { error } = await supabase.rpc('update_player_rank', {
      p_user_id: profile.id,
      p_mode: opts.mode,
      p_won: typeof opts.won === 'boolean' ? opts.won : null,
      p_survival_streak: opts.survivalStreak ?? 0,
      p_bluff_events: opts.bluffEvents ?? 0,
      p_correct_bluff_events: opts.correctBluffEvents ?? 0,
    });

    if (error) {
      console.error('update_player_rank error', error);
      return null;
    }

    // After updating on the server, fetch the fresh rank row
    try {
      return await getMyRank();
    } catch (err) {
      console.error('getMyRank after update failed', err);
      return null;
    }
  } catch (err) {
    console.error('Failed to update player rank from game result', err);
    return null;
  }
}
