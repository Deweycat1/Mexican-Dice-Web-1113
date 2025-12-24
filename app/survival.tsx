import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';
import AnimatedDiceReveal from '../src/components/AnimatedDiceReveal';
import BluffModal from '../src/components/BluffModal';
import Dice from '../src/components/Dice';
import FeltBackground from '../src/components/FeltBackground';
import { FlameEmojiIcon } from '../src/components/FlameEmojiIcon';
import { InlineFlameText } from '../src/components/InlineFlameText';
import StreakCelebrationOverlay from '../src/components/StreakCelebrationOverlay';
import StyledButton from '../src/components/StyledButton';
import SurvivalRulesContent from '../src/components/SurvivalRulesContent';
import {
  compareClaims,
  isAlwaysClaimable,
  isReverseOf,
  rankValue,
  resolveActiveChallenge,
  resolveBluff,
  splitClaim,
} from '../src/engine/mexican';
import { getSurvivalClaimOptions } from '../src/lib/claimOptionSources';
import { startInfernoMusic, stopInfernoMusic } from '../src/lib/globalMusic';
import { MEXICAN_ICON } from '../src/lib/constants';
import { awardBadge } from '../src/stats/badges';
import { useGameStore } from '../src/state/useGameStore';
import { useSettingsStore } from '../src/state/useSettingsStore';
import {
  INFERNO_SLOTS,
  InfernoSlotId,
  getProgressCount,
  hasSeenInfernoLettersIntro,
  isComplete,
  loadCollectedLetters,
  pickMissingSlot,
  saveCollectedLetters,
  setSeenInfernoLettersIntro,
} from '../src/survival/infernoLetters';
import { DICE_SPACING, DIE_SIZE } from '../src/theme/dice';

function formatClaimDetailed(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ' - ';
  if (value === 21) return '21 (Inferno)';
  if (value === 31) return '31 (Reverse)';
  if (value === 41) return '41 (Social)';
  const [hi, lo] = splitClaim(value);
  return `${hi}${lo}`;
}
function formatClaimSimple(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ' - ';
  const [hi, lo] = splitClaim(value);
  return `${hi}${lo}`;
}
function formatRollDetailed(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ' - ';
  const [hi, lo] = splitClaim(value);
  return `${hi}${lo}`;
}
const formatRollSimple = formatRollDetailed;
function facesFromRoll(value: number | null | undefined): readonly [number | null, number | null] {
  if (typeof value !== 'number' || Number.isNaN(value)) return [null, null] as const;
  const [hi, lo] = splitClaim(value);
  return [hi, lo] as const;
}
function getMissingInfernoSlots(collected: Set<InfernoSlotId>): InfernoSlotId[] {
  return INFERNO_SLOTS.filter((slot) => !collected.has(slot.id)).map((slot) => slot.id);
}

function getInfernoSlotChar(id: InfernoSlotId): string {
  const slot = INFERNO_SLOTS.find((entry) => entry.id === id);
  return slot ? slot.char : '';
}

const DICE_JIGGLE_SMALL = DIE_SIZE * 0.05;
const DICE_JIGGLE_MEDIUM = DIE_SIZE * 0.08;
const DICE_JIGGLE_HEAVY = DIE_SIZE * 0.1;
const DICE_JIGGLE_EPIC = DIE_SIZE * 0.12;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255] as const;
}
function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}



type StreakMeterProps = {
  currentStreak: number;
  globalBest: number;
  isSurvivalOver: boolean;
  compact?: boolean;
};

const COLOR_LIGHT_BLUE = '#42C6FF';
const COLOR_BLUE = '#1E8AC4';
const COLOR_MAGENTA = '#A020F0';
const COLOR_RED = '#C21807';

const StreakMeter: React.FC<StreakMeterProps> = ({
  currentStreak,
  globalBest,
  isSurvivalOver,
  compact = false,
}) => {
  const safeGlobalBest = typeof globalBest === 'number' ? globalBest : 0;
  const recordTarget = Math.max(safeGlobalBest, 1);
  const targetToBeat = Math.max(safeGlobalBest + 1, 1);
  const clampedProgress = Math.max(0, Math.min(currentStreak / targetToBeat, 1));
  const hasBrokenRecord = currentStreak > safeGlobalBest && currentStreak > 0 && !isSurvivalOver;
  const rainbowAnim = useRef(new Animated.Value(0)).current;
  const rainbowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const rainbowActiveRef = useRef(false);

  useEffect(() => {
    if (!hasBrokenRecord) {
      if (rainbowActiveRef.current) {
        rainbowLoopRef.current?.stop();
        rainbowLoopRef.current = null;
        rainbowActiveRef.current = false;
        rainbowAnim.setValue(0);
      }
      return;
    }

    if (rainbowActiveRef.current) {
      return;
    }

    rainbowActiveRef.current = true;
    rainbowAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(rainbowAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      })
    );
    rainbowLoopRef.current = loop;
    loop.start();

    return () => {
      rainbowLoopRef.current?.stop();
      rainbowLoopRef.current = null;
      rainbowActiveRef.current = false;
    };
  }, [hasBrokenRecord, rainbowAnim]);

  const rainbowColor = rainbowAnim.interpolate({
    inputRange: [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1],
    outputRange: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#8B00FF', '#FF0000'],
  });

  const progress = clampedProgress;
  const gradientColors =
    progress <= 0.2
      ? [COLOR_LIGHT_BLUE, COLOR_BLUE]
      : progress <= 0.4
        ? [COLOR_LIGHT_BLUE, COLOR_BLUE, COLOR_MAGENTA]
        : [COLOR_LIGHT_BLUE, COLOR_BLUE, COLOR_MAGENTA, COLOR_RED];

  return (
    <View
      style={[styles.streakMeterContainer, compact && styles.streakMeterContainerCompact]}
      pointerEvents="none"
    >
      <View style={styles.streakRow}>
        <Text style={styles.streakLabel}>Streak: {currentStreak}</Text>
        <View style={[styles.streakMeterThermoRow, styles.streakMeter]}>
          <View style={styles.streakMeterBulbWrapper}>
            <Animated.View
              style={[
                styles.streakMeterBulb,
                { backgroundColor: hasBrokenRecord ? rainbowColor : gradientColors[0] },
              ]}
            />
          </View>
          <View style={styles.streakMeterOuter}>
            {hasBrokenRecord ? (
              <Animated.View
                style={[
                  styles.streakMeterFill,
                  { width: `${clampedProgress * 100}%`, backgroundColor: rainbowColor },
                ]}
              />
            ) : (
              <Animated.View
                style={[
                  styles.streakMeterFill,
                  { width: `${clampedProgress * 100}%` },
                ]}
              >
                <LinearGradient
                  colors={gradientColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.streakGradient}
                />
              </Animated.View>
            )}
          </View>
        </View>
        <Text style={styles.recordLabel}>Record: {safeGlobalBest}</Text>
      </View>
    </View>
  );
};

