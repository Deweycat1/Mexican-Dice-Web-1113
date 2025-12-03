import AsyncStorage from '@react-native-async-storage/async-storage';

import { generateRandomColorAnimalName } from '../lib/colorAnimalName';

const USER_DISPLAY_NAME_KEY = 'md_user_display_name_v1';

export async function getStoredUserDisplayName(): Promise<string | null> {
  const existing = await AsyncStorage.getItem(USER_DISPLAY_NAME_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }
  return null;
}

export async function setUserDisplayName(name: string) {
  if (!name) return;
  await AsyncStorage.setItem(USER_DISPLAY_NAME_KEY, name);
}

export async function getOrCreateUserDisplayName(): Promise<string> {
  const existing = await getStoredUserDisplayName();
  if (existing) {
    return existing;
  }
  const generated = generateRandomColorAnimalName();
  await setUserDisplayName(generated);
  return generated;
}
