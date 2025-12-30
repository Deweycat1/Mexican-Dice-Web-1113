import { Link } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MexicanDiceLogo from '../assets/images/mexican-dice-logo.png';
import QuickPlayButton from '../assets/images/QuickPlay.png';
import { InfernoModeButton } from '../src/components/InfernoModeButton';
import { useSettingsStore } from '../src/state/useSettingsStore';

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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <View style={styles.menuSection}>
            <Image source={MexicanDiceLogo} style={styles.logo} />

            <Link href="/game" asChild>
              <Pressable style={styles.quickPlayWrapper}>
                <Image source={QuickPlayButton} style={styles.quickPlayImage} resizeMode="contain" />
              </Pressable>
            </Link>

            <Link href="/survival" asChild>
              <InfernoModeButton />
            </Link>
            <Link href="/online" style={styles.button}>
              <Text style={styles.buttonText}>Online Multiplayer</Text>
            </Link>
            <Link href="/statistics" style={styles.buttonStats}>
              <Text style={styles.buttonText}>Rank and Stats</Text>
            </Link>

            <Link href="/rules" style={styles.buttonRules}>
              <Text style={styles.buttonText}>Rules</Text>
            </Link>
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
    width: 160,
    height: 160,
    resizeMode: 'contain',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  button: { 
    backgroundColor: '#C21807',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    // @ts-ignore - boxShadow is web-only
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.4)',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: '#8B0000',
  },
  buttonStats: { 
    backgroundColor: '#FE9902',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    // @ts-ignore - boxShadow is web-only
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.4)',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: '#B26B01',
  },
  buttonRules: { 
    backgroundColor: '#42C6FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    // @ts-ignore - boxShadow is web-only
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.4)',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: '#1E8AC4',
  },
  quickPlayWrapper: {
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  quickPlayImage: {
    width: 190,
    height: 46,
  },
  infernoButton: {
    backgroundColor: '#FE9902',
    borderColor: '#B26B01',
  },
  infernoButtonText: {
    color: '#FF6A00',
  },
  buttonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700',
    textAlign: 'center',
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
