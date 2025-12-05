import { Audio } from 'expo-av';

let diceRollSound: Audio.Sound | null = null;
let loadingPromise: Promise<void> | null = null;

async function loadDiceRollSound() {
  if (diceRollSound) return;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const { sound } = await Audio.Sound.createAsync(require('../../assets/audio/diceroll.mp3'), {
        shouldPlay: false,
      });
      diceRollSound = sound;
    })();
  }
  await loadingPromise;
}

export async function playDiceRollSound(enabled: boolean) {
  if (!enabled) return;
  try {
    await loadDiceRollSound();
    if (!diceRollSound) return;
    await diceRollSound.setPositionAsync(0);
    await diceRollSound.playAsync();
  } catch (error) {
    console.warn('Failed to play dice roll sound', error);
  }
}

export async function unloadDiceRollSound() {
  try {
    if (diceRollSound) {
      await diceRollSound.unloadAsync();
      diceRollSound = null;
      loadingPromise = null;
    }
  } catch (error) {
    console.warn('Failed to unload dice roll sound', error);
  }
}
