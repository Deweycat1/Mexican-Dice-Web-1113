import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const SETTINGS_KEY = 'suddendice.settings';

type SettingsSnapshot = {
  hapticsEnabled: boolean;
  musicEnabled: boolean;
  sfxEnabled: boolean;
};

type SettingsState = SettingsSnapshot & {
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  setHapticsEnabled: (value: boolean) => Promise<void>;
  setMusicEnabled: (value: boolean) => Promise<void>;
  setSfxEnabled: (value: boolean) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => {
  const persist = async (partial: Partial<SettingsSnapshot>) => {
    try {
      const next: SettingsSnapshot = {
        hapticsEnabled: partial.hapticsEnabled ?? get().hapticsEnabled,
        musicEnabled: partial.musicEnabled ?? get().musicEnabled,
        sfxEnabled: partial.sfxEnabled ?? get().sfxEnabled,
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Ignore persistence failures; defaults will be used next launch
    }
  };

  return {
    hapticsEnabled: true,
    musicEnabled: false,
    sfxEnabled: false,
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
            musicEnabled:
              typeof parsed.musicEnabled === 'boolean'
                ? parsed.musicEnabled
                : state.musicEnabled,
            sfxEnabled:
              typeof parsed.sfxEnabled === 'boolean'
                ? parsed.sfxEnabled
                : state.sfxEnabled,
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
    setMusicEnabled: async (value: boolean) => {
      set({ musicEnabled: value });
      await persist({ musicEnabled: value });
    },
    setSfxEnabled: async (value: boolean) => {
      set({ sfxEnabled: value });
      await persist({ sfxEnabled: value });
    },
  };
});

useSettingsStore.getState().hydrate().catch(() => {
  // ignore startup hydration failures
});
