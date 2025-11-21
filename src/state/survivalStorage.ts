const getFileSystem = () => {
  try {
     
    return require('expo-file-system');
  } catch {
    return null;
  }
};

const FileSystem: any = getFileSystem();
const FILENAME = 'survival_best_streak.json';

const getPath = (): string | null => {
  if (!FileSystem || !FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}${FILENAME}`;
};

export const loadBestStreak = async (): Promise<number> => {
  try {
    const path = getPath();
    if (!path) {
      // web fallback
      const raw = (globalThis as any).localStorage?.getItem('survival_best_streak_v1');
      return raw ? Number(raw) || 0 : 0;
    }
    const info = await FileSystem.getInfoAsync(path);
    if (!info?.exists) return 0;
    const data = await FileSystem.readAsStringAsync(path);
    return Number(JSON.parse(data)) || 0;
  } catch {
    return 0;
  }
};

export const saveBestStreak = async (value: number) => {
  try {
    const path = getPath();
    if (!path) {
      (globalThis as any).localStorage?.setItem('survival_best_streak_v1', String(value));
      return;
    }
    const payload = JSON.stringify(value);
    await FileSystem.writeAsStringAsync(path, payload);
  } catch {
    // swallow
  }
};

export default {
  loadBestStreak,
  saveBestStreak,
};
