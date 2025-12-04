import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const SETTINGS_KEY = 'suddendice.settings';

type SettingsSnapshot = {
  hapticsEnabled: boolean;
  soundEnabled: boolean;
};

type SettingsState = SettingsSnapshot & {
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  setHapticsEnabled: (value: boolean) => Promise<void>;
  setSoundEnabled: (value: boolean) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => {
  const persist = async (partial: Partial<SettingsSnapshot>) => {
    try {
      const next: SettingsSnapshot = {
        hapticsEnabled: partial.hapticsEnabled ?? get().hapticsEnabled,
        soundEnabled: partial.soundEnabled ?? get().soundEnabled,
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Ignore persistence failures; defaults will be used next launch
    }
  };

  return {
    hapticsEnabled: true,
    soundEnabled: true,
    hasHydrated: false,
    hydrate: async () => {
      if (get().hasHydrated) return;
      try {
        const stored = await AsyncStorage.getItem(SETTINGS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<SettingsSnapshot>;
          set((state) => ({
            ...state,
            hapticsEnabled:
              typeof parsed.hapticsEnabled === 'boolean' ? parsed.hapticsEnabled : state.hapticsEnabled,
            soundEnabled:
              typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : state.soundEnabled,
          }));
        }
      } catch {
        // Ignore hydration errors and fall back to defaults
      } finally {
        set({ hasHydrated: true });
      }
    },
    setHapticsEnabled: async (value: boolean) => {
      set({ hapticsEnabled: value });
      await persist({ hapticsEnabled: value });
    },
    setSoundEnabled: async (value: boolean) => {
      set({ soundEnabled: value });
      await persist({ soundEnabled: value });
    },
  };
});

useSettingsStore.getState().hydrate().catch(() => {
  // ignore startup hydration failures
});
