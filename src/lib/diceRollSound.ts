import { Audio, type AVPlaybackSource } from 'expo-av';

const ROLL_SOURCES: AVPlaybackSource[] = [
  require('../../assets/audio/gamesound/roll1.wav'),
  require('../../assets/audio/gamesound/roll2.wav'),
  require('../../assets/audio/gamesound/roll3.wav'),
  require('../../assets/audio/gamesound/roll4.wav'),
];

let diceRollSounds: Audio.Sound[] | null = null;
let loadingPromise: Promise<void> | null = null;
let lastRollIndex = -1;

async function loadDiceRollSounds() {
  if (diceRollSounds) return;
  if (!loadingPromise) {
    loadingPromise = Promise.all(
      ROLL_SOURCES.map((source) => Audio.Sound.createAsync(source, { shouldPlay: false }))
    ).then((results) => {
      diceRollSounds = results.map(({ sound }) => sound);
    });
  }
  await loadingPromise;
}

function pickRollIndex() {
  let index = Math.floor(Math.random() * ROLL_SOURCES.length);
  if (index === lastRollIndex) index = (index + 1) % ROLL_SOURCES.length;
  lastRollIndex = index;
  return index;
}

export async function playDiceRollSound(enabled: boolean) {
  if (!enabled) return;
  try {
    await loadDiceRollSounds();
    const sound = diceRollSounds?.[pickRollIndex()];
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (error) {
    console.warn('Failed to play dice roll sound', error);
  }
}

export async function unloadDiceRollSound() {
  try {
    await Promise.all((diceRollSounds ?? []).map((sound) => sound.unloadAsync()));
    diceRollSounds = null;
    loadingPromise = null;
    lastRollIndex = -1;
  } catch (error) {
    console.warn('Failed to unload dice roll sounds', error);
  }
}
