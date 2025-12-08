import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const SETTINGS_KEY = 'suddendice.settings';

const DEFAULT_SETTINGS = {
  hapticsEnabled: true,
  musicEnabled: false,
  sfxEnabled: false,
  hasSeenSurvivalIntro: false,
} as const;

type SettingsSnapshot = {
  hapticsEnabled: boolean;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  hasSeenSurvivalIntro: boolean;
};

type SettingsState = SettingsSnapshot & {
  hasSeenSurvivalIntro: boolean;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  setHapticsEnabled: (value: boolean) => Promise<void>;
  setMusicEnabled: (value: boolean) => Promise<void>;
  setSfxEnabled: (value: boolean) => Promise<void>;
  setHasSeenSurvivalIntro: (seen: boolean) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => {
  const persist = async (partial: Partial<SettingsSnapshot>) => {
    try {
      const next: SettingsSnapshot = {
        hapticsEnabled: partial.hapticsEnabled ?? get().hapticsEnabled ?? DEFAULT_SETTINGS.hapticsEnabled,
        musicEnabled: partial.musicEnabled ?? get().musicEnabled ?? DEFAULT_SETTINGS.musicEnabled,
        sfxEnabled: partial.sfxEnabled ?? get().sfxEnabled ?? DEFAULT_SETTINGS.sfxEnabled,
        hasSeenSurvivalIntro:
          partial.hasSeenSurvivalIntro ??
          get().hasSeenSurvivalIntro ??
          DEFAULT_SETTINGS.hasSeenSurvivalIntro,
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Ignore persistence failures; defaults will be used next launch
    }
  };

  return {
    ...DEFAULT_SETTINGS,
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
              typeof parsed.hapticsEnabled === 'boolean'
                ? parsed.hapticsEnabled
                : DEFAULT_SETTINGS.hapticsEnabled,
            musicEnabled:
              typeof parsed.musicEnabled === 'boolean'
                ? parsed.musicEnabled
                : DEFAULT_SETTINGS.musicEnabled,
            sfxEnabled:
              typeof parsed.sfxEnabled === 'boolean'
                ? parsed.sfxEnabled
                : DEFAULT_SETTINGS.sfxEnabled,
            hasSeenSurvivalIntro:
              typeof parsed.hasSeenSurvivalIntro === 'boolean'
                ? parsed.hasSeenSurvivalIntro
                : DEFAULT_SETTINGS.hasSeenSurvivalIntro,
          }));
        } else {
          set((state) => ({
            ...state,
            ...DEFAULT_SETTINGS,
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
    setHasSeenSurvivalIntro: async (seen: boolean) => {
      set({ hasSeenSurvivalIntro: seen });
      await persist({ hasSeenSurvivalIntro: seen });
    },
  };
});

useSettingsStore.getState().hydrate().catch(() => {
  // ignore startup hydration failures
});
