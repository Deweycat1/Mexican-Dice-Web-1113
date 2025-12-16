import AsyncStorage from '@react-native-async-storage/async-storage';

const PERSONAL_STATS_KEY = 'md_personal_stats_v1';
const PERSONAL_ROLL_COUNTS_KEY = 'md_personal_roll_counts_v1';
const PERSONAL_SUCCESSFUL_BLUFFS_KEY = 'md_successful_bluffs_v1';

export type PersonalStats = {
  totalGamesPlayed: number;
  lastActiveDate: string | null;
  currentDailyStreak: number;
  longestDailyStreak: number;
  totalDaysPlayed: number;
  successfulBluffsLifetime: number;
  mostCommonRollLifetime: string | null;
  successfulBluffCallsLifetime?: number;
};

const defaultStats: PersonalStats = {
  totalGamesPlayed: 0,
  lastActiveDate: null,
  currentDailyStreak: 0,
  longestDailyStreak: 0,
  totalDaysPlayed: 0,
  successfulBluffsLifetime: 0,
  mostCommonRollLifetime: null,
};

type PersonalRollCounts = Record<string, number>;

async function loadPersonalRollCounts(): Promise<PersonalRollCounts> {
  try {
    const raw = await AsyncStorage.getItem(PERSONAL_ROLL_COUNTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as PersonalRollCounts;
  } catch {
    return {};
  }
}

export async function incrementPersonalRollCount(
  roll: number | string
): Promise<PersonalRollCounts> {
  const key = String(roll);
  const current = await loadPersonalRollCounts();
  const next: PersonalRollCounts = {
    ...current,
    [key]: (current[key] ?? 0) + 1,
  };
  try {
    await AsyncStorage.setItem(PERSONAL_ROLL_COUNTS_KEY, JSON.stringify(next));
  } catch {
    // ignore persistence errors for personal roll counts
  }
  return next;
}

function getMostCommonRollFromCounts(counts: PersonalRollCounts): string | null {
  let bestKey: string | null = null;
  let bestCount = -1;
  for (const [key, value] of Object.entries(counts)) {
    if (typeof value === 'number' && value > bestCount) {
      bestKey = key;
      bestCount = value;
    }
  }
  return bestKey;
}

async function loadSuccessfulBluffs(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(PERSONAL_SUCCESSFUL_BLUFFS_KEY);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

export async function incrementSuccessfulBluffs(): Promise<number> {
  const current = await loadSuccessfulBluffs();
  const next = current + 1;
  try {
    await AsyncStorage.setItem(PERSONAL_SUCCESSFUL_BLUFFS_KEY, String(next));
  } catch {
    // ignore persistence errors for successful bluff counter
  }
  return next;
}

export async function getPersonalStats(): Promise<PersonalStats> {
  let base = { ...defaultStats };
  try {
    const raw = await AsyncStorage.getItem(PERSONAL_STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      base = {
        ...base,
        totalGamesPlayed: parsed.totalGamesPlayed ?? 0,
        lastActiveDate: parsed.lastActiveDate ?? null,
        currentDailyStreak: parsed.currentDailyStreak ?? 0,
        longestDailyStreak: parsed.longestDailyStreak ?? 0,
        totalDaysPlayed: parsed.totalDaysPlayed ?? 0,
      };
    }
  } catch {
    base = { ...defaultStats };
  }

  const [successfulBluffsLifetime, rollCounts] = await Promise.all([
    loadSuccessfulBluffs(),
    loadPersonalRollCounts(),
  ]);
  const mostCommonRollLifetime = getMostCommonRollFromCounts(rollCounts);

  return {
    ...base,
    successfulBluffsLifetime,
    mostCommonRollLifetime,
  };
}

export async function updatePersonalStatsOnGamePlayed(): Promise<PersonalStats> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const current = await getPersonalStats();
  let {
    totalGamesPlayed,
    lastActiveDate,
    currentDailyStreak,
    longestDailyStreak,
    totalDaysPlayed,
  } = current;

  totalGamesPlayed += 1;

  if (lastActiveDate !== todayStr) {
    const lastDate = lastActiveDate ? new Date(lastActiveDate) : null;
    if (lastDate) {
      const diffMs = today.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentDailyStreak += 1;
      } else {
        currentDailyStreak = 1;
      }
    } else {
      currentDailyStreak = 1;
    }

    totalDaysPlayed += 1;
    lastActiveDate = todayStr;
  }

  if (currentDailyStreak > longestDailyStreak) {
    longestDailyStreak = currentDailyStreak;
  }

  const updated = {
    totalGamesPlayed,
    lastActiveDate,
    currentDailyStreak,
    longestDailyStreak,
    totalDaysPlayed,
  };

  await AsyncStorage.setItem(PERSONAL_STATS_KEY, JSON.stringify(updated));
  // Re-read full personal stats so callers also receive derived lifetime fields.
  return getPersonalStats();
}
