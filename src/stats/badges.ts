import AsyncStorage from '@react-native-async-storage/async-storage';

export type BadgeId =
  | 'inferno_record_breaker'
  | 'inferno_streak_5'
  | 'inferno_streak_10'
  | 'first_survivor'
  | 'true_survivor_20'
  | 'inferno_immortal'
  | 'pure_honesty'
  | 'silent_strategist'
  | 'welcome_back_7_days'
  | 'inferno_week_7_day_streak'
  | 'bluff_catcher_5'
  | 'bluff_catcher_10'
  | 'bluff_catcher_20'
  | 'inferno_letter_collector';

export type BadgeState = {
  id: BadgeId;
  earned: boolean;
  earnedAt?: string; // ISO datetime
};

export type BadgesStore = {
  [id in BadgeId]?: BadgeState;
};

const BADGES_KEY = 'md_badges_v1';
const BLUFF_CAUGHT_KEY = 'md_bluff_caught_v1';

export async function loadBadges(): Promise<BadgesStore> {
  try {
    const raw = await AsyncStorage.getItem(BADGES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as BadgesStore;
  } catch (err) {
    console.error('Failed to load badges', err);
    return {};
  }
}

export async function saveBadges(next: BadgesStore): Promise<void> {
  try {
    await AsyncStorage.setItem(BADGES_KEY, JSON.stringify(next));
  } catch (err) {
    console.error('Failed to save badges', err);
  }
}

export async function hasBadge(id: BadgeId): Promise<boolean> {
  const store = await loadBadges();
  const entry = store[id];
  return !!entry && entry.earned === true;
}

async function loadBluffCaughtCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(BLUFF_CAUGHT_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

export async function incrementBluffCaught(): Promise<number> {
  const current = await loadBluffCaughtCount();
  const next = current + 1;
  try {
    await AsyncStorage.setItem(BLUFF_CAUGHT_KEY, String(next));
  } catch {
    // ignore persistence errors for bluff-caught counter
  }
  return next;
}

export async function awardBadge(id: BadgeId): Promise<BadgesStore> {
  try {
    const current = await loadBadges();
    const existing = current[id];
    if (existing && existing.earned) {
      return current;
    }

    const now = new Date().toISOString();
    const updated: BadgesStore = {
      ...current,
      [id]: {
        id,
        earned: true,
        earnedAt: now,
      },
    };

    await saveBadges(updated);
    return updated;
  } catch (err) {
    console.error('Failed to award badge', err);
    // On failure, return the last known state so callers can continue safely
    return loadBadges();
  }
}
