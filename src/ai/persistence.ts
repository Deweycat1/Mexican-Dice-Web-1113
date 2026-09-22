import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage is available on iOS, Android and web, so the AI's learned state is
// persisted everywhere (the previous expo-file-system path silently skipped web).
const AI_STATE_KEY = 'md_ai_state_v1';

export const loadAiState = async <T>(): Promise<T | null> => {
  try {
    const data = await AsyncStorage.getItem(AI_STATE_KEY);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
};

export const saveAiState = async (state: unknown) => {
  try {
    const payload = JSON.stringify(state);
    await AsyncStorage.setItem(AI_STATE_KEY, payload);
  } catch {
    // swallow persistence errors; AI can continue learning in-memory
  }
};
