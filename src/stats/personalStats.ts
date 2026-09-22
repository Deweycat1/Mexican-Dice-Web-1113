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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Local-calendar day key, "YYYY-MM-DD" (same format as the legacy UTC key). */
function toLocalDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a "YYYY-MM-DD" key as local midnight; null if malformed. */
function parseLocalDayKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function localMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export async function updatePersonalStatsOnGamePlayed(): Promise<PersonalStats> {
  const today = new Date();
  const todayStr = toLocalDayKey(today);

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
    const lastDate = lastActiveDate ? parseLocalDayKey(lastActiveDate) : null;
    if (lastDate) {
      // Both endpoints are local midnights; round (not floor) so a DST shift of
      // +/- 1h between them still counts as exactly one day.
      const diffMs = localMidnight(today).getTime() - lastDate.getTime();
      const diffDays = Math.round(diffMs / MS_PER_DAY);
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
