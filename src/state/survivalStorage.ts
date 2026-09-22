import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Persists the player's best Inferno (survival) streak.
 *
 * AsyncStorage is used on every platform (it is backed by localStorage on web). The previous
 * implementation wrote a JSON file through the legacy expo-file-system API, which SDK 54 no longer
 * exports from the main module, so on native the best streak silently stopped being saved.
 */
const STORAGE_KEY = 'survival_best_streak_v1';
const LEGACY_FILENAME = 'survival_best_streak.json';
const LEGACY_MIGRATED_KEY = 'survival_best_streak_v1_migrated';

const toStreak = (raw: unknown): number => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/**
 * One-time read of the file older native builds wrote, so existing players keep their record.
 * Uses the legacy file-system entry point, which may not exist; every failure is treated as "no data".
 */
const readLegacyNativeFile = async (): Promise<number | null> => {
  if (Platform.OS === 'web') return null;
  try {
    const migrated = await AsyncStorage.getItem(LEGACY_MIGRATED_KEY);
    if (migrated) return null;
    await AsyncStorage.setItem(LEGACY_MIGRATED_KEY, '1');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const legacy: any = require('expo-file-system/legacy');
    const dir: string | null | undefined = legacy?.documentDirectory;
    if (!dir) return null;
    const path = `${dir}${LEGACY_FILENAME}`;
    const info = await legacy.getInfoAsync(path);
    if (!info?.exists) return null;
    const data = await legacy.readAsStringAsync(path);
    return toStreak(JSON.parse(data));
  } catch {
    return null;
  }
};

export const loadBestStreak = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw != null) {
      return toStreak(raw);
    }

    const legacyValue = await readLegacyNativeFile();
    if (legacyValue != null && legacyValue > 0) {
      await AsyncStorage.setItem(STORAGE_KEY, String(legacyValue));
      return legacyValue;
    }
    return 0;
  } catch {
    return 0;
  }
};

export const saveBestStreak = async (value: number) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(toStreak(value)));
  } catch {
    // swallow: losing a best-streak write must never break gameplay
  }
};

export default {
  loadBestStreak,
  saveBestStreak,
};
