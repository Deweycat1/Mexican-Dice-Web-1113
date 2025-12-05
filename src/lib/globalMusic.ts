import { Audio } from 'expo-av';

let rollingMusic: Audio.Sound | null = null;
let isLoaded = false;
let isPlaying = false;

async function loadRollingMusic() {
  if (isLoaded) return;
  const { sound } = await Audio.Sound.createAsync(
    require('../../assets/audio/RollingDice.mp3'),
    { isLooping: true, shouldPlay: false }
  );
  rollingMusic = sound;
  isLoaded = true;
}

export async function startRollingMusic() {
  await loadRollingMusic();
  if (!rollingMusic) return;
  if (!isPlaying) {
    await rollingMusic.playAsync();
    isPlaying = true;
  }
}

export async function stopRollingMusic() {
  if (!rollingMusic) return;
  try {
    await rollingMusic.stopAsync();
  } catch (error) {
    console.warn('Failed to stop rolling music', error);
  }
  isPlaying = false;
}

export async function unloadRollingMusic() {
  if (!rollingMusic) return;
  await rollingMusic.unloadAsync();
  rollingMusic = null;
  isLoaded = false;
  isPlaying = false;
}
