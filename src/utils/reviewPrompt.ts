import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

export type ReviewPromptState = {
  attempts: number;
  completed: boolean;
  firstWinTriggered: boolean;
  streak10Triggered: boolean;
  lastAttemptAt?: number;
};

const STORAGE_KEY = 'infernodice.reviewPromptState.v1';
const MAX_ATTEMPTS = 3;
const DEFAULT_STATE: ReviewPromptState = {
  attempts: 0,
  completed: false,
  firstWinTriggered: false,
  streak10Triggered: false,
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function getReviewPromptState(): Promise<ReviewPromptState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<ReviewPromptState>;
    return {
      ...DEFAULT_STATE,
      attempts: typeof parsed.attempts === 'number' ? parsed.attempts : 0,
      completed: Boolean(parsed.completed),
      firstWinTriggered: Boolean(parsed.firstWinTriggered),
      streak10Triggered: Boolean(parsed.streak10Triggered),
      lastAttemptAt: typeof parsed.lastAttemptAt === 'number' ? parsed.lastAttemptAt : undefined,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function setReviewPromptState(next: ReviewPromptState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures; we best-effort prompt.
  }
}

export async function requestReviewIfEligible(
  reason: 'first_win_game' | 'streak_10_survival'
): Promise<void> {
  const state = await getReviewPromptState();
  if (state.completed) return;
  if (state.attempts >= MAX_ATTEMPTS) {
    await setReviewPromptState({ ...state, completed: true });
    return;
  }

  if (reason === 'first_win_game' && state.firstWinTriggered) return;
  if (reason === 'streak_10_survival' && state.streak10Triggered) return;

  const updatedState: ReviewPromptState = {
    ...state,
    firstWinTriggered: reason === 'first_win_game' ? true : state.firstWinTriggered,
    streak10Triggered: reason === 'streak_10_survival' ? true : state.streak10Triggered,
  };

  if (Platform.OS === 'web') {
    await setReviewPromptState(updatedState);
    return;
  }

  if (AppState.currentState !== 'active') {
    await setReviewPromptState(updatedState);
    return;
  }

  let available = false;
  try {
    available = await StoreReview.isAvailableAsync();
  } catch {
    available = false;
  }

  if (!available) {
    await setReviewPromptState(updatedState);
    return;
  }

  await delay(300);
  if (AppState.currentState !== 'active') {
    await setReviewPromptState(updatedState);
    return;
  }

  try {
    await StoreReview.requestReview();
  } catch {
    // Ignore request failures; attempts still count.
  }

  const nextAttempts = updatedState.attempts + 1;
  const nextState: ReviewPromptState = {
    ...updatedState,
    attempts: nextAttempts,
    lastAttemptAt: Date.now(),
    completed: nextAttempts >= MAX_ATTEMPTS,
  };

  if (__DEV__) {
    console.log('[reviewPrompt] request attempt', { reason, attempts: nextAttempts });
  }

  await setReviewPromptState(nextState);
}
