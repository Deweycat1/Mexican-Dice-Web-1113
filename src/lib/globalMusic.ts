import { Audio, type AVPlaybackSource } from 'expo-av';

let audioModePromise: Promise<void> | null = null;

/**
 * Configure the shared audio session once, lazily, before the first Sound is
 * created anywhere in the app. Safe to call repeatedly; concurrent callers share
 * the same promise. Never rejects (a failure is logged and treated as done so
 * playback can still be attempted).
 */
export function ensureAudioMode(): Promise<void> {
  if (!audioModePromise) {
    audioModePromise = Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    })
      .then(() => undefined)
      .catch((error) => {
        console.warn('Failed to configure audio mode', error);
      });
  }
  return audioModePromise;
}

type LoopTrack = {
  label: string;
  source: AVPlaybackSource;
  sound: Audio.Sound | null;
  /** In-flight createAsync; shared so concurrent starts never create two Sounds. */
  loading: Promise<Audio.Sound> | null;
  /** Whether the most recent start/stop call asked for playback. */
  wanted: boolean;
  playing: boolean;
};

const rolling: LoopTrack = {
  label: 'rolling',
  source: require('../../assets/audio/infernodice.wav'),
  sound: null,
  loading: null,
  wanted: false,
  playing: false,
};

const inferno: LoopTrack = {
  label: 'inferno',
  source: require('../../assets/audio/infernomania.wav'),
  sound: null,
  loading: null,
  wanted: false,
  playing: false,
};

/** Resolve the track's Sound, awaiting any in-flight load. Returns null on failure. */
async function loadTrack(track: LoopTrack): Promise<Audio.Sound | null> {
  if (track.sound) return track.sound;
  if (!track.loading) {
    track.loading = (async () => {
      await ensureAudioMode();
      const { sound } = await Audio.Sound.createAsync(track.source, {
        isLooping: true,
        shouldPlay: false,
      });
      track.sound = sound;
      return sound;
    })().finally(() => {
      track.loading = null;
    });
  }
  try {
    return await track.loading;
  } catch (error) {
    console.warn(`Failed to load ${track.label} music`, error);
    return null;
  }
}

async function startTrack(track: LoopTrack) {
  track.wanted = true;
  const sound = await loadTrack(track);
  // A stop/unload may have arrived while we were loading; honour the latest request.
  if (!sound || !track.wanted || track.playing || track.sound !== sound) return;
  try {
    await sound.playAsync();
    track.playing = true;
  } catch (error) {
    // Web autoplay policies reject play() until the user interacts; not fatal.
    console.warn(`Failed to play ${track.label} music`, error);
  }
}

async function stopTrack(track: LoopTrack) {
  track.wanted = false;
  if (track.loading) {
    await loadTrack(track);
  }
  const sound = track.sound;
  if (!sound) return;
  try {
    await sound.stopAsync();
  } catch (error) {
    console.warn(`Failed to stop ${track.label} music`, error);
  }
  track.playing = false;
}

async function unloadTrack(track: LoopTrack) {
  track.wanted = false;
  if (track.loading) {
    await loadTrack(track);
  }
  const sound = track.sound;
  track.sound = null;
  track.playing = false;
  if (!sound) return;
  try {
    await sound.unloadAsync();
  } catch (error) {
    console.warn(`Failed to unload ${track.label} music`, error);
  }
}

export function startRollingMusic() {
  return startTrack(rolling);
}

export function stopRollingMusic() {
  return stopTrack(rolling);
}

export function unloadRollingMusic() {
  return unloadTrack(rolling);
}

export function startInfernoMusic() {
  return startTrack(inferno);
}

export function stopInfernoMusic() {
  return stopTrack(inferno);
}

export function unloadInfernoMusic() {
  return unloadTrack(inferno);
}
