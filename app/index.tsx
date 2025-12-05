import React, { useCallback, useEffect } from 'react';
import { Link } from 'expo-router';
import { Image, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MexicanDiceLogo from '../assets/images/mexican-dice-logo.png';
import { useSettingsStore } from '../src/state/useSettingsStore';

export default function HomeScreen() {
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const soundEnabled = useSettingsStore((state) => state.soundEnabled);
  const hasHydrated = useSettingsStore((state) => state.hasHydrated);
  const hydrate = useSettingsStore((state) => state.hydrate);
  const setHapticsEnabled = useSettingsStore((state) => state.setHapticsEnabled);
  const setSoundEnabled = useSettingsStore((state) => state.setSoundEnabled);

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

  const handleToggleSound = useCallback(
    (value: boolean) => {
      void setSoundEnabled(value);
    },
    [setSoundEnabled]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <View style={styles.menuSection}>
            <Image source={MexicanDiceLogo} style={styles.logo} />

            <Link href="/game" style={styles.buttonRules}>
              <Text style={styles.buttonText}>Quick Play</Text>
            </Link>

            <Link href="/survival" style={styles.buttonStats}>
              <Text style={styles.buttonText}>Survival Mode</Text>
            </Link>
            <Link href="/online" style={styles.button}>
              <Text style={styles.buttonText}>Online Multiplayer</Text>
            </Link>
            <Link href="/statistics" style={styles.buttonStats}>
              <Text style={styles.buttonText}>Statistics</Text>
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
                thumbColor={hapticsEnabled ? '#ffffff' : '#FFCDD2'}
                trackColor={{ false: '#B00020', true: '#13C36B' }}
              />
            </View>
            <View style={styles.prefRow}> 
              <Text style={styles.prefLabel}>Sound</Text>
              <Switch
                value={soundEnabled}
                onValueChange={handleToggleSound}
                disabled={!hasHydrated}
                thumbColor={soundEnabled ? '#ffffff' : '#FFCDD2'}
                trackColor={{ false: '#B00020', true: '#13C36B' }}
              />
            </View>
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
    backgroundColor: '#D4AF37',
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
    borderColor: '#B8860B',
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
  buttonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700',
    textAlign: 'center',
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
});