export default function Survival() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { height } = useWindowDimensions();
  const isSmallScreen = height < 700;
  const isTallScreen = height > 820;
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const musicEnabled = useSettingsStore((state) => state.musicEnabled);
  const sfxEnabled = useSettingsStore((state) => state.sfxEnabled);
  const setHapticsEnabled = useSettingsStore((state) => state.setHapticsEnabled);
  const setMusicEnabled = useSettingsStore((state) => state.setMusicEnabled);
  const setSfxEnabled = useSettingsStore((state) => state.setSfxEnabled);
  const hasSeenSurvivalIntro = useSettingsStore((state) => state.hasSeenSurvivalIntro);
  const setHasSeenSurvivalIntro = useSettingsStore((state) => state.setHasSeenSurvivalIntro);
  const [claimPickerOpen, setClaimPickerOpen] = useState(false);
  const [rollingAnim, setRollingAnim] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [cpuDiceRevealed, setCpuDiceRevealed] = useState(false);
  const [pendingCpuBluffResolution, setPendingCpuBluffResolution] = useState(false);
  const [shouldRevealCpuDice, setShouldRevealCpuDice] = useState(false);
  const [isRevealAnimating, setIsRevealAnimating] = useState(false);
  const socialRevealNonceRef = useRef<number | null>(null);
  const socialBannerNonceRef = useRef(0);
  const socialBannerInitializedRef = useRef(false);
  const [showSocialReveal, setShowSocialReveal] = useState(false);
  const [socialDiceValues, setSocialDiceValues] = useState<[number | null, number | null]>([null, null]);
  const [socialRevealHidden, setSocialRevealHidden] = useState(true);
  const [rivalBluffBannerVisible, setRivalBluffBannerVisible] = useState(false);
  const [rivalBluffBannerType, setRivalBluffBannerType] = useState<'got-em' | 'womp-womp' | 'social' | null>(null);
  const [rivalBluffBannerSecondary, setRivalBluffBannerSecondary] = useState<string | null>(null);
  const rivalBluffBannerOpacity = useRef(new Animated.Value(0)).current;
  const rivalBluffBannerScale = useRef(new Animated.Value(0.95)).current;
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [introVisible, setIntroVisible] = useState(false);
  const [collectedSlots, setCollectedSlots] = useState<Set<InfernoSlotId>>(new Set());
  const [infernoIntroSeen, setInfernoIntroSeen] = useState(false);
  const [infernoLetterModalOpen, setInfernoLetterModalOpen] = useState(false);
  const [infernoLetterModalSlot, setInfernoLetterModalSlot] = useState<InfernoSlotId | null>(null);
  const [infernoLetterModalProgress, setInfernoLetterModalProgress] = useState(0);
  const [infernoLetterModalIsIntro, setInfernoLetterModalIsIntro] = useState(false);

  // Milestone tracking state
  const [hasShown5, setHasShown5] = useState(false);
  const [hasShown10, setHasShown10] = useState(false);
  const [hasShown15, setHasShown15] = useState(false);
  const [hasShown20, setHasShown20] = useState(false);
  const [hasShown25, setHasShown25] = useState(false);
  const [hasShown30, setHasShown30] = useState(false);
  const [hasShown35, setHasShown35] = useState(false);
  const [hasShown40, setHasShown40] = useState(false);
  const [hasShownNewLeader, setHasShownNewLeader] = useState(false);

  // Celebration overlay state
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [celebrationTitle, setCelebrationTitle] = useState<ReactNode>('');
  const [celebrationMode, setCelebrationMode] = useState<'5' | '10' | '15' | '20' | '25' | '30' | '35' | '40' | 'newLeader'>('5');

  // Micro + streak overlay state
  const [plusOneVisible, setPlusOneVisible] = useState(false);
  const [plusOneAmount, setPlusOneAmount] = useState(1);
  const plusOneFlashTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const plusOneFlashTickRef = useRef(0);
  const pendingCpuBluffTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cpuBluffResolveInFlightRef = useRef(false);

  // Animation refs for micro animations
  const streakScaleAnim = useRef(new Animated.Value(1)).current;
  const diceJiggleAnim = useRef(new Animated.Value(0)).current;
  const screenShakeAnim = useRef(new Animated.Value(0)).current;
  const screenTiltAnim = useRef(new Animated.Value(0)).current;
  const dimAnim = useRef(new Animated.Value(0)).current;
  const edgeFlashAnim = useRef(new Animated.Value(0)).current;
  
  // New milestone animation refs
  const goldPulseAnim = useRef(new Animated.Value(0)).current;
  const fieryFlashAnim = useRef(new Animated.Value(0)).current;
  const alarmFlashAnim = useRef(new Animated.Value(0)).current;
  const electricJoltAnim = useRef(new Animated.Value(0)).current;
  const electricJoltOpacityAnim = useRef(new Animated.Value(0)).current;
  const vortexPulseAnim = useRef(new Animated.Value(0)).current;
  const bluffResultNonceRef = useRef(0);
  const bluffResultInitializedRef = useRef(false);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogLastKickKeyRef = useRef<string | null>(null);
  const letterAttemptUsedRef = useRef(false);
  const lastProcessedRollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isFocused) return;
    if (hasSeenSurvivalIntro) return;
    setIntroVisible(true);
  }, [isFocused, hasSeenSurvivalIntro]);

  useEffect(() => {
    let isMounted = true;
    const loadInfernoLetters = async () => {
      const [letters, introSeen] = await Promise.all([
        loadCollectedLetters(),
        hasSeenInfernoLettersIntro(),
      ]);
      if (!isMounted) return;
      setCollectedSlots(letters);
      setInfernoIntroSeen(introSeen);
      if (isComplete(letters)) {
        void awardBadge('inferno_letter_collector');
      }
    };
    void loadInfernoLetters();
    return () => {
      isMounted = false;
    };
  }, []);

  const startPlusOneFlash = useCallback((increment: number) => {
    if (plusOneFlashTimerRef.current) {
      clearInterval(plusOneFlashTimerRef.current);
      plusOneFlashTimerRef.current = null;
    }

    plusOneFlashTickRef.current = 0;
    setPlusOneAmount(increment);
    setPlusOneVisible(true);

    plusOneFlashTimerRef.current = setInterval(() => {
      plusOneFlashTickRef.current += 1;
      setPlusOneVisible((prev) => !prev);

      if (plusOneFlashTickRef.current >= PLUS_ONE_FLASHES * 2 - 1) {
        if (plusOneFlashTimerRef.current) {
          clearInterval(plusOneFlashTimerRef.current);
          plusOneFlashTimerRef.current = null;
        }
        setPlusOneVisible(false);
      }
    }, PLUS_ONE_FLASH_INTERVAL);
  }, []);

  const getScaledInfernoLetterChance = (progress: number) => {
    switch (progress) {
      case 1:
        return 0.8;
      case 2:
        return 0.7;
      case 3:
        return 0.6;
      case 4:
        return 0.5;
      case 5:
        return 0.4;
      case 6:
        return 0.3;
      default:
        return 0;
    }
  };

  const attemptInfernoLetterAward = useCallback(async () => {
    const missingSlots = getMissingInfernoSlots(collectedSlots);

    if (!infernoIntroSeen) {
      let eligible = missingSlots.filter((slotId) => slotId !== 'I' && slotId !== 'O');
      if (eligible.length === 0) {
        eligible = missingSlots;
      }
      const picked =
        eligible.length > 0
          ? eligible[Math.floor(Math.random() * eligible.length)]
          : null;
      if (!picked) {
        await setSeenInfernoLettersIntro();
        setInfernoIntroSeen(true);
        return;
      }
      const next = new Set(collectedSlots);
      next.add(picked);
      await saveCollectedLetters(next);
      await setSeenInfernoLettersIntro();
      setCollectedSlots(next);
      setInfernoIntroSeen(true);
      setInfernoLetterModalSlot(picked);
      setInfernoLetterModalProgress(getProgressCount(next));
      setInfernoLetterModalIsIntro(true);
      setInfernoLetterModalOpen(true);
      if (isComplete(next)) {
        void awardBadge('inferno_letter_collector');
      }
      return;
    }

    const progress = collectedSlots.size;
    const baseChance = getScaledInfernoLetterChance(progress);
    if (Math.random() >= baseChance) return;
    if (missingSlots.length === 0) return;
    if (missingSlots.length === 1 && Math.random() >= 0.05) return;

    const picked = pickMissingSlot(collectedSlots);
    if (!picked) return;

    const next = new Set(collectedSlots);
    next.add(picked);
    await saveCollectedLetters(next);
    setCollectedSlots(next);
    setInfernoLetterModalSlot(picked);
    setInfernoLetterModalProgress(getProgressCount(next));
    setInfernoLetterModalIsIntro(false);
    setInfernoLetterModalOpen(true);
    if (isComplete(next)) {
      void awardBadge('inferno_letter_collector');
    }
  }, [collectedSlots, infernoIntroSeen]);

  const {
    // survival controls
    mode,
    lastClaim,
    lastAction,
    baselineClaim,
    turn,
    lastPlayerRoll,
    lastCpuRoll,
    isRolling,
    isBusy,
    turnLock,
    playerRoll,
    playerClaim,
    callBluff,
    buildBanner,
    getBaseMessage,
    survivalClaims,
    gameOver,
    mustBluff,
    cpuSocialDice,
    cpuSocialRevealNonce,
    socialBannerNonce,
    lastBluffCaller,
    lastBluffDefenderTruth,
    bluffResultNonce,
    // survival controls
    startSurvival,
    restartSurvival,
    stopSurvival,
    currentStreak,
    bestStreak,
    globalBest,
    isSurvivalOver,
    cpuTurn,
  } = useGameStore();

  // pulsing animation for the caption/title to add adrenaline
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // compute dynamic parameters from streak
  const normalized = clamp(currentStreak / 20, 0, 1); // 0..1 over first 20 streaks
  const amplitude = 1 + clamp(0.06 + currentStreak * 0.008, 0.06, 0.20); // scale
  const periodMs = Math.round(clamp(840 - currentStreak * 18, 480, 840)); // faster with streak

  const HEARTBEAT_MIN_INTERVAL = 220; // ms, hard floor so it never gets absurdly fast

  function computeHeartbeatInterval(streak: number, basePeriodMs: number): number {
    // Each full chunk of 3 streak points increases the heartbeat speed
    const tier = Math.floor(streak / 3); // 0 for 0–2, 1 for 3–5, 2 for 6–8, etc.

    // Each tier makes the heartbeat ~15% faster than the previous one
    const speedMultiplier = 1 + tier * 0.15;

    const intervalMs = Math.round(basePeriodMs / speedMultiplier);

    // Clamp so we never go below a minimum interval
    return Math.max(HEARTBEAT_MIN_INTERVAL, intervalMs);
  }

  // color shift: from green (#E6FFE6) to red (#FF6B6B) based on normalized streak
  const startCol = hexToRgb('#E6FFE6');
  const endCol = hexToRgb('#FF6B6B');
  const interp = (i: number) => Math.round(lerp(startCol[i], endCol[i], normalized));
  const dynamicScoreColor = rgbToHex(interp(0), interp(1), interp(2));

  // ensure we can restart animation & haptics when streak changes
  const animLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const hapticTimerRef = useRef<number | null>(null);

  // subtle flash on streak increment
  const streakFlashAnim = useRef(new Animated.Value(1)).current;
  const prevStreakRef = useRef(currentStreak);

  const logSurvivalSnapshot = useCallback(
    (tag: string) => {
      if (!__DEV__) return;
      // Structured snapshot to help diagnose stuck states
      console.log('[SURVIVAL][SNAPSHOT]', {
        tag,
        mode,
        turn,
        turnLock,
        isBusy,
        gameOver,
        lastClaim,
        baselineClaim,
        lastPlayerRoll,
        lastCpuRoll,
        currentStreak,
        isSurvivalOver,
        rollingAnim,
        isRolling,
        claimPickerOpen,
        cpuDiceRevealed,
        pendingCpuBluffResolution,
        shouldRevealCpuDice,
        isRevealAnimating,
        showSocialReveal,
        historyModalOpen,
        rulesOpen,
        settingsOpen,
        introVisible,
      });
    },
    [
      baselineClaim,
      claimPickerOpen,
      cpuDiceRevealed,
      currentStreak,
      gameOver,
      historyModalOpen,
      introVisible,
      isBusy,
      isRevealAnimating,
      isRolling,
      isSurvivalOver,
      lastClaim,
      lastCpuRoll,
      lastPlayerRoll,
      mode,
      pendingCpuBluffResolution,
      rollingAnim,
      rulesOpen,
      settingsOpen,
      shouldRevealCpuDice,
      showSocialReveal,
      turn,
      turnLock,
    ]
  );

  useEffect(() => {
    // if streak increased, trigger a subtle brightening flash
    if (currentStreak > prevStreakRef.current) {
      streakFlashAnim.setValue(0.5);
      Animated.timing(streakFlashAnim, {
        toValue: 1.0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
    prevStreakRef.current = currentStreak;
  }, [currentStreak, streakFlashAnim]);

  // Watchdog to recover from a stalled CPU turn in Survival mode
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (mode !== 'survival') return;

    // Clear any existing timer if conditions are not suitable
    if (turn !== 'cpu' || gameOver !== null || turnLock || isBusy) {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      return;
    }

    const key = `turn=${turn}|claim=${lastClaim ?? 'none'}|cpuRoll=${lastCpuRoll ?? 'none'}`;

    // If we already kicked this exact stalled state, don't schedule again
    if (watchdogLastKickKeyRef.current === key) {
      return;
    }

    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
    }

    watchdogTimerRef.current = setTimeout(() => {
      watchdogTimerRef.current = null;
      watchdogLastKickKeyRef.current = key;
      if (__DEV__) {
        console.log('[SURVIVAL][WATCHDOG] Stuck CPU turn detected', {
          key,
          mode,
          turn,
          turnLock,
          isBusy,
          gameOver,
          lastClaim,
          baselineClaim,
          lastPlayerRoll,
          lastCpuRoll,
          currentStreak,
          isSurvivalOver,
        });
        logSurvivalSnapshot('watchdog');
      }
      cpuTurn();
    }, 1800);

    return () => {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
    };
  }, [
    baselineClaim,
    cpuTurn,
    currentStreak,
    gameOver,
    isBusy,
    isSurvivalOver,
    lastClaim,
    lastCpuRoll,
    logSurvivalSnapshot,
    mode,
    turn,
    turnLock,
  ]);

  useEffect(() => {
    // clear previous animation
    if (animLoopRef.current) {
      try { (animLoopRef.current as any).stop(); } catch {}
      animLoopRef.current = null;
    }

    const half = Math.round(periodMs / 2);
    const seq = Animated.sequence([
      Animated.timing(pulseAnim, { toValue: amplitude, duration: half, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1.0, duration: half, useNativeDriver: true }),
    ]);
    const loop = Animated.loop(seq);
    animLoopRef.current = loop;
    loop.start();

    return () => {
      if (animLoopRef.current) {
        try { (animLoopRef.current as any).stop(); } catch {}
        animLoopRef.current = null;
      }
    };
  }, [pulseAnim, amplitude, periodMs]);

  useEffect(() => {
    if (isFocused && musicEnabled) {
      void startInfernoMusic();
    } else {
      void stopInfernoMusic();
    }
  }, [isFocused, musicEnabled]);

  // haptics scaling and pattern
  useEffect(() => {
    if (hapticTimerRef.current) {
      clearInterval(hapticTimerRef.current);
      hapticTimerRef.current = null;
    }

    if (!hapticsEnabled || !isFocused) {
      return () => {
        if (hapticTimerRef.current) {
          clearInterval(hapticTimerRef.current);
          hapticTimerRef.current = null;
        }
      };
    }

    const intervalMs = computeHeartbeatInterval(currentStreak, periodMs);

    const fireHaptic = () => {
      if (isSurvivalOver) return;
      if (!useSettingsStore.getState().hapticsEnabled) return;
      try {
        if (currentStreak >= 20) {
          // strong double pulse
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          setTimeout(() => {
            if (!useSettingsStore.getState().hapticsEnabled) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          }, 100);
        } else if (currentStreak >= 15) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        } else if (currentStreak >= 5) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      } catch {}
    };

    const id = setInterval(fireHaptic, intervalMs);
    hapticTimerRef.current = id as unknown as number;
    fireHaptic();

    return () => {
      if (hapticTimerRef.current) {
        clearInterval(hapticTimerRef.current);
        hapticTimerRef.current = null;
      }
    };
  }, [currentStreak, hapticsEnabled, isFocused, isSurvivalOver, periodMs]);

  // Global RollingDice music is managed at the app layout level; Survival stays silent.

  useEffect(() => {
    return () => {
      if (plusOneFlashTimerRef.current) {
        clearInterval(plusOneFlashTimerRef.current);
        plusOneFlashTimerRef.current = null;
      }
    };
  }, []);

  // Reset milestone flags whenever a fresh run starts (streak resets to 0)
  useEffect(() => {
    if (currentStreak === 0) {
      setHasShown5(false);
      setHasShown10(false);
      setHasShown15(false);
      setHasShown20(false);
      setHasShown25(false);
      setHasShown30(false);
      setHasShown35(false);
      setHasShown40(false);
      setHasShownNewLeader(false);
    }
  }, [currentStreak]);

  // Micro +1 streak animation (fires on every streak increment)
  const prevStreakForMicroAnim = useRef(currentStreak);
  useEffect(() => {
    const streakDelta = currentStreak - prevStreakForMicroAnim.current;
    if (streakDelta > 0 && currentStreak > 0) {
      // Trigger micro animations
      
      // 1. Streak label pop + glow (550-650ms total)
      streakScaleAnim.setValue(1);
      Animated.sequence([
        Animated.timing(streakScaleAnim, {
          toValue: 1.2,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(streakScaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();

      // 2. Plus-one flash (same cadence as previous emoji burst)
      startPlusOneFlash(streakDelta);

      // 3. Dice micro-jiggle (450-500ms)
      diceJiggleAnim.setValue(0);
      Animated.sequence([
        Animated.timing(diceJiggleAnim, {
          toValue: -DICE_JIGGLE_SMALL,
          duration: 225,
          useNativeDriver: true,
        }),
        Animated.timing(diceJiggleAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevStreakForMicroAnim.current = currentStreak;
  }, [currentStreak, streakScaleAnim, diceJiggleAnim, startPlusOneFlash]);

  // 5-streak milestone
  useEffect(() => {
    if (currentStreak === 5 && !hasShown5) {
      setHasShown5(true);
      
      // Screen shake
      screenShakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(screenShakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
        Animated.timing(screenShakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
        Animated.timing(screenShakeAnim, { toValue: 3, duration: 50, useNativeDriver: true }),
        Animated.timing(screenShakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();

      // Show celebration overlay
      setCelebrationTitle(buildFlameCelebrationTitle('5 in a row?! Okay RELAX.', '#FF6B6B'));
      setCelebrationMode('5');
      setCelebrationVisible(true);
    }
  }, [currentStreak, hasShown5, screenShakeAnim]);

  // 10-streak milestone
  useEffect(() => {
    if (currentStreak === 10 && !hasShown10) {
      setHasShown10(true);
      
      // Screen shake
      screenShakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(screenShakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(screenShakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(screenShakeAnim, { toValue: 5, duration: 60, useNativeDriver: true }),
        Animated.timing(screenShakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();

      // Edge flash (red)
      edgeFlashAnim.setValue(0);
      Animated.sequence([
        Animated.timing(edgeFlashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(edgeFlashAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();

      // Show celebration overlay
      setCelebrationTitle('💥 TEN IN A ROW!! DON\'T CHOKE!!!!');
      setCelebrationMode('10');
      setCelebrationVisible(true);
    }
  }, [currentStreak, hasShown10, screenShakeAnim, edgeFlashAnim]);

  // 15-streak milestone
  useEffect(() => {
    if (currentStreak === 15 && !hasShown15) {
      setHasShown15(true);
      
      // Screen tilt
      screenTiltAnim.setValue(0);
      Animated.sequence([
        Animated.timing(screenTiltAnim, { toValue: -0.03, duration: 150, useNativeDriver: true }),
        Animated.timing(screenTiltAnim, { toValue: 0.03, duration: 150, useNativeDriver: true }),
        Animated.spring(screenTiltAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
      ]).start();

      // Show celebration overlay
      setCelebrationTitle('👑 FIFTEEN. STREAK. YOU MENACE.');
      setCelebrationMode('15');
      setCelebrationVisible(true);
    }
  }, [currentStreak, hasShown15, screenTiltAnim]);

  // 20-streak milestone (Gold pulse aura)
  useEffect(() => {
    if (currentStreak === 20 && !hasShown20) {
      setHasShown20(true);
      
      // Gold pulse aura
      goldPulseAnim.setValue(0);
      Animated.sequence([
        Animated.timing(goldPulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(goldPulseAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();

      // Heavy dice wiggle
      diceJiggleAnim.setValue(0);
      Animated.sequence([
        Animated.timing(diceJiggleAnim, {
          toValue: -DICE_JIGGLE_MEDIUM,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(diceJiggleAnim, {
          toValue: DICE_JIGGLE_MEDIUM,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(diceJiggleAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();

      // Show celebration overlay
      setCelebrationTitle('⭐ TWENTY?! You\'re entering myth territory.');
      setCelebrationMode('20');
      setCelebrationVisible(true);
    }
  }, [currentStreak, hasShown20, goldPulseAnim, diceJiggleAnim]);

  // 25-streak milestone (Fiery edge flash)
  useEffect(() => {
    if (currentStreak === 25 && !hasShown25) {
      setHasShown25(true);
      
      // Fiery edge flash (orange/red)
      fieryFlashAnim.setValue(0);
      Animated.sequence([
        Animated.timing(fieryFlashAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(fieryFlashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();

      // Heavy dice bounce
      diceJiggleAnim.setValue(0);
      Animated.sequence([
        Animated.timing(diceJiggleAnim, {
          toValue: -DICE_JIGGLE_HEAVY,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(diceJiggleAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();

      // Show celebration overlay
      setCelebrationTitle(buildFlameCelebrationTitle('TWENTY-FIVE! This is statistically irresponsible.', '#FF6600'));
      setCelebrationMode('25');
      setCelebrationVisible(true);
    }
  }, [currentStreak, hasShown25, fieryFlashAnim, diceJiggleAnim]);

  // 30-streak milestone (Alarm flash + siren pulse)
  useEffect(() => {
    if (currentStreak === 30 && !hasShown30) {
      setHasShown30(true);
      
      // Alarm-style red flash with siren pulse
      alarmFlashAnim.setValue(0);
      const sirenPulse = Animated.loop(
        Animated.sequence([
          Animated.timing(alarmFlashAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(alarmFlashAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        ])
      );
      sirenPulse.start();
      setTimeout(() => sirenPulse.stop(), 800);

      // Heavy screen shake
      screenShakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(screenShakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(screenShakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(screenShakeAnim, { toValue: 5, duration: 60, useNativeDriver: true }),
        Animated.timing(screenShakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();

      // Show celebration overlay
      setCelebrationTitle('🚨 THIRTY. HOW ARE YOU STILL ALIVE?');
      setCelebrationMode('30');
      setCelebrationVisible(true);
    }
  }, [currentStreak, hasShown30, alarmFlashAnim, screenShakeAnim]);

  // 35-streak milestone (Electric jolt)
  useEffect(() => {
    if (currentStreak === 35 && !hasShown35) {
      setHasShown35(true);
      
      // Electric jolt/jitter effect
      electricJoltAnim.setValue(0);
      electricJoltOpacityAnim.setValue(0);
      
      const jitterSequence = [];
      for (let i = 0; i < 8; i += 1) {
        jitterSequence.push(
          Animated.timing(electricJoltAnim, {
            toValue: (i % 2 === 0 ? 1 : -1) * (3 - i * 0.3),
            duration: 40,
            useNativeDriver: true,
          })
        );
      }
      jitterSequence.push(
        Animated.timing(electricJoltAnim, { toValue: 0, duration: 40, useNativeDriver: true })
      );
      Animated.sequence(jitterSequence).start();
      
      // Opacity flash for cyan overlay
      Animated.sequence([
        Animated.timing(electricJoltOpacityAnim, { toValue: 0.25, duration: 80, useNativeDriver: true }),
        Animated.timing(electricJoltOpacityAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();

      // Show celebration overlay
      setCelebrationTitle('⚡ THIRTY-FIVE! This run is illegal in several countries.');
      setCelebrationMode('35');
      setCelebrationVisible(true);
    }
  }, [currentStreak, hasShown35, electricJoltAnim, electricJoltOpacityAnim]);

  // 40-streak milestone (Dark vortex pulse + slow-mo)
  useEffect(() => {
    if (currentStreak === 40 && !hasShown40) {
      setHasShown40(true);
      
      // Dark vortex pulse
      vortexPulseAnim.setValue(0);
      Animated.sequence([
        Animated.timing(vortexPulseAnim, { toValue: 0.7, duration: 400, useNativeDriver: true }),
        Animated.timing(vortexPulseAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();

      // Slight slow-motion effect on dice (longer jiggle)
      diceJiggleAnim.setValue(0);
      Animated.sequence([
        Animated.timing(diceJiggleAnim, {
          toValue: -DICE_JIGGLE_EPIC,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(diceJiggleAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();

      // Show celebration overlay
      setCelebrationTitle('🐉 FORTY. YOU HAVE AWAKENED SOMETHING ANCIENT.');
      setCelebrationMode('40');
      setCelebrationVisible(true);
    }
  }, [currentStreak, hasShown40, vortexPulseAnim, diceJiggleAnim]);

  // New Global Leader milestone
  useEffect(() => {
    if (currentStreak > globalBest && currentStreak > 0 && !hasShownNewLeader) {
      setHasShownNewLeader(true);
      
      // Screen dim then pop
      dimAnim.setValue(0);
      Animated.sequence([
        Animated.timing(dimAnim, { toValue: 0.5, duration: 200, useNativeDriver: true }),
        Animated.timing(dimAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();

      // Show celebration overlay
      setCelebrationTitle('🏆 NEW LEADER! YOU JUST BROKE THE SURVIVAL RECORD!');
      setCelebrationMode('newLeader');
      setCelebrationVisible(true);
    }
  }, [currentStreak, globalBest, hasShownNewLeader, dimAnim]);

  const narration = (buildBanner?.() || getBaseMessage() || '').trim();
  const lastClaimValue = resolveActiveChallenge(baselineClaim, lastClaim);
  const hasClaim = lastClaimValue != null;

  const buildFlameCelebrationTitle = (text: string, color: string) => (
    <View style={styles.celebrationTitleRow}>
      <FlameEmojiIcon size={32} style={styles.celebrationTitleIcon} />
      <Text style={[styles.celebrationTitleText, { color }]}>{text}</Text>
    </View>
  );

  const claimText = useMemo(() => {
    const hasClaim = lastClaimValue != null || lastPlayerRoll != null;
    if (!hasClaim) return null;
    const claimPart = formatClaimSimple(lastClaimValue);
    return (
      <>
        Claim: {claimPart}
      </>
    );
  }, [lastClaimValue, lastPlayerRoll]);

  const [playerHi, playerLo] = facesFromRoll(lastPlayerRoll);
  const [cpuHi, cpuLo] = facesFromRoll(lastCpuRoll);
  const rolling = rollingAnim || isRolling;

  const isGameOver = gameOver !== null;
  const controlsDisabled = isGameOver || turn !== 'player' || isBusy || turnLock || isSurvivalOver;
  const streakEnded = isSurvivalOver;
  const showCpuThinking = turn !== 'player' && !isGameOver;
  const lastSurvivalClaim = useMemo(() => {
    if (!survivalClaims || survivalClaims.length === 0) return null;
    for (let i = survivalClaims.length - 1; i >= 0; i -= 1) {
      const entry = survivalClaims[i];
      if (entry?.type === 'claim') return entry;
    }
    return null;
  }, [survivalClaims]);
  const angryRivalThinking =
    showCpuThinking &&
    lastSurvivalClaim?.type === 'claim' &&
    lastSurvivalClaim.who === 'player' &&
    lastSurvivalClaim.claim === 21;
  const hasRolled = turn === 'player' && lastPlayerRoll !== null;
  const rolledValue = hasRolled ? lastPlayerRoll : null;
  const canClaimTruthfully =
    hasRolled &&
    rolledValue !== null &&
    (lastClaimValue == null
      ? true
      : isAlwaysClaimable(rolledValue) ||
        isReverseOf(lastClaimValue, rolledValue) ||
        compareClaims(rolledValue, lastClaimValue) >= 0);
  const shouldHighlightBluff =
    hasRolled &&
    rolledValue !== null &&
    lastClaimValue != null &&
    rankValue(rolledValue) <= rankValue(lastClaimValue);

  const isRivalClaimPhase = useMemo(() => {
    if (isGameOver) return false;
    if (turn !== 'player') return false;
    if (lastClaim == null) return false;
    return lastPlayerRoll == null;
  }, [isGameOver, turn, lastClaim, lastPlayerRoll]);

  const diceDisplayMode = useMemo(() => {
    if (isRivalClaimPhase) {
      return 'question';
    }
    if (turn === 'player') {
      return lastPlayerRoll == null ? 'prompt' : 'values';
    }
    return 'values';
  }, [isRivalClaimPhase, turn, lastPlayerRoll]);
  const layoutTweaks = useMemo(
    () => ({
      contentPadding: {
        paddingHorizontal: isSmallScreen ? 12 : 18,
        paddingBottom: isSmallScreen ? 12 : 20,
        paddingTop: isSmallScreen ? 6 : 12,
      },
      headerPadding: {
        padding: isSmallScreen ? 12 : 14,
        marginTop: isSmallScreen ? 4 : 8,
      },
      narrationHeight: {
        minHeight: isSmallScreen ? 48 : 60,
      },
      diceArea: {
        minHeight: isTallScreen ? DIE_SIZE * 3 : isSmallScreen ? DIE_SIZE * 2.2 : DIE_SIZE * 2.6,
        marginTop: isSmallScreen ? -DIE_SIZE : -DIE_SIZE * 1.34,
        marginBottom: isTallScreen ? DIE_SIZE * 0.3 : DIE_SIZE * 0.2,
        paddingVertical: isTallScreen ? 12 : 0,
      },
      controlsSpacing: {
        marginTop: isSmallScreen ? -DIE_SIZE * 1.1 : -DIE_SIZE * 1.5,
        paddingVertical: isSmallScreen ? 10 : 14,
      },
    }),
    [isSmallScreen, isTallScreen]
  );

  const showCpuRevealDice =
    !isGameOver &&
    lastCpuRoll !== null &&
    lastClaim !== null &&
    lastPlayerRoll === null &&
    shouldRevealCpuDice &&
    (turn === 'player' || pendingCpuBluffResolution);

  const currentBluffBannerStyle = useMemo(() => {
    if (rivalBluffBannerType === 'social') return styles.bluffBannerSocial;
    if (rivalBluffBannerType === 'got-em') return styles.bluffBannerSuccess;
    return styles.bluffBannerFail;
  }, [rivalBluffBannerType]);

  const currentBluffBannerPrimary = useMemo(() => {
    if (rivalBluffBannerType === 'social') return '🍻 SOCIAL!!! 🍻';
    if (rivalBluffBannerType === 'got-em') return "GOT 'EM!!!";
    if (rivalBluffBannerType === 'womp-womp') return 'WOMP WOMP';
    return '';
  }, [rivalBluffBannerType]);

  const claimOptions = useMemo(
    () => getSurvivalClaimOptions(lastClaimValue, lastPlayerRoll),
    [lastClaimValue, lastPlayerRoll]
  );

  useEffect(() => setClaimPickerOpen(false), [turn]);

  useEffect(() => {
    if (lastPlayerRoll == null) {
      lastProcessedRollRef.current = null;
      return;
    }
    if (lastPlayerRoll === lastProcessedRollRef.current) return;
    lastProcessedRollRef.current = lastPlayerRoll;
    if (lastPlayerRoll !== 21) return;
    if (letterAttemptUsedRef.current) return;
    letterAttemptUsedRef.current = true;
    void attemptInfernoLetterAward();
  }, [lastPlayerRoll, attemptInfernoLetterAward]);

  useEffect(() => {
    if (turn === 'player') {
      setCpuDiceRevealed(false);
      setPendingCpuBluffResolution(false);
      setShouldRevealCpuDice(false);
      cpuBluffResolveInFlightRef.current = false;
    }
  }, [turn, lastCpuRoll, lastClaim]);

  useEffect(() => {
    if (__DEV__) {
      console.log('[SURVIVAL DEBUG] pendingCpuBluffResolution changed', {
        pendingCpuBluffResolution,
        turn,
        shouldRevealCpuDice,
        isRevealAnimating,
        lastClaim,
        lastPlayerRoll,
        lastCpuRoll,
      });
    }
  }, [pendingCpuBluffResolution, turn, shouldRevealCpuDice, isRevealAnimating, lastClaim, lastPlayerRoll, lastCpuRoll]);

  useEffect(() => {
    if (__DEV__) {
      console.log('[SURVIVAL][LOCK]', {
        turnLock,
        isBusy,
        turn,
        gameOver,
      });
      logSurvivalSnapshot('lock-change');
    }
  }, [turnLock, isBusy, turn, gameOver, logSurvivalSnapshot]);

  useEffect(() => {
    if (__DEV__) {
      console.log('[SURVIVAL][TURN]', {
        turn,
        gameOver,
        turnLock,
        isBusy,
      });
      logSurvivalSnapshot('turn-change');
    }
  }, [turn, gameOver, turnLock, isBusy, logSurvivalSnapshot]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.15, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [survivalClaims, fadeAnim]);

  useEffect(() => {
    // Ensure bluff banner UI state starts clean whenever Survival mounts
    setRivalBluffBannerVisible(false);
    setRivalBluffBannerType(null);
    rivalBluffBannerOpacity.setValue(0);
    rivalBluffBannerScale.setValue(0.95);
    console.log('[SURVIVAL] Resetting bluff banner state on mount');

    return () => {
      setRivalBluffBannerVisible(false);
      setRivalBluffBannerType(null);
      console.log('[SURVIVAL] Cleanup on unmount – cleared bluff banner state');
    };
  }, [rivalBluffBannerOpacity, rivalBluffBannerScale]);

  const triggerRivalBluffBanner = useCallback((type: 'got-em' | 'womp-womp' | 'social') => {
    setRivalBluffBannerSecondary(null);
    if (type === 'got-em') {
      const options = [
        'They were bluffing.',
        'Caught the lie.',
        'Bluff exposed.',
        'Nice call.',
        'Too bold.',
        'No mercy.',
        'Bluff punished.',
      ];
      const pick = options[Math.floor(Math.random() * options.length)];
      setRivalBluffBannerSecondary(pick);
    } else if (type === 'womp-womp') {
      const options = [
        'They were telling the truth.',
        'Clean roll.',
        'No bluff there.',
        'Bit too early.',
        'Solid claim.',
        'Bad call.',
        'Too risky.',
      ];
      const pick = options[Math.floor(Math.random() * options.length)];
      setRivalBluffBannerSecondary(pick);
    } else {
      setRivalBluffBannerSecondary(null);
    }

    setRivalBluffBannerType(type);
    setRivalBluffBannerVisible(true);
    rivalBluffBannerOpacity.stopAnimation();
    rivalBluffBannerScale.stopAnimation();
    rivalBluffBannerOpacity.setValue(0);
    rivalBluffBannerScale.setValue(0.92);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(rivalBluffBannerOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(rivalBluffBannerScale, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(450),
      Animated.parallel([
        Animated.timing(rivalBluffBannerOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(rivalBluffBannerScale, {
          toValue: 1.05,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setRivalBluffBannerVisible(false);
      rivalBluffBannerScale.setValue(1);
      setRivalBluffBannerType(null);
      setRivalBluffBannerSecondary(null);
    });
  }, [rivalBluffBannerOpacity, rivalBluffBannerScale]);

  useEffect(() => {
    const nonce = socialBannerNonce ?? 0;
    if (!socialBannerInitializedRef.current) {
      socialBannerInitializedRef.current = true;
      socialBannerNonceRef.current = nonce;
      return;
    }
    if (nonce > socialBannerNonceRef.current) {
      triggerRivalBluffBanner('social');
    }
    socialBannerNonceRef.current = nonce;
  }, [socialBannerNonce, triggerRivalBluffBanner]);

  useEffect(() => {
    const nonce = bluffResultNonce ?? 0;
    if (!bluffResultInitializedRef.current) {
      bluffResultInitializedRef.current = true;
      bluffResultNonceRef.current = nonce;
      return;
    }
    if (!nonce || nonce <= bluffResultNonceRef.current) return;
    bluffResultNonceRef.current = nonce;
    if (lastBluffCaller !== 'cpu') return;
    if (typeof lastBluffDefenderTruth !== 'boolean') return;
    triggerRivalBluffBanner(lastBluffDefenderTruth ? 'got-em' : 'womp-womp');
  }, [bluffResultNonce, lastBluffCaller, lastBluffDefenderTruth, triggerRivalBluffBanner]);

  function handleRollOrClaim() {
    if (__DEV__) {
      console.log('[SURVIVAL][ACTION] handleRollOrClaim:start', {
        turn,
        gameOver,
        isBusy,
        turnLock,
        isSurvivalOver,
        hasRolled,
        mustBluff,
        lastPlayerRoll,
        lastClaimValue,
      });
      logSurvivalSnapshot('handleRollOrClaim:start');
    }
    if (controlsDisabled || isRevealAnimating) {
      console.log('SURVIVAL: handleRollOrClaim blocked', { turn, gameOver, isBusy, turnLock, isSurvivalOver });
      return;
    }

    if (hasRolled && !mustBluff && lastPlayerRoll != null) {
      console.log('SURVIVAL: claiming current roll', { claim: lastPlayerRoll, lastClaimValue });
      playerClaim(lastPlayerRoll);
      if (__DEV__) {
        console.log('[SURVIVAL][ACTION] handleRollOrClaim:end (claimed roll)', {
          claim: lastPlayerRoll,
        });
        logSurvivalSnapshot('handleRollOrClaim:end-claim');
      }
      return;
    }

    if (hasRolled && mustBluff) {
      console.log('SURVIVAL: must bluff, cannot auto-claim', { lastClaimValue });
      if (__DEV__) {
        console.log('[SURVIVAL][ACTION] handleRollOrClaim:end (must bluff)', {
          lastClaimValue,
        });
        logSurvivalSnapshot('handleRollOrClaim:end-must-bluff');
      }
      return;
    }

    console.log('SURVIVAL: rolling dice', { turn, lastClaimValue, hasRolled });
    setRollingAnim(true);
    playerRoll();
    setTimeout(() => setRollingAnim(false), 400);
    if (__DEV__) {
      console.log('[SURVIVAL][ACTION] handleRollOrClaim:end (rolled)', {
        turn,
      });
      logSurvivalSnapshot('handleRollOrClaim:end-roll');
    }
  }

  const handlePrimaryAction = useCallback(() => {
    if (streakEnded) {
      letterAttemptUsedRef.current = false;
      lastProcessedRollRef.current = null;
      restartSurvival();
      return;
    }

    handleRollOrClaim();
  }, [streakEnded, restartSurvival, handleRollOrClaim]);

  const primaryLabel = streakEnded
    ? 'New Game'
    : hasRolled && !mustBluff
      ? 'Claim Roll'
      : 'Roll';

  function handleCallBluff() {
    if (__DEV__) {
      console.log('[SURVIVAL][ACTION] handleCallBluff:start', {
        turn,
        gameOver,
        isBusy,
        turnLock,
        isSurvivalOver,
        lastClaim,
        lastCpuRoll,
      });
      logSurvivalSnapshot('handleCallBluff:start');
    }
    if (controlsDisabled) {
      console.log('SURVIVAL: call bluff blocked', { turn, gameOver, isBusy, turnLock, isSurvivalOver });
      return;
    }
    console.log("BLUFF: Player called Rival's bluff (Survival)", { lastClaim, lastCpuRoll, lastAction });

    let rivalToldTruth: boolean | null = null;
    if (lastClaim != null && lastCpuRoll != null) {
      const { outcome } = resolveBluff(lastClaim, lastCpuRoll, lastAction === 'reverseVsMexican');
      rivalToldTruth = outcome === -1;
      console.log('BLUFF: showdown snapshot (Survival)', {
        claim: lastClaim,
        actual: lastCpuRoll,
        prevWasReverseVsMexican: lastAction === 'reverseVsMexican',
        rivalToldTruth,
      });
    } else {
      console.log('BLUFF: missing data to precompute truth; using default reveal path (Survival)');
    }

    console.log('BLUFF: Revealing Rival dice regardless of truth state (Survival)');
    cpuBluffResolveInFlightRef.current = true;
    setIsRevealAnimating(true);
    setShouldRevealCpuDice(true);
    setPendingCpuBluffResolution(true);
    setCpuDiceRevealed(true);
    if (rivalToldTruth === false) {
      triggerRivalBluffBanner('got-em');
    } else if (rivalToldTruth === true) {
      triggerRivalBluffBanner('womp-womp');
    }
    if (__DEV__) {
      console.log('[SURVIVAL][ACTION] handleCallBluff:end', {
        rivalToldTruth,
      });
      logSurvivalSnapshot('handleCallBluff:end');
    }
  }

  function handleOpenBluff() {
    if (__DEV__) {
      console.log('[SURVIVAL][ACTION] handleOpenBluff:start', {
        controlsDisabled,
        claimPickerOpen,
      });
      logSurvivalSnapshot('handleOpenBluff:start');
    }
    if (controlsDisabled) return;
    setClaimPickerOpen(true);
    if (__DEV__) {
      console.log('[SURVIVAL][ACTION] handleOpenBluff:end');
      logSurvivalSnapshot('handleOpenBluff:end');
    }
  }

  function handleSelectClaim(claim: number) {
    if (__DEV__) {
      console.log('[SURVIVAL][ACTION] handleSelectClaim:start', {
        claim,
        controlsDisabled,
      });
      logSurvivalSnapshot('handleSelectClaim:start');
    }
    if (controlsDisabled) return;
    playerClaim(claim);
    setClaimPickerOpen(false);
    if (__DEV__) {
      console.log('[SURVIVAL][ACTION] handleSelectClaim:end', { claim });
      logSurvivalSnapshot('handleSelectClaim:end');
    }
  }

  const resolveCpuBluffOnce = useCallback(
    (source: 'reveal-complete' | 'fallback') => {
      if (pendingCpuBluffTimeoutRef.current) {
        clearTimeout(pendingCpuBluffTimeoutRef.current);
        pendingCpuBluffTimeoutRef.current = null;
      }
      if (!cpuBluffResolveInFlightRef.current) {
        if (__DEV__) {
          console.log('[SURVIVAL][CPU BLUFF RESOLVE] skipped duplicate', { source });
        }
        return;
      }
      cpuBluffResolveInFlightRef.current = false;
      if (__DEV__) {
        console.log('[SURVIVAL][CPU BLUFF RESOLVE] resolving', { source });
      }
      callBluff();
      setPendingCpuBluffResolution(false);
      setShouldRevealCpuDice(false);
      setIsRevealAnimating(false);
    },
    [callBluff]
  );

  const handleCpuRevealComplete = useCallback(() => {
    resolveCpuBluffOnce('reveal-complete');
  }, [resolveCpuBluffOnce]);

  const handleSocialRevealComplete = useCallback(() => {
    setShowSocialReveal(false);
    setSocialRevealHidden(true);
    setIsRevealAnimating(false);
  }, []);

  useEffect(() => {
    if (!pendingCpuBluffResolution) {
      if (pendingCpuBluffTimeoutRef.current) {
        clearTimeout(pendingCpuBluffTimeoutRef.current);
        pendingCpuBluffTimeoutRef.current = null;
      }
      return;
    }

    if (pendingCpuBluffTimeoutRef.current) {
      clearTimeout(pendingCpuBluffTimeoutRef.current);
    }

    pendingCpuBluffTimeoutRef.current = setTimeout(() => {
      if (__DEV__) {
        console.log('[SURVIVAL DEBUG] Fallback resolving pending CPU bluff', {
          turn,
          pendingCpuBluffResolution,
          shouldRevealCpuDice,
          isRevealAnimating,
          lastClaim,
          lastPlayerRoll,
          lastCpuRoll,
        });
      }
      resolveCpuBluffOnce('fallback');
    }, 1200);
  }, [
    pendingCpuBluffResolution,
    resolveCpuBluffOnce,
    turn,
    shouldRevealCpuDice,
    isRevealAnimating,
    lastClaim,
    lastPlayerRoll,
    lastCpuRoll,
  ]);

  useEffect(() => {
    const nonce = cpuSocialRevealNonce;
    const dice = cpuSocialDice;

    console.log('[CPU SOCIAL REVEAL] effect', {
      source: 'survival.tsx',
      nonce,
      refNonce: socialRevealNonceRef.current,
      dice,
    });

    if (socialRevealNonceRef.current == null) {
      socialRevealNonceRef.current = nonce ?? 0;
      return;
    }

    if (nonce != null && dice && nonce > socialRevealNonceRef.current) {
      console.log('[CPU SOCIAL REVEAL] starting reveal due to nonce bump');
      socialRevealNonceRef.current = nonce;
      setSocialDiceValues(dice);
      setShowSocialReveal(true);
      setSocialRevealHidden(true);
      setIsRevealAnimating(true);
      requestAnimationFrame(() => setSocialRevealHidden(false));
    }
  }, [cpuSocialDice, cpuSocialRevealNonce]);

  // Debug: lifecycle + initialization trace
  const initialStateLoggedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (__DEV__) {
        console.log('SURVIVAL: screen focused');
      }
      letterAttemptUsedRef.current = false;
      lastProcessedRollRef.current = null;
      startSurvival();
      return () => {
        if (__DEV__) {
          console.log('SURVIVAL: screen blurred -> stopSurvival()');
        }
        stopSurvival();
      };
    }, [startSurvival, stopSurvival])
  );

  useEffect(() => {
    if (initialStateLoggedRef.current) return;
    console.log('SURVIVAL: initial store snapshot', {
      turn,
      gameOver,
      isBusy,
      turnLock,
      isSurvivalOver,
      lastClaim,
      lastPlayerRoll,
      lastCpuRoll,
      currentStreak,
      survivalClaimsCount: survivalClaims?.length ?? 0,
    });
    initialStateLoggedRef.current = true;
  }, [
    turn,
    gameOver,
    isBusy,
    turnLock,
    isSurvivalOver,
    lastClaim,
    lastPlayerRoll,
    lastCpuRoll,
    currentStreak,
    survivalClaims,
  ]);

  return (
    <View style={styles.root}>
      <FeltBackground>
        <SafeAreaView style={styles.safe}>
          {rivalBluffBannerVisible && rivalBluffBannerType && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.gotEmBannerContainer,
                {
                  opacity: rivalBluffBannerOpacity,
                  transform: [{ scale: rivalBluffBannerScale }],
                },
              ]}
            >
              <View
                style={[
                  styles.bluffBanner,
                  currentBluffBannerStyle,
                ]}
              >
                {!!currentBluffBannerPrimary && (
                  <Text style={styles.gotEmBannerText}>
                    {currentBluffBannerPrimary}
                  </Text>
                )}
                {rivalBluffBannerType !== 'social' && !!rivalBluffBannerSecondary && (
                  <Text style={styles.gotEmBannerTextSecondary}>
                    {rivalBluffBannerSecondary}
                  </Text>
                )}
              </View>
            </Animated.View>
          )}
          <View style={[styles.content, layoutTweaks.contentPadding]}>
            {/* HEADER */}
            <View style={[styles.headerCard, layoutTweaks.headerPadding]}>
              <Animated.View style={[styles.titleRow, { transform: [{ scale: pulseAnim }] }]}>
                {INFERNO_SLOTS.map((slot, index) => (
                  <Text
                    key={`${slot.id}-${index}`}
                    style={[
                      styles.title,
                      styles.titleLetter,
                      collectedSlots.has(slot.id) && styles.titleLetterCollected,
                    ]}
                  >
                    {`${slot.char}${index < INFERNO_SLOTS.length - 1 ? ' ' : ''}`}
                  </Text>
                ))}
              </Animated.View>
              <Animated.Text style={[styles.scoreLine, { transform: [{ scale: pulseAnim }, { scale: streakScaleAnim }], color: dynamicScoreColor, opacity: streakFlashAnim }]}>Your Best: {bestStreak} | Global Best: {globalBest}</Animated.Text>
              {claimText ? (
                <Text style={[styles.subtle, isSmallScreen && styles.subtleSmall]}>{claimText}</Text>
              ) : (
                <Text style={[styles.subtle, isSmallScreen && styles.subtleSmall]}>No active claim yet.</Text>
              )}
              <View style={[styles.narrationContainer, layoutTweaks.narrationHeight]}>
                <InlineFlameText
                  text={narration || 'Ready to roll.'}
                  style={[styles.status, isSmallScreen && styles.statusSmall]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  iconSize={18}
                />
              </View>
            </View>

            <StreakMeter
              currentStreak={currentStreak}
              globalBest={globalBest}
              isSurvivalOver={isSurvivalOver}
              compact={isSmallScreen}
            />

            {/* HISTORY BOX */}
            <Pressable
              onPress={() => setHistoryModalOpen(true)}
              hitSlop={10}
              style={({ pressed }) => [
                styles.historyBox,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Animated.View style={{ opacity: fadeAnim }}>
                {survivalClaims && survivalClaims.length > 0 ? (
                  [...survivalClaims.slice(-2)].reverse().map((h, i) => {
                    if (h.type === 'event') {
                      return (
                        <InlineFlameText
                          key={i}
                          text={h.text}
                          style={styles.historyText}
                          numberOfLines={1}
                          iconSize={14}
                        />
                      );
                    }
                    const actor = h.who === 'player' ? 'You' : 'Infernoman';
                    const verb = h.claim === 41 ? 'rolled' : 'claimed';
                    const claimText =
                      h.claim === 21 ? `21 (Inferno${MEXICAN_ICON})` : formatClaimDetailed(h.claim);
                    return (
                      <InlineFlameText
                        key={i}
                        text={`${actor} ${verb} ${claimText}`}
                        style={styles.historyText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        iconSize={16}
                      />
                    );
                  })
                ) : (
                  <Text style={styles.historyText}>No recent events.</Text>
                )}
              </Animated.View>
            </Pressable>

            {/* DICE BLOCK */}
            <Animated.View
              testID="dice-area"
              style={[
                styles.diceArea,
                layoutTweaks.diceArea,
                {
                  transform: [
                    { translateY: diceJiggleAnim },
                    { translateX: screenShakeAnim },
                    {
                      rotate: screenTiltAnim.interpolate({
                        inputRange: [-1, 1],
                        outputRange: ['-1rad', '1rad'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.diceRow}>
                {showCpuThinking ? (
                  <>
                    <Dice
                      value={null}
                      size={DIE_SIZE}
                      thinkingOverlay="rival"
                      angryThinking={angryRivalThinking}
                    />
                    <View style={{ width: DICE_SPACING }} />
                    <Dice
                      value={null}
                      size={DIE_SIZE}
                      thinkingOverlay="thought"
                      angryThinking={angryRivalThinking}
                    />
                  </>
                ) : showSocialReveal ? (
                  <AnimatedDiceReveal
                    hidden={socialRevealHidden}
                    diceValues={socialDiceValues}
                    onRevealComplete={handleSocialRevealComplete}
                  />
                ) : showCpuRevealDice ? (
                  <AnimatedDiceReveal
                    hidden={!cpuDiceRevealed}
                    diceValues={[cpuHi, cpuLo]}
                    onRevealComplete={handleCpuRevealComplete}
                  />
                ) : (
                  <>
                    <Dice
                      value={turn === 'player' ? playerHi : cpuHi}
                      rolling={rolling}
                      displayMode={diceDisplayMode}
                      overlayText={diceDisplayMode === 'prompt' ? 'Your' : undefined}
                    />
                    <View style={{ width: DICE_SPACING }} />
                    <Dice
                      value={turn === 'player' ? playerLo : cpuLo}
                      rolling={rolling}
                      displayMode={diceDisplayMode}
                      overlayText={diceDisplayMode === 'prompt' ? 'Roll' : undefined}
                    />
                  </>
                )}
              </View>
            </Animated.View>

            {/* ACTION BAR */}
            <View style={[styles.controls, layoutTweaks.controlsSpacing]}>
              <View style={styles.actionRow}>
                <StyledButton
                  label={primaryLabel}
                  variant="success"
                  onPress={handlePrimaryAction}
                  style={[
                    styles.btn,
                    streakEnded ? styles.survivalPrimaryNewGame : styles.menuActionButtonSuccess,
                  ]}
                  disabled={
                    streakEnded
                      ? false
                      : controlsDisabled ||
                        isRevealAnimating ||
                        (hasRolled && !canClaimTruthfully)
                  }
                />
                <StyledButton
                  label="Call Bluff"
                  variant="primary"
                  onPress={hasClaim ? handleCallBluff : undefined}
                  style={[
                    styles.btn,
                    styles.menuActionButton,
                    !hasClaim && { opacity: 0.4 },
                  ]}
                  disabled={controlsDisabled || hasRolled || !hasClaim}
                />
              </View>

              <View style={styles.bottomRow}>
                <StyledButton
                  label="Bluff Options"
                  variant="outline"
                  onPress={handleOpenBluff}
                  style={[styles.btnWide, shouldHighlightBluff && styles.bluffOptionsHighlightButton]}
                  disabled={controlsDisabled || isRevealAnimating}
                />
              </View>

              <View style={styles.bottomRow}>
                <StyledButton
                  label="Settings"
                  variant="ghost"
                  onPress={() => setSettingsOpen(true)}
                  style={[styles.btn, styles.newGameBtn]}
                  textStyle={styles.footerButtonTextSmall}
                />
                <StyledButton
                  label="Menu"
                  variant="ghost"
                  onPress={() => router.push('/')}
                  style={[styles.btn, styles.menuBtnBlueOutline]}
                  textStyle={styles.footerButtonTextSmall}
                />
                <StyledButton
                  label="Rules"
                  variant="ghost"
                  onPress={() => setRulesOpen(true)}
                  style={[styles.btn, styles.newGameBtn]}
                  textStyle={styles.footerButtonTextSmall}
                />
              </View>
            </View>

            {/* FOOTER REMOVED: View Rules button omitted for Survival mode */}
          </View>

          <BluffModal
            visible={claimPickerOpen}
            options={claimOptions}
            onCancel={() => setClaimPickerOpen(false)}
            onSelect={handleSelectClaim}
            canShowSocial={hasRolled && lastPlayerRoll === 41}
            onShowSocial={() => handleSelectClaim(41)}
          />

          <Modal
            visible={infernoLetterModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setInfernoLetterModalOpen(false)}
          >
            <View style={styles.modalBackdrop} />
            <View style={styles.modalCenter}>
              <View style={styles.letterModalContent}>
                <Text style={styles.letterModalTitle}>Inferno Letter!</Text>
                <Text style={styles.letterModalMessage}>You rolled an Inferno!</Text>
                <Text style={styles.letterModalLetter}>
                  {infernoLetterModalSlot ? getInfernoSlotChar(infernoLetterModalSlot) : ''}
                </Text>
                <Text style={styles.letterModalProgress}>
                  {infernoLetterModalProgress}/7 collected
                </Text>
                {infernoLetterModalIsIntro && (
                  <Text style={styles.letterModalBody}>
                    Collect letters by rolling 21s in Inferno Mode. Fill INFERNO to unlock a
                    badge.
                  </Text>
                )}
                <StyledButton
                  label="Nice"
                  variant="success"
                  onPress={() => setInfernoLetterModalOpen(false)}
                  style={[styles.modalActionButton, styles.menuActionButtonSuccess]}
                />
              </View>
            </View>
          </Modal>

          {/* EXPANDABLE HISTORY MODAL */}
          <Modal
            visible={historyModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setHistoryModalOpen(false)}
          >
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setHistoryModalOpen(false)}
            />
            <View style={styles.modalCenter}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Last 10 events</Text>
                  <Pressable
                    onPress={() => setHistoryModalOpen(false)}
                    style={({ pressed }) => [
                      styles.closeButton,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </Pressable>
                </View>
                <View style={styles.modalHistoryList}>
                  {survivalClaims && survivalClaims.length > 0 ? (
                    [...survivalClaims].reverse().map((h, i) => {
                      if (h.type === 'event') {
                        return (
                          <View key={i} style={styles.historyItem}>
                            <InlineFlameText text={h.text} style={styles.historyItemText} iconSize={16} />
                          </View>
                        );
                      }
                      const actor = h.who === 'player' ? 'You' : 'Infernoman';
                      const verb = h.claim === 41 ? 'rolled' : 'claimed';
                      const claimText =
                        h.claim === 21 ? `21 (Inferno${MEXICAN_ICON})` : formatClaimDetailed(h.claim);
                      return (
                        <View key={i} style={styles.historyItem}>
                          <InlineFlameText
                            text={`${actor} ${verb} ${claimText}`}
                            style={styles.historyItemText}
                            iconSize={18}
                          />
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.noHistoryText}>No history yet.</Text>
                  )}
                </View>
              </View>
            </View>
          </Modal>

          <Modal
            visible={rulesOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setRulesOpen(false)}
          >
            <Pressable style={styles.rulesBackdrop} onPress={() => setRulesOpen(false)} />
            <View style={styles.rulesCenter}>
              <View style={styles.rulesContent}>
                <View style={styles.rulesHeader}>
                  <Text style={styles.rulesTitle}>Game Rules</Text>
                  <Pressable onPress={() => setRulesOpen(false)} style={styles.rulesCloseButton}>
                    <Text style={styles.rulesClose}>✕</Text>
                  </Pressable>
                </View>
                <ScrollView style={styles.rulesScroll} showsVerticalScrollIndicator={false}>
                  <SurvivalRulesContent />
                </ScrollView>
              </View>
            </View>
          </Modal>

          <Modal
            visible={settingsOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setSettingsOpen(false)}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setSettingsOpen(false)} />
            <View style={styles.modalCenter}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Settings</Text>
                  <Pressable onPress={() => setSettingsOpen(false)} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>✕</Text>
                  </Pressable>
                </View>

                <View style={styles.settingsRow}>
                  <Text style={styles.settingsLabel}>Vibration</Text>
                  <Switch
                    value={hapticsEnabled}
                    onValueChange={(value) => {
                      void setHapticsEnabled(value);
                    }}
                    trackColor={{ false: '#4A4E54', true: '#53A7F3' }}
                    thumbColor={hapticsEnabled ? '#1C75BC' : '#9BA1A6'}
                    ios_backgroundColor="#4A4E54"
                  />
                </View>

                <View style={styles.settingsRow}>
                  <Text style={styles.settingsLabel}>Music</Text>
                  <Switch
                    value={musicEnabled}
                    onValueChange={(value) => {
                      void setMusicEnabled(value);
                    }}
                    trackColor={{ false: '#4A4E54', true: '#53A7F3' }}
                    thumbColor={musicEnabled ? '#1C75BC' : '#9BA1A6'}
                    ios_backgroundColor="#4A4E54"
                  />
                </View>

                <View style={styles.settingsRow}>
                  <Text style={styles.settingsLabel}>Sound Effects</Text>
                  <Switch
                    value={sfxEnabled}
                    onValueChange={(value) => {
                      void setSfxEnabled(value);
                    }}
                    trackColor={{ false: '#4A4E54', true: '#53A7F3' }}
                    thumbColor={sfxEnabled ? '#1C75BC' : '#9BA1A6'}
                    ios_backgroundColor="#4A4E54"
                  />
                </View>
              </View>
            </View>
          </Modal>

          <Modal
            visible={introVisible}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setIntroVisible(false);
              void setHasSeenSurvivalIntro(true);
            }}
          >
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => {
                setIntroVisible(false);
                void setHasSeenSurvivalIntro(true);
              }}
            />
            <View style={styles.modalCenter}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Inferno Survival</Text>
                  <Pressable
                    onPress={() => {
                      setIntroVisible(false);
                      void setHasSeenSurvivalIntro(true);
                    }}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </Pressable>
                </View>

                <View style={styles.modalBody}>
                  <Text style={styles.modalMessage}>
                    How long can you survive in the inferno without losing a point??
                  </Text>
                </View>

                <StyledButton
                  label="Let’s Find Out"
                  variant="success"
                  onPress={() => {
                    setIntroVisible(false);
                    void setHasSeenSurvivalIntro(true);
                  }}
                  style={[styles.modalActionButton, styles.menuActionButtonSuccess]}
                />
              </View>
            </View>
          </Modal>

        </SafeAreaView>
      </FeltBackground>
      {/* Celebration Overlay */}
      <StreakCelebrationOverlay
        visible={celebrationVisible}
        title={celebrationTitle}
        mode={celebrationMode}
        onHide={() => setCelebrationVisible(false)}
      />
      
      {plusOneVisible && (
        <View style={styles.plusOneOverlay} pointerEvents="none">
          <Text style={styles.plusOneText}>+{plusOneAmount}</Text>
        </View>
      )}

      {/* Screen effects overlays */}
      {/* Dim overlay for new leader */}
      <Animated.View
        style={[
          styles.screenOverlay,
          { backgroundColor: 'black', opacity: dimAnim },
        ]}
        pointerEvents="none"
      />
      
      {/* Red edge flash for 10-streak */}
      <Animated.View
        style={[
          styles.screenOverlay,
          { 
            borderWidth: 8,
            borderColor: '#FF0000',
            opacity: edgeFlashAnim,
          },
        ]}
        pointerEvents="none"
      />

      {/* Gold pulse aura for 20-streak */}
      <Animated.View
        style={[
          styles.screenOverlay,
          {
            backgroundColor: '#FFD700',
            opacity: goldPulseAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.3],
            }),
          },
        ]}
        pointerEvents="none"
      />

      {/* Fiery flash for 25-streak */}
      <Animated.View
        style={[
          styles.screenOverlay,
          {
            borderWidth: 12,
            borderColor: '#FF6600',
            opacity: fieryFlashAnim,
          },
        ]}
        pointerEvents="none"
      />

      {/* Alarm flash for 30-streak */}
      <Animated.View
        style={[
          styles.screenOverlay,
          {
            backgroundColor: '#FF0000',
            opacity: alarmFlashAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.4],
            }),
          },
        ]}
        pointerEvents="none"
      />

      {/* Electric jolt overlay for 35-streak */}
      <Animated.View
        style={[
          styles.screenOverlay,
          {
            transform: [{ translateX: electricJoltAnim }],
          },
        ]}
        pointerEvents="none"
      >
        <Animated.View
          style={[
            styles.screenOverlay,
            {
              backgroundColor: '#00FFFF',
              opacity: electricJoltOpacityAnim,
            },
          ]}
        />
      </Animated.View>

      {/* Dark vortex pulse for 40-streak */}
      <Animated.View
        style={[
          styles.screenOverlay,
          {
            backgroundColor: '#000000',
            opacity: vortexPulseAnim,
          },
        ]}
        pointerEvents="none"
      />
    </View>
  );
}

const PLUS_ONE_FLASHES = 5;
const PLUS_ONE_TOTAL_DURATION = 800; // matches previous emoji burst timing
const PLUS_ONE_FLASH_INTERVAL = PLUS_ONE_TOTAL_DURATION / (PLUS_ONE_FLASHES * 2);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1117' },
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  headerCard: {
    backgroundColor: '#161B22',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  title: {
    color: '#F0F6FC',
    fontWeight: '800',
    fontSize: 28,
    marginBottom: 4,
    textAlign: 'center',
  },
  titleSegment: {
    marginHorizontal: 4,
  },
  titleLetter: {
    marginHorizontal: 2,
  },
  titleLetterCollected: {
    color: '#FE9902',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  scoreLine: {
    color: '#F0F6FC',
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  subtle: {
    color: '#FE9902',
    fontWeight: '800',
    fontSize: Platform.select({
      ios: 18,
      web: 18,
      android: 14,
      default: 18,
    }),
    marginBottom: 6,
    textAlign: 'center',
  },
  subtleSmall: {
    fontSize: 16,
  },
  status: {
    color: '#F0F6FC',
    opacity: 0.95,
    textAlign: 'center',
  },
  statusSmall: {
    fontSize: 14,
  },
  narrationContainer: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  diceArea: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: DIE_SIZE * 2.6,
    marginTop: -DIE_SIZE * 1.34,
    marginBottom: DIE_SIZE * 0.2,
  },
  diceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakMeterContainer: {
    alignSelf: 'center',
    width: '90%',
    marginTop: 8,
    marginBottom: 4,
  },
  streakMeterContainerCompact: {
    marginTop: 4,
    marginBottom: 2,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  streakLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
    minWidth: 70,
  },
  recordLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    minWidth: 70,
    textAlign: 'right',
  },
  streakMeter: {
    flex: 1,
    marginHorizontal: 4,
  },
  streakMeterOuter: {
    flex: 1,
    height: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#30363D',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingLeft: 2,
  },
  streakMeterFill: {
    height: '100%',
    borderRadius: 999,
  },
  streakMeterLabels: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakMeterThermoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  streakMeterBulbWrapper: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
    zIndex: 2,
  },
  streakMeterBulb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: '#30363D',
  },
  streakMeterLabelText: {
    color: '#8B949E',
    fontSize: 11,
  },
  streakGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  controls: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: -DIE_SIZE * 1.5,
    position: 'relative',
    zIndex: 10,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  btn: { flex: 1 },
  menuActionButton: {
    backgroundColor: '#C21807',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8B0000',
  },
  menuActionButtonSuccess: {
    backgroundColor: '#42C6FF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1E8AC4',
  },
  survivalPrimaryNewGame: {
    backgroundColor: '#FE9902',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#A87F00',
  },
  newGameBtn: {
    borderWidth: 2,
    borderColor: '#B26B01',
  },
  menuBtnBlueOutline: {
    borderWidth: 2,
    borderColor: '#1E8AC4',
    borderRadius: 12,
  },
  bluffOptionsHighlightButton: {
    backgroundColor: '#FE9902',
    borderColor: '#C87400',
    borderWidth: 2,
    borderRadius: 12,
  },
  btnWide: { flex: 1 },
  rollHelper: {
    color: '#F8E9A1',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  historyBox: {
    alignSelf: 'center',
    width: '70%',
    minHeight: 72,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: '#30363D',
    borderWidth: 2,
    borderRadius: 6,
    padding: 10,
    marginTop: 12,
    marginBottom: 10,
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  historyText: {
    color: '#F0F6FC',
    textAlign: 'center',
    fontSize: 13,
    marginVertical: 2,
  },
  historyIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  iconPlayer: {
    color: '#FF6B6B',
    fontWeight: '700',
  },
  iconCpu: {
    color: '#6BFF89',
    fontWeight: '700',
  },
  plusOneOverlay: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  plusOneText: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FE9902',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  gotEmBannerContainer: {
    position: 'absolute',
    top: 270,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 25,
  },
  bluffBanner: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  bluffBannerSuccess: {
    backgroundColor: '#53A7F3',
    borderColor: '#1C75BC',
  },
  bluffBannerFail: {
    backgroundColor: '#E63946',
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  bluffBannerSocial: {
    backgroundColor: '#C0C0C0',
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  gotEmBannerText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  gotEmBannerTextSecondary: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 20,
    maxHeight: '70%',
    width: '85%',
    borderColor: '#30363D',
    borderWidth: 2,
    zIndex: 1001,
  },
  letterModalContent: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    borderColor: '#30363D',
    borderWidth: 2,
    zIndex: 1001,
    alignItems: 'center',
  },
  letterModalTitle: {
    color: '#F0F6FC',
    fontWeight: '800',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 6,
  },
  letterModalMessage: {
    color: '#F0F6FC',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  letterModalLetter: {
    color: '#FE9902',
    fontSize: 64,
    fontWeight: '900',
    textAlign: 'center',
    marginVertical: 6,
  },
  letterModalProgress: {
    color: '#F0F6FC',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  letterModalBody: {
    color: '#F0F6FC',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#F0F6FC',
    fontWeight: '800',
    fontSize: 18,
  },
  modalBody: {
    marginBottom: 8,
  },
  modalMessage: {
    color: '#F0F6FC',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalActionButton: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#F0F6FC',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalHistoryList: {
    maxHeight: 400,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 8,
    paddingHorizontal: 8,
  },
  historyItemIcon: {
    fontSize: 16,
    marginRight: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  historyItemText: {
    color: '#F0F6FC',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  noHistoryText: {
    color: '#8B949E',
    textAlign: 'center',
    fontSize: 14,
    marginVertical: 20,
  },
  celebrationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationTitleIcon: {
    marginRight: 10,
  },
  celebrationTitleText: {
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  rulesBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  rulesCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rulesContent: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxHeight: '75%',
    borderColor: '#30363D',
    borderWidth: 2,
  },
  rulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rulesTitle: {
    color: '#F0F6FC',
    fontWeight: '800',
    fontSize: 20,
  },
  rulesCloseButton: {
    padding: 4,
  },
  rulesClose: {
    color: '#F0F6FC',
    fontSize: 22,
    fontWeight: '700',
  },
  rulesScroll: {
    maxHeight: '100%',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingsLabel: {
    color: '#F0F6FC',
    fontSize: 16,
    fontWeight: '600',
  },
  footerButtonTextSmall: {
    fontSize: 14,
  },
  screenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
});
