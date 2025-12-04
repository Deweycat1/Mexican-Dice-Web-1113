import { useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettingsStore } from '../src/state/useSettingsStore';

export default function SettingsScreen() {
  const router = useRouter();
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
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Haptics</Text>
              <Text style={styles.settingHint}>Vibration feedback for rolls & events</Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={handleToggleHaptics}
              disabled={!hasHydrated}
              thumbColor={hapticsEnabled ? '#0FA958' : '#666'}
              trackColor={{ false: '#555', true: '#1FAD6F' }}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Sound</Text>
              <Text style={styles.settingHint}>Theme music & future sound effects</Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={handleToggleSound}
              disabled={!hasHydrated}
              thumbColor={soundEnabled ? '#0FA958' : '#666'}
              trackColor={{ false: '#555', true: '#1FAD6F' }}
            />
          </View>
        </View>

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B3A26',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    color: '#E6FFE6',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  settingHint: {
    color: '#B7D6C8',
    fontSize: 13,
    marginTop: 4,
    maxWidth: 220,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  backButton: {
    marginTop: 32,
    alignSelf: 'center',
    backgroundColor: '#C21807',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderWidth: 2,
    borderColor: '#8B0000',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
});
