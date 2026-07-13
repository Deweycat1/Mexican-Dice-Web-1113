import { Audio, type AVPlaybackSource } from 'expo-av';

const INFERNO_SOURCES: AVPlaybackSource[] = [
  require('../../assets/audio/gamesound/inferno.wav'),
  require('../../assets/audio/gamesound/inferno2.wav'),
  require('../../assets/audio/gamesound/inferno3.wav'),
];
const WIN_SOURCE: AVPlaybackSource = require('../../assets/audio/gamesound/win.wav');
const LOSE_SOURCE: AVPlaybackSource = require('../../assets/audio/gamesound/lose.wav');
const BAD_BLUFF_CALL_SOURCE: AVPlaybackSource = require('../../assets/audio/gamesound/badbluffcall.wav');

const sounds = new Map<AVPlaybackSource, Audio.Sound>();
const loading = new Map<AVPlaybackSource, Promise<Audio.Sound>>();
let lastInfernoIndex = -1;

async function getSound(source: AVPlaybackSource) {
  const loaded = sounds.get(source);
  if (loaded) return loaded;
  let promise = loading.get(source);
  if (!promise) {
    promise = Audio.Sound.createAsync(source, { shouldPlay: false }).then(({ sound }) => {
      sounds.set(source, sound);
      loading.delete(source);
      return sound;
    });
    loading.set(source, promise);
  }
  return promise;
}

async function play(source: AVPlaybackSource, enabled: boolean, label: string) {
  if (!enabled) return;
  try {
    const sound = await getSound(source);
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (error) {
    console.warn(`Failed to play ${label} sound`, error);
  }
}

export function playInfernoSound(enabled: boolean) {
  let index = Math.floor(Math.random() * INFERNO_SOURCES.length);
  if (index === lastInfernoIndex) index = (index + 1) % INFERNO_SOURCES.length;
  lastInfernoIndex = index;
  return play(INFERNO_SOURCES[index], enabled, 'Inferno');
}

export function playGameResultSound(result: 'win' | 'lose', enabled: boolean) {
  return play(result === 'win' ? WIN_SOURCE : LOSE_SOURCE, enabled, result);
}

export function playBadBluffCallSound(enabled: boolean) {
  return play(BAD_BLUFF_CALL_SOURCE, enabled, 'incorrect bluff call');
}
