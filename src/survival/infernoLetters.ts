import AsyncStorage from '@react-native-async-storage/async-storage';

export const INFERNO_SLOTS = [
  { id: 'I', char: 'I' },
  { id: 'N1', char: 'N' },
  { id: 'F', char: 'F' },
  { id: 'E', char: 'E' },
  { id: 'R', char: 'R' },
  { id: 'N2', char: 'N' },
  { id: 'O', char: 'O' },
] as const;

export type InfernoSlotId = (typeof INFERNO_SLOTS)[number]['id'];

const LETTERS_KEY_V1 = 'inferno_letters_v1';
const LETTERS_KEY_V2 = 'inferno_letters_v2';
const INTRO_SEEN_KEY = 'inferno_letters_intro_seen_v1';

const SLOT_ID_SET = new Set<InfernoSlotId>(INFERNO_SLOTS.map((slot) => slot.id));

function normalizeSlotId(value: unknown): InfernoSlotId | null {
  if (typeof value !== 'string') return null;
  return SLOT_ID_SET.has(value as InfernoSlotId) ? (value as InfernoSlotId) : null;
}

async function migrateV1ToV2(): Promise<Set<InfernoSlotId>> {
  try {
    const raw = await AsyncStorage.getItem(LETTERS_KEY_V1);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();

    const set = new Set<InfernoSlotId>();
    for (const value of parsed) {
      if (typeof value !== 'string') continue;
      if (value === 'N') {
        set.add('N1');
        continue;
      }
      if (SLOT_ID_SET.has(value as InfernoSlotId)) {
        set.add(value as InfernoSlotId);
      }
    }

    await AsyncStorage.setItem(LETTERS_KEY_V2, JSON.stringify(Array.from(set)));
    return set;
  } catch {
    return new Set();
  }
}

export async function loadCollectedLetters(): Promise<Set<InfernoSlotId>> {
  try {
    const raw = await AsyncStorage.getItem(LETTERS_KEY_V2);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const set = new Set<InfernoSlotId>();
        for (const value of parsed) {
          const slotId = normalizeSlotId(value);
          if (slotId) set.add(slotId);
        }
        return set;
      }
    }
    return await migrateV1ToV2();
  } catch {
    // Swallow storage errors; treat as no letters collected
    return new Set();
  }
}

export async function saveCollectedLetters(collected: Set<InfernoSlotId>): Promise<void> {
  try {
    const arr = Array.from(collected);
    await AsyncStorage.setItem(LETTERS_KEY_V2, JSON.stringify(arr));
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

export function getProgressCount(collected: Set<InfernoSlotId>): number {
  return collected.size;
}

export function isComplete(collected: Set<InfernoSlotId>): boolean {
  return collected.size === INFERNO_SLOTS.length;
}

export function pickMissingSlot(collected: Set<InfernoSlotId>): InfernoSlotId | null {
  const missing: InfernoSlotId[] = [];
  for (const slot of INFERNO_SLOTS) {
    if (!collected.has(slot.id)) {
      missing.push(slot.id);
    }
  }

  if (missing.length === 0) return null;
  if (missing.length === 1) return missing[0];

  const idx = Math.floor(Math.random() * missing.length);
  return missing[idx];
}
