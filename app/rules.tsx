import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useBackgroundMusic } from '../src/hooks/useBackgroundMusic';

// IMPORTANT: add the audio asset at assets/audio/mexican-dice-game.mp3
const music = require('../assets/audio/mexican-dice-game.mp3');

export default function RulesScreen() {
  const router = useRouter();
  const {
    isLoaded,
    isPlaying,
    isMuted,
    volume,
    toggle,
    mute,
    unmute,
    setVolume,
  } = useBackgroundMusic({
    source: music,
    startPaused: true,
    loop: true,
    initialVolume: 0.4,
    storageKey: 'rules_sound_allowed',
  });

  const volumePercent = Math.round(volume * 100);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mexican Dice — Rules</Text>

      <View style={styles.musicSection}>
        <Text style={styles.statusLabel}>
          {isLoaded ? (isPlaying ? 'Music: Playing' : 'Music: Paused') : 'Loading music...'}
        </Text>

        <View style={styles.buttonRow}>
          <Pressable
            onPress={toggle}
            style={({ pressed }) =>
              StyleSheet.flatten([
                styles.button,
                isPlaying ? styles.playingButton : styles.playButton,
                pressed && styles.buttonPressed,
              ])
            }
          >
            <Text style={styles.buttonText}>{isPlaying ? 'Pause' : 'Play'}</Text>
          </Pressable>
          <Pressable
            onPress={isMuted ? unmute : mute}
            style={({ pressed }) =>
              StyleSheet.flatten([styles.button, styles.mutedButton, pressed && styles.buttonPressed])
            }
          >
            <Text style={styles.buttonText}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </Pressable>
        </View>

        <View className="volumeRow" style={styles.volumeRow}>
          <Pressable
            onPress={() => setVolume(Math.max(0, volume - 0.1))}
            style={({ pressed }) => StyleSheet.flatten([styles.volumeButton, pressed && styles.buttonPressed])}
          >
            <Text style={styles.buttonText}>– Vol</Text>
          </Pressable>
          <Text style={styles.volumeLabel}>Vol: {volumePercent}%</Text>
          <Pressable
            onPress={() => setVolume(Math.min(1, volume + 0.1))}
            style={({ pressed }) => StyleSheet.flatten([styles.volumeButton, pressed && styles.buttonPressed])}
          >
            <Text style={styles.buttonText}>+ Vol</Text>
          </Pressable>
        </View>

        {Platform.OS === 'web' && !isPlaying && (
          <Text style={styles.helperNote}>Tap “Play” once to enable audio in your browser.</Text>
        )}
      </View>

           <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
  <View style={styles.rulesCard}>

        
        <Text style={[styles.body, { fontWeight: '700', fontSize: 17 }]}>
          General Gameplay
        </Text>
        <Text style={styles.body}>
          Roll two dice and read them higher-first (3 and 5 → 53). Doubles beat mixed rolls, and Special Rolls beat everything.
          After you roll, claim a number to the next player — truth or bluff. You may claim any roll that matches
          or beats the last claim, or a Special Roll (21 or 31 - you cannot lie about a 41).
        </Text>

        <Text style={[styles.body, { fontWeight: '700', fontSize: 17, marginTop: 10 }]}>
          Special Rolls
        </Text>

        <Text style={styles.body}>
          <Image source={require('../assets/images/mexican-dice-logo.png')} style={{ width: 18, height: 18, marginBottom: -2 }} /> 21 &ldquo;Mexican&rdquo;: Claiming a Mexican makes the round worth 2 points. The next player must either accept
          the challenge and roll for a real 21, or Call Bluff. Whoever is wrong — caller or claimer — loses 2 points.
          Reverses do not reduce the penalty.
        </Text>

        <Text style={styles.body}>
          🔄 31 “Reverse”: Sends the challenge back so the previous player must now match or beat the reflected roll. Reverse can
          always be claimed (truth or bluff). If a Mexican is reversed onto someone, the 2-point penalty still applies.
        </Text>

        <Text style={styles.body}>
          🍺 41 “Social”: Must be shown, never bluffed. When rolled, the round resets — all claims clear, no points
          are lost, and the dice pass to the next player.
        </Text>

        <Text style={[styles.body, { fontWeight: '700', fontSize: 17, marginTop: 10 }]}>
          Bluffs
        </Text>
        <Text style={styles.body}>
          If a bluff is suspected, the player can Call Bluff rather than accepting the roll. In normal rounds, if the claim was truthful, the caller loses 1 point;
          if it was a bluff, the liar loses 1 point. In Mexican <Image source={require('../assets/images/mexican-dice-logo.png')} style={{ width: 18, height: 18, marginBottom: -2 }} /> rounds, the loser always loses 2 points. Everyone starts with 5 points; hit 0 and you&apos;re out.
        </Text>

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
  statusLabel: {
    color: '#E6FFE6',
    fontSize: 14,
    marginBottom: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
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
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  volumeButton: {
    backgroundColor: '#343a40',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  volumeLabel: {
    color: '#E6FFE6',
    fontWeight: '600',
    minWidth: 90,
    textAlign: 'center',
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
  body: {
    fontSize: 15,
    color: '#E6FFE6',
    lineHeight: 22,
  },
});
