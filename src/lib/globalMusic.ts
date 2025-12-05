import { Audio } from 'expo-av';

let rollingMusic: Audio.Sound | null = null;
let infernoMusic: Audio.Sound | null = null;
let rollingLoaded = false;
let rollingPlaying = false;
let infernoLoaded = false;
let infernoPlaying = false;

async function loadRollingMusic() {
  if (rollingLoaded) return;
  const { sound } = await Audio.Sound.createAsync(
    require('../../assets/audio/RollingDice.mp3'),
    { isLooping: true, shouldPlay: false }
  );
  rollingMusic = sound;
  rollingLoaded = true;
}

async function loadInfernoMusic() {
  if (infernoLoaded) return;
  const { sound } = await Audio.Sound.createAsync(
    require('../../assets/audio/InfernoDice.mp3'),
    { isLooping: true, shouldPlay: false }
  );
  infernoMusic = sound;
  infernoLoaded = true;
}

export async function startRollingMusic() {
  await loadRollingMusic();
  if (!rollingMusic) return;
  if (!rollingPlaying) {
    await rollingMusic.playAsync();
    rollingPlaying = true;
  }
}

export async function stopRollingMusic() {
  if (!rollingMusic) return;
  try {
    await rollingMusic.stopAsync();
  } catch (error) {
    console.warn('Failed to stop rolling music', error);
  }
  rollingPlaying = false;
}

export async function unloadRollingMusic() {
  if (!rollingMusic) return;
  await rollingMusic.unloadAsync();
  rollingMusic = null;
  rollingLoaded = false;
  rollingPlaying = false;
}

export async function startInfernoMusic() {
  await loadInfernoMusic();
  if (!infernoMusic) return;
  if (!infernoPlaying) {
    await infernoMusic.playAsync();
    infernoPlaying = true;
  }
}

export async function stopInfernoMusic() {
  if (!infernoMusic) return;
  try {
    await infernoMusic.stopAsync();
  } catch (error) {
    console.warn('Failed to stop inferno music', error);
  }
  infernoPlaying = false;
}

export async function unloadInfernoMusic() {
  if (!infernoMusic) return;
  await infernoMusic.unloadAsync();
  infernoMusic = null;
  infernoLoaded = false;
  infernoPlaying = false;
}
