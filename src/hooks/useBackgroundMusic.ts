import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Audio,
  AVPlaybackSource,
  InterruptionModeAndroid,
  InterruptionModeIOS,
} from 'expo-av';

type UseBackgroundMusicOpts = {
  source: AVPlaybackSource;
  startPaused?: boolean;
  loop?: boolean;
  initialVolume?: number;
  storageKey?: string;
};

export function useBackgroundMusic({
  source,
  startPaused = true,
  loop = true,
  initialVolume = 0.4,
  storageKey = 'rules_sound_allowed',
}: UseBackgroundMusicOpts) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isLoaded, setLoaded] = useState(false);
  const [isPlaying, setPlaying] = useState(false);
  const [isMuted, setMuted] = useState(false);
  const [volume, setVolume] = useState(initialVolume);
  const [canAutoplay, setCanAutoplay] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(source, {
          shouldPlay: false,
          isLooping: loop,
          volume: initialVolume,
        });
        if (!mounted) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        setLoaded(true);

        if (canAutoplay && !startPaused) {
          await sound.playAsync();
          setPlaying(true);
        }
      } catch (error) {
        console.warn('Music load error', error);
      }
    })();

    return () => {
      mounted = false;
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [source, loop, initialVolume, startPaused, canAutoplay]);

  const play = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    try {
      await sound.setIsMutedAsync(false);
      await sound.playAsync();
      setPlaying(true);
      setMuted(false);
      try {
        localStorage.setItem(storageKey, '1');
        setCanAutoplay(true);
      } catch {
        // ignore storage failures
      }
    } catch (error) {
      console.warn('Music play error', error);
    }
  }, [storageKey]);

  const pause = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    try {
      await sound.pauseAsync();
      setPlaying(false);
    } catch (error) {
      console.warn('Music pause error', error);
    }
  }, []);

  const toggle = useCallback(async () => {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  const mute = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    try {
      await sound.setIsMutedAsync(true);
      setMuted(true);
    } catch (error) {
      console.warn('Music mute error', error);
    }
  }, []);

  const unmute = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    try {
      await sound.setIsMutedAsync(false);
      setMuted(false);
    } catch (error) {
      console.warn('Music unmute error', error);
    }
  }, []);

  const setVol = useCallback(async (next: number) => {
    const clamped = Math.max(0, Math.min(1, next));
    setVolume(clamped);
    const sound = soundRef.current;
    if (!sound) return;
    try {
      await sound.setVolumeAsync(clamped);
    } catch (error) {
      console.warn('Music volume error', error);
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      const sound = soundRef.current;
      if (!sound) return;
      if (document.hidden && isPlaying) {
        sound.pauseAsync().then(() => setPlaying(false)).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isPlaying]);

  return {
    isLoaded,
    isPlaying,
    isMuted,
    volume,
    canAutoplay,
    play,
    pause,
    toggle,
    mute,
    unmute,
    setVolume: setVol,
  };
}
