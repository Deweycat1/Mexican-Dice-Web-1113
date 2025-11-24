import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useBackgroundMusic } from '../src/hooks/useBackgroundMusic';
import RulesContent from '../src/components/RulesContent';

// IMPORTANT: add the audio asset at assets/audio/mexican-dice-game.mp3
const music = require('../assets/audio/mexican-dice-game.mp3');

export default function RulesScreen() {
  const router = useRouter();
  const {
    isLoaded,
    isPlaying,
    play,
    pause,
  } = useBackgroundMusic({
    source: music,
    startPaused: true,
    loop: true,
    initialVolume: 0.4,
    storageKey: 'rules_sound_allowed',
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mexican Dice...Rules!</Text>

      <View style={styles.musicSection}>
        <View style={styles.musicControlsRow}>
          <Text style={styles.statusLabel}>Theme Song:</Text>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={play}
              disabled={!isLoaded}
              style={({ pressed }) =>
                StyleSheet.flatten([
                  styles.button,
                  isPlaying ? styles.playingButton : styles.playButton,
                  pressed && styles.buttonPressed,
                  !isLoaded && styles.buttonDisabled,
                ])
              }
            >
              <Text style={styles.buttonText}>{isPlaying ? 'Playing' : 'Play'}</Text>
            </Pressable>
            <Pressable
              onPress={pause}
              disabled={!isLoaded}
              style={({ pressed }) =>
                StyleSheet.flatten([
                  styles.button,
                  styles.mutedButton,
                  pressed && styles.buttonPressed,
                  !isLoaded && styles.buttonDisabled,
                ])
              }
            >
              <Text style={styles.buttonText}>{isPlaying ? 'Pause/Mute' : 'Muted'}</Text>
            </Pressable>
          </View>
        </View>

        {Platform.OS === 'web' && !isPlaying && (
          <Text style={styles.helperNote}>Tap “Play” once to enable audio in your browser.</Text>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.rulesCard}>
          <RulesContent />
        </View>
      </ScrollView>


      <View
        style={{
          marginTop: 'auto',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 24,
        }}
      >
        <Pressable
          onPress={() => router.push('/game')}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#0a472a' : '#105c35',
            borderWidth: 3,
            borderColor: '#e0b50c',
            paddingVertical: 14,
            paddingHorizontal: 30,
            borderRadius: 999,
            shadowColor: '#e0b50c',
            shadowOpacity: pressed ? 0.4 : 0.7,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text
            style={{
              color: '#fff',
              fontWeight: '900',
              fontSize: 20,
              letterSpacing: 0.5,
              textShadowColor: '#000',
              textShadowRadius: 3,
              textAlign: 'center',
            }}
          >
            Get it now?!
            {'\n'}
            Start Playing!!!
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B3A26',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginTop: 35,
    marginBottom: 18,
  },
  musicSection: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  musicControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    flexWrap: 'wrap',
  },
  statusLabel: {
    color: '#E6FFE6',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  button: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginHorizontal: 6,
  },
  playButton: {
    backgroundColor: '#0d6efd',
  },
  playingButton: {
    backgroundColor: '#198754',
  },
  mutedButton: {
    backgroundColor: '#6c757d',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  helperNote: {
    marginTop: 6,
    fontSize: 12,
    color: '#C9F0D6',
  },
  rulesCard: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 18,
    padding: 18,
    rowGap: 12,
  },
});
