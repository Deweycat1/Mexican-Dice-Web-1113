import AsyncStorage from '@react-native-async-storage/async-storage';

export const INFERNO_LETTERS = ['I', 'N', 'F', 'E', 'R', 'N', 'O'] as const;

export type InfernoLetter = (typeof INFERNO_LETTERS)[number];

const LETTERS_KEY = 'inferno_letters_v1';
const INTRO_SEEN_KEY = 'inferno_letters_intro_seen_v1';

export async function loadCollectedLetters(): Promise<Set<InfernoLetter>> {
  try {
    const raw = await AsyncStorage.getItem(LETTERS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();

    const set = new Set<InfernoLetter>();
    for (const value of parsed) {
      if (typeof value === 'string' && (INFERNO_LETTERS as readonly string[]).includes(value)) {
        set.add(value as InfernoLetter);
      }
    }
    return set;
  } catch {
    // Swallow storage errors; treat as no letters collected
    return new Set();
  }
}

export async function saveCollectedLetters(collected: Set<InfernoLetter>): Promise<void> {
  try {
    const arr = Array.from(collected);
    await AsyncStorage.setItem(LETTERS_KEY, JSON.stringify(arr));
  } catch {
    // Swallow storage errors
  }
}

export async function hasSeenInfernoLettersIntro(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(INTRO_SEEN_KEY);
    return raw === '1';
  } catch {
    return false;
  }
}

export async function setSeenInfernoLettersIntro(): Promise<void> {
  try {
    await AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // Swallow storage errors
  }
}

export function getProgressCount(collected: Set<InfernoLetter>): number {
  // Progress counts each letter slot in "INFERNO", so the repeated
  // "N" contributes two slots once "N" is collected.
  let count = 0;
  for (const letter of INFERNO_LETTERS) {
    if (collected.has(letter)) {
      count += 1;
    }
  }
  return count;
}

export function isComplete(collected: Set<InfernoLetter>): boolean {
  return getProgressCount(collected) >= INFERNO_LETTERS.length;
}

export function pickMissingLetter(collected: Set<InfernoLetter>): InfernoLetter | null {
  // Build a list of missing unique letters (so the repeated "N"
  // is treated as a single letter type for selection).
  const missing: InfernoLetter[] = [];
  for (const letter of INFERNO_LETTERS) {
    if (!collected.has(letter) && !missing.includes(letter)) {
      missing.push(letter);
    }
  }

  if (missing.length === 0) return null;
  if (missing.length === 1) return missing[0];

  const idx = Math.floor(Math.random() * missing.length);
  return missing[idx];
}

