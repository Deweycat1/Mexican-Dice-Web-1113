// FILE: src/utils/deviceId.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'device_id';

/**
 * Generate a simple UUID v4
 * Cross-platform compatible without external dependencies
 */
function generateUUID(): string {
  const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : null;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Storage abstraction for cross-platform.
 * Web uses localStorage; native uses AsyncStorage (the legacy expo-file-system API this
 * used to rely on is no longer exported in SDK 54, which meant the id was never persisted).
 */
const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      }
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
        return;
      }
      await AsyncStorage.setItem(key, value);
    } catch {
      // Silently fail if storage is unavailable
    }
  },
};

let cachedDeviceId: string | null = null;
let inFlight: Promise<string> | null = null;

/**
 * Get or create a unique device ID
 * Returns the device ID (creates one if it doesn't exist)
 */
export async function getOrCreateDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      let deviceId = await storage.getItem(DEVICE_ID_KEY);

      if (!deviceId) {
        deviceId = generateUUID();
        await storage.setItem(DEVICE_ID_KEY, deviceId);
      }

      cachedDeviceId = deviceId;
      return deviceId;
    } catch (error) {
      console.error('Error getting/creating device ID:', error);
      // Return a fallback ID if storage fails (not cached so we retry next time)
      return 'fallback-' + Date.now();
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
