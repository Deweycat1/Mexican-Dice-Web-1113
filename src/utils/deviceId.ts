// FILE: src/utils/deviceId.ts
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'device_id';
const DEVICE_COUNTED_KEY = 'unique_device_counted';

/**
 * Get FileSystem for native platforms
 */
const getFileSystem = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-file-system');
  } catch {
    return null;
  }
};

const FileSystem: any = getFileSystem();

/**
 * Generate a simple UUID v4
 * Cross-platform compatible without external dependencies
 */
function generateUUID(): string {
  // Use crypto.randomUUID() on web, fallback to manual generation on native
  if (Platform.OS === 'web' && typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Manual UUID v4 generation for native platforms
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get storage path for native platforms
 */
const getStoragePath = (key: string): string | null => {
  if (!FileSystem || !FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}${key}.txt`;
};

/**
 * Storage abstraction for cross-platform
 */
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    } else {
      // Native: use expo-file-system
      try {
        const path = getStoragePath(key);
        if (!path) return null;
        const info = await FileSystem.getInfoAsync(path);
        if (!info?.exists) return null;
        return await FileSystem.readAsStringAsync(path);
      } catch {
        return null;
      }
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Silently fail if localStorage is unavailable
      }
    } else {
      // Native: use expo-file-system
      try {
        const path = getStoragePath(key);
        if (!path) return;
        await FileSystem.writeAsStringAsync(path, value);
      } catch {
        // Silently fail if file system is unavailable
      }
    }
  },
};

/**
 * Get or create a unique device ID
 * Returns the device ID (creates one if it doesn't exist)
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    let deviceId = await storage.getItem(DEVICE_ID_KEY);
    
    if (!deviceId) {
      deviceId = generateUUID();
      await storage.setItem(DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.error('Error getting/creating device ID:', error);
    // Return a fallback ID if storage fails
    return 'fallback-' + Date.now();
  }
}

/**
 * Check if this device has already been counted
 */
export async function isDeviceCounted(): Promise<boolean> {
  try {
    const counted = await storage.getItem(DEVICE_COUNTED_KEY);
    return counted === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark this device as counted
 */
export async function markDeviceAsCounted(): Promise<void> {
  try {
    await storage.setItem(DEVICE_COUNTED_KEY, 'true');
  } catch (error) {
    console.error('Error marking device as counted:', error);
  }
}
