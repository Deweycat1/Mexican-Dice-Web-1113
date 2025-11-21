const getFileSystem = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require('expo-file-system');
  } catch {
    return null;
  }
};

const FileSystem: any = getFileSystem();
const AI_STATE_FILENAME = 'ai_state.json';

const getStatePath = (): string | null => {
  if (!FileSystem || !FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}${AI_STATE_FILENAME}`;
};

export const loadAiState = async <T>(): Promise<T | null> => {
  try {
    const path = getStatePath();
    if (!path) return null;
    const info = await FileSystem.getInfoAsync(path);
    if (!info?.exists) return null;
    const data = await FileSystem.readAsStringAsync(path);
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
};

export const saveAiState = async (state: unknown) => {
  try {
    const path = getStatePath();
    if (!path) return;
    const payload = JSON.stringify(state);
    await FileSystem.writeAsStringAsync(path, payload);
  } catch {
    // swallow persistence errors; AI can continue learning in-memory
  }
};
