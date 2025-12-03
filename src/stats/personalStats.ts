import AsyncStorage from '@react-native-async-storage/async-storage';

const PERSONAL_STATS_KEY = 'md_personal_stats_v1';

export type PersonalStats = {
  totalGamesPlayed: number;
  lastActiveDate: string | null;
  currentDailyStreak: number;
  longestDailyStreak: number;
  totalDaysPlayed: number;
};

const defaultStats: PersonalStats = {
  totalGamesPlayed: 0,
  lastActiveDate: null,
  currentDailyStreak: 0,
  longestDailyStreak: 0,
  totalDaysPlayed: 0,
};

export async function getPersonalStats(): Promise<PersonalStats> {
  const raw = await AsyncStorage.getItem(PERSONAL_STATS_KEY);
  if (!raw) {
    return { ...defaultStats };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      totalGamesPlayed: parsed.totalGamesPlayed ?? 0,
      lastActiveDate: parsed.lastActiveDate ?? null,
      currentDailyStreak: parsed.currentDailyStreak ?? 0,
      longestDailyStreak: parsed.longestDailyStreak ?? 0,
      totalDaysPlayed: parsed.totalDaysPlayed ?? 0,
    };
  } catch {
    return { ...defaultStats };
  }
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

  const updated: PersonalStats = {
    totalGamesPlayed,
    lastActiveDate,
    currentDailyStreak,
    longestDailyStreak,
    totalDaysPlayed,
  };

  await AsyncStorage.setItem(PERSONAL_STATS_KEY, JSON.stringify(updated));
  return updated;
}

