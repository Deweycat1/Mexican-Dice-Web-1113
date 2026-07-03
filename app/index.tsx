import { Link } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppText as Text } from '../src/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';

import MexicanDiceLogo from '../assets/images/mexican-dice-logo.png';
import MultiplayerButton from '../assets/images/multiplayer.png';
import QuickPlayButton from '../assets/images/QuickPlay.png';
import RankButton from '../assets/images/rank.png';
import RulesButton from '../assets/images/rules.png';
import { InfernoModeButton } from '../src/components/InfernoModeButton';
import { useSettingsStore } from '../src/state/useSettingsStore';
import { logEvent } from '../src/analytics/logEvent';

export default function HomeScreen() {
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const musicEnabled = useSettingsStore((state) => state.musicEnabled);
  const sfxEnabled = useSettingsStore((state) => state.sfxEnabled);
  const hasHydrated = useSettingsStore((state) => state.hasHydrated);
  const hydrate = useSettingsStore((state) => state.hydrate);
  const setHapticsEnabled = useSettingsStore((state) => state.setHapticsEnabled);
  const setMusicEnabled = useSettingsStore((state) => state.setMusicEnabled);
  const setSfxEnabled = useSettingsStore((state) => state.setSfxEnabled);

  useEffect(() => {
    if (!hasHydrated) {
      hydrate();
    }
  }, [hasHydrated, hydrate]);

  const handleToggleHaptics = useCallback(
    (value: boolean) => {
      void setHapticsEnabled(value);
    },
    [setHapticsEnabled]
  );

  const handleToggleMusic = useCallback(
    (value: boolean) => {
      void setMusicEnabled(value);
    },
    [setMusicEnabled]
  );

  const handleToggleSfx = useCallback(
    (value: boolean) => {
      void setSfxEnabled(value);
    },
    [setSfxEnabled]
  );

  const handleModeSelect = useCallback((mode: 'normal' | 'survival' | 'online') => {
    logEvent({ eventType: 'mode_selected', mode, metadata: { source: 'menu' } });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <View style={styles.menuSection}>
            <Image source={MexicanDiceLogo} style={styles.logo} />

            <View style={styles.buttonStack}>
              <Link href="/game" asChild>
                <Pressable style={styles.quickPlayWrapper} onPress={() => handleModeSelect('normal')}>
                  <Image source={QuickPlayButton} style={styles.quickPlayImage} resizeMode="contain" />
                </Pressable>
              </Link>

              <Link href="/survival" asChild>
                <InfernoModeButton onPress={() => handleModeSelect('survival')} />
              </Link>
              <Link href="/online" asChild>
                <Pressable
                  style={styles.imageButtonWrapper}
                  onPress={() => handleModeSelect('online')}
                  accessibilityLabel="Online Multiplayer"
                >
                  <Image source={MultiplayerButton} style={styles.menuButtonImage} resizeMode="stretch" />
                </Pressable>
              </Link>
              <Link href="/statistics" asChild>
                <Pressable style={styles.imageButtonWrapper} accessibilityLabel="Rank and Stats">
                  <Image source={RankButton} style={styles.menuButtonImage} resizeMode="stretch" />
                </Pressable>
              </Link>

              <Link href="/rules" asChild>
                <Pressable style={styles.imageButtonWrapper} accessibilityLabel="Rules">
                  <Image source={RulesButton} style={styles.menuButtonImage} resizeMode="stretch" />
                </Pressable>
              </Link>
            </View>
          </View>

          <View style={styles.simplePrefs}>
            <View style={styles.prefRow}>
              <Text style={styles.prefLabel}>Vibration</Text>
              <Switch
                value={hapticsEnabled}
                onValueChange={handleToggleHaptics}
                disabled={!hasHydrated}
                thumbColor={hapticsEnabled ? '#1C75BC' : '#FFCDD2'}
                trackColor={{ false: '#B00020', true: '#53A7F3' }}
              />
            </View>
            <View style={styles.prefRow}> 
              <Text style={styles.prefLabel}>Music</Text>
              <Switch
                value={musicEnabled}
                onValueChange={handleToggleMusic}
                disabled={!hasHydrated}
                thumbColor={musicEnabled ? '#1C75BC' : '#FFCDD2'}
                trackColor={{ false: '#B00020', true: '#53A7F3' }}
              />
            </View>
            <View style={styles.prefRow}>
              <Text style={styles.prefLabel}>Sound Effects</Text>
              <Switch
                value={sfxEnabled}
                onValueChange={handleToggleSfx}
                disabled={!hasHydrated}
                thumbColor={sfxEnabled ? '#1C75BC' : '#FFCDD2'}
                trackColor={{ false: '#B00020', true: '#53A7F3' }}
              />
            </View>

            <Link href="/privacy" style={styles.privacyButton}>
              <Text style={styles.privacyButtonText}>Privacy Policy</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1F262A',
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#1F262A',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  menuSection: {
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    width: 270,
    height: 270,
    resizeMode: 'contain',
    transform: [{ translateY: -35 }],
    marginBottom: -48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  buttonStack: {
    alignItems: 'center',
    gap: 8,
  },
  quickPlayWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  quickPlayImage: {
    width: 190,
    height: 46,
  },
  imageButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  menuButtonImage: {
    width: 190,
    height: 48,
  },
  infernoButton: {
    backgroundColor: '#FE9902',
    borderColor: '#B26B01',
  },
  infernoButtonText: {
    color: '#FF6A00',
  },
  buttonLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infernoIcon: {
    marginLeft: 6,
  },
  simplePrefs: {
    width: '100%',
    marginTop: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 260,
    maxWidth: '90%',
    paddingVertical: 6,
    marginVertical: 4,
  },
  prefLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  privacyButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#42C6FF',
  },
  privacyButtonText: {
    color: '#C9D1D9',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
