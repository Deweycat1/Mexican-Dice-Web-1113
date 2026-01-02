import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
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
import AsyncStorage from '@react-native-async-storage/async-storage';

import BluffModal from '../src/components/BluffModal';
import DialogBanner from '../src/components/DialogBanner';
import Dice from '../src/components/Dice';
import FeltBackground from '../src/components/FeltBackground';
import { ScoreDie } from '../src/components/ScoreDie';
import AnimatedDiceReveal from '../src/components/AnimatedDiceReveal';
import StyledButton from '../src/components/StyledButton';
import { FlameEmojiIcon } from '../src/components/FlameEmojiIcon';
import { InlineFlameText } from '../src/components/InlineFlameText';
import RulesContent from '../src/components/RulesContent';
import { MEXICAN_ICON, getNextWompWompMessage } from '../src/lib/constants';
import { logEvent } from '../src/analytics/logEvent';
import {
  compareClaims,
  isAlwaysClaimable,
  isReverseOf,
  rankValue,
  resolveActiveChallenge,
  resolveBluff,
  splitClaim,
} from '../src/engine/mexican';
import { getQuickPlayClaimOptions } from '../src/lib/claimOptionSources';
import { pickRandomLine, rivalPointWinLines, userPointWinLines } from '../src/lib/dialogLines';
import { useGameStore } from '../src/state/useGameStore';
import { useSettingsStore } from '../src/state/useSettingsStore';
import { DIE_SIZE, DICE_SPACING, SCORE_DIE_BASE_SIZE } from '../src/theme/dice';
import ScreenshotTutorial from '../src/tutorial/ScreenshotTutorial';

const TUTORIAL_SEEN_KEY = 'tutorial_seen_v1';
// Set to true temporarily if you want to force the tutorial
// to show again for testing. Leave as false in production.
const FORCE_SHOW_TUTORIAL = false;

// ---------- helpers ----------
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

const rivalOpeningLines = [
  "Fresh fuel for my fire.",
  "Step into the heat.",
  "Welcome to my inferno.",
  "Perfect... something to scorch.",
  "I’ve been warming up for you.",
  "My embers bet against you.",
  "Careful... my dice burn hot.",
  "Brave or flammable... either works.",
  "Warm up... I roll fast.",
  "Let’s spark some chaos.",
  "Ignore the cinder imp... he stares.",
  "Confidence? Cute.",
  "Come closer... feel the heat.",
  "A worthy foe... maybe.",
  "Keep up... flames move quick.",
  "The fire spirits like me.",
  "You've got potential... kindling-level.",
  "Hear that crackle? That’s your fate.",
  "Let’s ignite this round.",
  "Stretch... things heat up fast.",
  "If luck’s a flame, I hold the torch.",
  "Roll boldly... flames enjoy courage.",
  "Hope you enjoy heat.",
  "Ready? My minions burn bright.",
];

const pickRandomRivalLine = () => {
  const index = Math.floor(Math.random() * rivalOpeningLines.length);
  return rivalOpeningLines[index];
};

// End-of-game banner lines
const HEAVENLY_LINES = [
  "Iceman stands undefeated.",
  "Frost crowns your victory.",
  "You froze the flames.",
  "Dice bow to Iceman.",
  "Ice pips, perfect victory.",
  "The table chills for you.",
  "Iceman glides past defeat.",
  "Cool nerves, hot streak.",
];

const DEMONIC_LINES = [
  "Infernoman roasted you.",
  "Infernoman claimed your points.",
  "Burned by Infernoman again.",
  "Infernoman laughs at your loss.",
  "You fueled Infernoman’s fire.",
  "Infernoman turned up the heat on you.",
  "Another win for Infernoman.",
  "Infernoman cooked that round.",
  "Infernoman snatched your points.",
  "You stepped into Infernoman’s fire.",
];

const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

// ------------------------------

export default function Game() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const isSmallScreen = height < 700;
  const isTallScreen = height > 820;
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const musicEnabled = useSettingsStore((state) => state.musicEnabled);
  const sfxEnabled = useSettingsStore((state) => state.sfxEnabled);
  const setHapticsEnabled = useSettingsStore((state) => state.setHapticsEnabled);
  const setMusicEnabled = useSettingsStore((state) => state.setMusicEnabled);
  const setSfxEnabled = useSettingsStore((state) => state.setSfxEnabled);
  const [claimPickerOpen, setClaimPickerOpen] = useState(false);
  const [rollingAnim, setRollingAnim] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [cpuDiceRevealed, setCpuDiceRevealed] = useState(false);
  const [pendingCpuBluffResolution, setPendingCpuBluffResolution] = useState(false);
  const [scoreDiceAnimKey, setScoreDiceAnimKey] = useState(0);
  const socialRevealNonceRef = useRef<number | null>(null);
  const socialBannerNonceRef = useRef(0);
  const [showSocialReveal, setShowSocialReveal] = useState(false);
  const [socialDiceValues, setSocialDiceValues] = useState<[number | null, number | null]>([null, null]);
  const [socialRevealHidden, setSocialRevealHidden] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialFirstSeenRef = useRef(false);

  // Rival opening taunt state
  const [hasRolledThisGame, setHasRolledThisGame] = useState<boolean>(false);
  const [shouldRevealCpuDice, setShouldRevealCpuDice] = useState(false);
  const [rivalBluffBannerVisible, setRivalBluffBannerVisible] = useState(false);
  const [rivalBluffBannerType, setRivalBluffBannerType] = useState<'got-em' | 'womp-womp' | 'social' | null>(null);
  const [rivalBluffBannerSecondary, setRivalBluffBannerSecondary] = useState<string | null>(null);
  const lastWompWompIndexRef = useRef(-1);
  const rivalBluffBannerOpacity = useRef(new Animated.Value(0)).current;
  const rivalBluffBannerScale = useRef(new Animated.Value(0.95)).current;
  const [isRevealAnimating, setIsRevealAnimating] = useState(false);

  // End-of-game banner state
  type EndBannerType = 'win' | 'lose' | null;
  const [endBannerType, setEndBannerType] = useState<EndBannerType>(null);
  const [endBannerLine, setEndBannerLine] = useState<string>('');
  const endBannerOpacity = useRef(new Animated.Value(0)).current;
  const endBannerTranslateY = useRef(new Animated.Value(10)).current;

  // Score loss animation values
  const userScoreAnim = useRef(new Animated.Value(0)).current;
  const rivalScoreAnim = useRef(new Animated.Value(0)).current;

  // Dialog system
  type Speaker = 'user' | 'rival';
  const [dialogSpeaker, setDialogSpeaker] = useState<Speaker | null>(null);
  const [dialogLine, setDialogLine] = useState<string | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const dialogAnim = useRef(new Animated.Value(0)).current;

  const {
    playerScore,
    cpuScore,
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
    newGame,
    buildBanner,
    getBaseMessage,
    claims,
    gameOver,
    mustBluff,
    cpuSocialDice,
    cpuSocialRevealNonce,
    socialBannerNonce,
    lastBluffCaller,
    lastBluffDefenderTruth,
    bluffResultNonce,
    mode,
    startQuickPlayMatch,
    exitSurvivalToNormal,
  } = useGameStore();

  const narration = (buildBanner?.() || getBaseMessage() || '').trim();
  const lastClaimValue = resolveActiveChallenge(baselineClaim, lastClaim);

  // Ensure we leave Survival mode whenever the Quick Play screen mounts so claims/event
  // history stay in the normal bucket.
  useFocusEffect(
    useCallback(() => {
      exitSurvivalToNormal();
      startQuickPlayMatch();
    }, [exitSurvivalToNormal, startQuickPlayMatch])
  );

  useEffect(() => {
    let isMounted = true;

    const hydrateTutorial = async () => {
      if (FORCE_SHOW_TUTORIAL) {
        tutorialFirstSeenRef.current = false;
        if (isMounted) setShowTutorial(true);
        return;
      }

      try {
        const stored = await AsyncStorage.getItem(TUTORIAL_SEEN_KEY);
        if (!stored && isMounted) {
          tutorialFirstSeenRef.current = true;
          setShowTutorial(true);
        } else {
          tutorialFirstSeenRef.current = false;
        }
      } catch {
        if (isMounted) {
          tutorialFirstSeenRef.current = true;
          setShowTutorial(true);
        }
      }
    };

    void hydrateTutorial();

    return () => {
      isMounted = false;
    };
  }, []);

  const [playerHi, playerLo] = facesFromRoll(lastPlayerRoll);
  const [cpuHi, cpuLo] = facesFromRoll(lastCpuRoll);
  const rolling = rollingAnim || isRolling;

  const isGameOver = gameOver !== null;
  const controlsDisabled = isGameOver || turn !== 'player' || isBusy || turnLock;
  const showCpuThinking = turn !== 'player' && !isGameOver;
  const lastPlayerClaim = useMemo(() => {
    if (!claims || claims.length === 0) return null;
    for (let i = claims.length - 1; i >= 0; i -= 1) {
      const entry = claims[i];
      if (entry?.type === 'claim') return entry;
    }
    return null;
  }, [claims]);
  const angryRivalThinking =
    showCpuThinking &&
    lastPlayerClaim?.type === 'claim' &&
    lastPlayerClaim.who === 'player' &&
    lastPlayerClaim.claim === 21;
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
  const hasClaim = lastClaimValue != null;
  const shouldHighlightBluff =
    hasRolled &&
    rolledValue !== null &&
    lastClaimValue != null &&
    rankValue(rolledValue) <= rankValue(lastClaimValue);
  const layoutTweaks = useMemo(
    () => ({
      contentPadding: {
        paddingHorizontal: isSmallScreen ? 12 : 18,
        paddingBottom: isSmallScreen ? 12 : 20,
        paddingTop: isSmallScreen ? 6 : 12,
      },
      headerPadding: {
        padding: isSmallScreen ? 12 : 14,
      },
      headerRowSpacing: {
        marginBottom: isSmallScreen ? 8 : 12,
      },
      narrationHeight: {
        minHeight: isSmallScreen ? 48 : 60,
      },
      diceArea: {
        minHeight: isTallScreen ? DIE_SIZE * 3 : isSmallScreen ? DIE_SIZE * 2.2 : DIE_SIZE * 2.6,
        marginTop: isSmallScreen ? -DIE_SIZE * 0.9 : -DIE_SIZE * 1.34,
        marginBottom: isTallScreen ? DIE_SIZE * 0.1 : 0,
        paddingVertical: isTallScreen ? 12 : 0,
      },
      controlsSpacing: {
        marginTop: isSmallScreen ? -DIE_SIZE * 1.1 : isTallScreen ? -DIE_SIZE * 1.3 : -DIE_SIZE * 1.5,
        paddingVertical: isSmallScreen ? 10 : 14,
      },
    }),
    [isSmallScreen, isTallScreen]
  );

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

  const showCpuRevealDice =
    !isGameOver &&
    turn === 'player' &&
    lastCpuRoll !== null &&
    lastClaim !== null &&
    lastPlayerRoll === null &&
    shouldRevealCpuDice;

  const currentBluffBannerStyle = useMemo(() => {
    if (rivalBluffBannerType === 'social') return styles.bluffBannerSocial;
    if (rivalBluffBannerType === 'got-em') return styles.bluffBannerSuccess;
    return styles.bluffBannerFail;
  }, [rivalBluffBannerType]);

  const currentBluffBannerPrimary = useMemo(() => {
    if (rivalBluffBannerType === 'social') return '🍻 SOCIAL!!! 🍻';
    if (rivalBluffBannerType === 'got-em') return "GOT 'EM!!!";
    if (rivalBluffBannerType === 'womp-womp') {
      return rivalBluffBannerSecondary ?? 'WOMP WOMP';
    }
    return '';
  }, [rivalBluffBannerSecondary, rivalBluffBannerType]);

  const claimOptions = useMemo(
    () => getQuickPlayClaimOptions(lastClaimValue, lastPlayerRoll),
    [lastClaimValue, lastPlayerRoll]
  );

  useEffect(() => {
    setClaimPickerOpen(false);
  }, [turn]);

  // Reset CPU reveal whenever a new CPU claim/turn hands off to player
  useEffect(() => {
    if (turn === 'player') {
      setCpuDiceRevealed(false);
      setPendingCpuBluffResolution(false);
      setShouldRevealCpuDice(false);
    }
  }, [turn, lastCpuRoll, lastClaim]);

  // Animated fade for history box when it updates
  const fadeAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    // run a quick fade-out/in when claims change
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.15, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [claims, fadeAnim]);

  // Track previous scores to detect losses
  const prevPlayerScore = useRef(playerScore);
  const prevCpuScore = useRef(cpuScore);

  // Dialog system function
  const showDialog = useCallback((speaker: Speaker, line: string) => {
    console.log('showDialog called:', speaker, line);
    setDialogSpeaker(speaker);
    setDialogLine(line);
    setDialogVisible(true);

    dialogAnim.setValue(0);
    Animated.timing(dialogAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      // Auto hide after delay
      setTimeout(() => {
        Animated.timing(dialogAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start(() => {
          setDialogVisible(false);
        });
      }, 2000);
    });
  }, [dialogAnim]);

  // End-of-game banner function
  const showEndBanner = useCallback((type: EndBannerType) => {
    if (!type) return;

    const line = type === 'win' ? pickRandom(HEAVENLY_LINES) : pickRandom(DEMONIC_LINES);

    setEndBannerType(type);
    setEndBannerLine(line);

    // Reset animation state
    endBannerOpacity.setValue(0);
    endBannerTranslateY.setValue(10);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(endBannerOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(endBannerTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(1600), // stay visible; 200 + 1600 + 200 = 2s total
      Animated.parallel([
        Animated.timing(endBannerOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(endBannerTranslateY, {
          toValue: -10,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setEndBannerType(null);
      setEndBannerLine('');
    });
  }, [endBannerOpacity, endBannerTranslateY]);

  // Combined effect for player score changes (animation + dialog)
  useEffect(() => {
    const prevScore = prevPlayerScore.current;
    
    if (playerScore < prevScore && prevScore > 0) {
      // Player lost points
      console.log('Player lost point:', prevScore, '->', playerScore);
      
      // Trigger score animation
      userScoreAnim.setValue(0);
      Animated.sequence([
        Animated.timing(userScoreAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(userScoreAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Rival speaks
      const line = pickRandomLine(rivalPointWinLines);
      console.log('Rival says:', line);
      showDialog('rival', line);
    }
    
    prevPlayerScore.current = playerScore;
  }, [playerScore, userScoreAnim, showDialog]);

  // Combined effect for CPU score changes (animation + dialog)
  useEffect(() => {
    const prevScore = prevCpuScore.current;
    
    if (cpuScore < prevScore && prevScore > 0) {
      // CPU lost points
      console.log('CPU lost point:', prevScore, '->', cpuScore);
      
      // Trigger score animation
      rivalScoreAnim.setValue(0);
      Animated.sequence([
        Animated.timing(rivalScoreAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(rivalScoreAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
      
      // User speaks
      const line = pickRandomLine(userPointWinLines);
      console.log('User says:', line);
      showDialog('user', line);
    }
    
    prevCpuScore.current = cpuScore;
  }, [cpuScore, rivalScoreAnim, showDialog]);

  // Initialize Rival opening taunt on mount
  useEffect(() => {
    const openingLine = pickRandomRivalLine();
    setHasRolledThisGame(false);
    // Show opening taunt in dialog banner
    setTimeout(() => showDialog('rival', openingLine), 500);
  }, [showDialog]);

  // Watch for game over and show appropriate banner
  useEffect(() => {
    if (gameOver === 'player') {
      // Player wins (Rival hit 0 points)
      showEndBanner('win');
    } else if (gameOver === 'cpu') {
      // Player loses (Player hit 0 points)
      showEndBanner('lose');
    }
  }, [gameOver, showEndBanner]);

  const triggerRivalBluffBanner = useCallback((type: 'got-em' | 'womp-womp' | 'social') => {
    setRivalBluffBannerSecondary(null);

    if (type === 'got-em') {
      const options = [
        'They were bluffing.',
        'Caught the lie.',
        'Bluff exposed.',
        'Nice call.',
        'Too bold.',
      ];
      const pick = options[Math.floor(Math.random() * options.length)];
      setRivalBluffBannerSecondary(pick);
    } else if (type === 'womp-womp') {
      const { text } = getNextWompWompMessage(lastWompWompIndexRef);
      setRivalBluffBannerSecondary(text);
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
    if (socialBannerNonce > socialBannerNonceRef.current) {
      triggerRivalBluffBanner('social');
    }
    socialBannerNonceRef.current = socialBannerNonce;
  }, [socialBannerNonce, triggerRivalBluffBanner]);

  useEffect(() => {
    if (!bluffResultNonce) return;
    if (lastBluffCaller !== 'cpu') return;
    if (typeof lastBluffDefenderTruth !== 'boolean') return;
    triggerRivalBluffBanner(lastBluffDefenderTruth ? 'got-em' : 'womp-womp');
  }, [bluffResultNonce, lastBluffCaller, lastBluffDefenderTruth, triggerRivalBluffBanner]);

  function handleRollOrClaim() {
    if (controlsDisabled || isRevealAnimating) return;

    if (hasRolled && !mustBluff && lastPlayerRoll != null) {
      playerClaim(lastPlayerRoll);
      return;
    }

    if (hasRolled && mustBluff) return;

    // Mark first roll complete to disable intro message
    if (!hasRolledThisGame) {
      setHasRolledThisGame(true);
    }

    setRollingAnim(true);
    playerRoll();
    setTimeout(() => setRollingAnim(false), 400);
  }

  function handleCallBluff() {
    if (controlsDisabled) return;
    console.log("BLUFF: Player called Rival's bluff", { lastClaim, lastCpuRoll, lastAction });

    let rivalToldTruth: boolean | null = null;
    if (lastClaim != null && lastCpuRoll != null) {
      const { outcome } = resolveBluff(lastClaim, lastCpuRoll, lastAction === 'reverseVsMexican');
      rivalToldTruth = outcome === -1;
      console.log('BLUFF: showdown snapshot', {
        claim: lastClaim,
        actual: lastCpuRoll,
        prevWasReverseVsMexican: lastAction === 'reverseVsMexican',
        rivalToldTruth,
      });
    } else {
      console.log('BLUFF: missing data to precompute truth; using default reveal path');
    }

    console.log('BLUFF: Revealing Rival dice regardless of truth state');
    setIsRevealAnimating(true);
    setShouldRevealCpuDice(true);
    setPendingCpuBluffResolution(true);
    setCpuDiceRevealed(true);
    if (rivalToldTruth === false) {
      triggerRivalBluffBanner('got-em');
    } else if (rivalToldTruth === true) {
      triggerRivalBluffBanner('womp-womp');
    }
  }

  function handleOpenBluff() {
    if (controlsDisabled) return;
    setClaimPickerOpen(true);
  }

  function handleSelectClaim(claim: number) {
    if (controlsDisabled) return;
    playerClaim(claim);
    setClaimPickerOpen(false);
  }

  const startFreshGame = useCallback(() => {
    newGame();
    setHasRolledThisGame(false);
    // Only bump the animation key on non-Android platforms
    if (Platform.OS !== 'android') {
      setScoreDiceAnimKey((k) => k + 1);
    }
    const openingLine = pickRandomRivalLine();
    setTimeout(() => showDialog('rival', openingLine), 300);
  }, [newGame, setHasRolledThisGame, setScoreDiceAnimKey, showDialog]);

  const handleNewGamePress = useCallback(() => {
    startFreshGame();
  }, [startFreshGame]);

  const handleResetGamePress = useCallback(() => {
    startFreshGame();
    setSettingsOpen(false);
  }, [startFreshGame, setSettingsOpen]);

  const handleCpuRevealComplete = useCallback(() => {
    setIsRevealAnimating(false);
    if (pendingCpuBluffResolution) {
      callBluff();
      setPendingCpuBluffResolution(false);
      setShouldRevealCpuDice(false);
    }
  }, [pendingCpuBluffResolution, callBluff]);

  const handleSocialRevealComplete = useCallback(() => {
    setShowSocialReveal(false);
    setSocialRevealHidden(true);
    setIsRevealAnimating(false);
  }, []);

  useEffect(() => {
    const nonce = cpuSocialRevealNonce;
    const dice = cpuSocialDice;

    console.log('[CPU SOCIAL REVEAL] effect', {
      source: 'game.tsx',
      nonce,
      refNonce: socialRevealNonceRef.current,
      dice,
    });

    // On first mount, just sync the ref to whatever nonce exists
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
      if (Platform.OS === 'android') {
        setSocialRevealHidden(false);
      } else {
        requestAnimationFrame(() => setSocialRevealHidden(false));
      }
    }
  }, [cpuSocialDice, cpuSocialRevealNonce]);

  // Animated interpolations for score loss animation
  const userScoreScale = userScoreAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.25],
  });

  const rivalScoreScale = rivalScoreAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.25],
  });

  const userScoreTranslateY = userScoreAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  const rivalScoreTranslateY = rivalScoreAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  // Dialog animation interpolations
  const dialogOpacity = dialogAnim;
  const dialogTranslateY = dialogAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
  });

  const handleTutorialReplay = useCallback(() => {
    setRulesOpen(false);
    setShowTutorial(true);
  }, []);

  const handleTutorialDone = useCallback(() => {
    setShowTutorial(false);
    if (tutorialFirstSeenRef.current) {
      tutorialFirstSeenRef.current = false;
      logEvent({ eventType: 'tutorial_completed', mode: 'normal' });
    }
    const persist = async () => {
      try {
        await AsyncStorage.setItem(TUTORIAL_SEEN_KEY, '1');
      } catch {
        // ignore persistence failures; tutorial will show again next launch
      }
    };
    void persist();
  }, []);

  return (
    <View style={styles.root}>
      <FeltBackground>
        {/* END-OF-GAME BANNER OVERLAY */}
        {endBannerType && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.endBannerContainer,
              {
                opacity: endBannerOpacity,
                transform: [{ translateY: endBannerTranslateY }],
              },
            ]}
          >
            <View
              style={[
                styles.endBannerContent,
                endBannerType === 'win' ? styles.endBannerWin : styles.endBannerLose,
              ]}
            >
              <Text style={[
                styles.endBannerTitle,
                endBannerType === 'win' ? styles.endBannerTitleWin : styles.endBannerTitleLose
              ]}>
                {endBannerType === 'win' ? 'You win' : 'You lose'}
              </Text>
              {!!endBannerLine && (
                <Text style={[
                  styles.endBannerSubtitle,
                  endBannerType === 'win' ? styles.endBannerSubtitleWin : styles.endBannerSubtitleLose
                ]}>
                  {endBannerLine}
                </Text>
              )}
            </View>
          </Animated.View>
        )}

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
                {rivalBluffBannerType !== 'social' &&
                  rivalBluffBannerType !== 'womp-womp' &&
                  !!rivalBluffBannerSecondary && (
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
              {/* DIALOG BANNER - positioned absolutely within header */}
              {dialogVisible && dialogSpeaker && dialogLine && (
                <Animated.View
                  style={{
                    opacity: dialogOpacity,
                    transform: [{ translateY: dialogTranslateY }],
                  }}
                >
                  <DialogBanner
                    speaker={dialogSpeaker}
                    text={dialogLine}
                  />
                </Animated.View>
              )}

              {/* Top row: Player avatar, title, Rival avatar */}
              <View style={[styles.headerRow, layoutTweaks.headerRowSpacing]}>
                {/* Player Column */}
                <View style={styles.playerColumn}>
                  <View style={styles.avatarCircle}>
                    <Image
                      source={require('../assets/images/User.png')}
                      style={styles.userAvatarImage}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={[styles.playerScoreLabel, styles.playerScoreLabelYou]}>You</Text>
                  <Animated.View
                    style={{
                      transform: [
                        { scale: userScoreScale },
                        { translateY: userScoreTranslateY },
                      ],
                    }}
                  >
                    <ScoreDie
                      points={playerScore}
                      style={styles.scoreDie}
                      size={SCORE_DIE_BASE_SIZE}
                      animationKey={Platform.OS === 'android' ? undefined : scoreDiceAnimKey}
                    />
                  </Animated.View>
                </View>

                {/* Title Column - Now shows current claim */}
                <View
                  style={[
                    styles.titleColumn,
                    isSmallScreen && styles.titleColumnCompact,
                    isTallScreen && styles.titleColumnTall,
                  ]}
                >
                  <View style={styles.claimHeaderContainer}>
                    <Text style={styles.claimHeaderLine}>
                      Claim: {formatClaimSimple(lastClaim)}
                    </Text>
                  </View>
                </View>

                {/* Rival Column */}
                <View style={styles.playerColumn}>
                  <View style={styles.avatarCircle}>
                    <Image
                      source={require('../assets/images/Rival.png')}
                      style={styles.rivalAvatarImage}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={[styles.playerScoreLabel, styles.playerScoreLabelRival]}>Infernoman</Text>
                  <Animated.View
                    style={{
                      transform: [
                        { scale: rivalScoreScale },
                        { translateY: rivalScoreTranslateY },
                      ],
                    }}
                  >
                    <ScoreDie
                      points={cpuScore}
                      style={styles.scoreDie}
                      size={SCORE_DIE_BASE_SIZE}
                      animationKey={Platform.OS === 'android' ? undefined : scoreDiceAnimKey}
                    />
                  </Animated.View>
                </View>
              </View>

              {/* Status text below */}
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

            {/* HISTORY BOX - shows last two claims/events */}
            <Pressable
              onPress={() => setHistoryModalOpen(true)}
              hitSlop={10}
              style={({ pressed }) => [
                styles.historyBox,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Animated.View style={{ opacity: fadeAnim }}>
                {claims && claims.length > 0 ? (
                  [...claims.slice(-2)].reverse().map((h, i) => {
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
            <View testID="dice-area" style={[styles.diceArea, layoutTweaks.diceArea]}>
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
            </View>

            {/* ACTION BAR */}
            <View style={[styles.controls, layoutTweaks.controlsSpacing]}>
              <View style={styles.actionRow}>
                <StyledButton
                  label={
                    isGameOver
                      ? 'New Game'
                      : hasRolled && !mustBluff
                        ? 'Claim Roll'
                        : 'Roll'
                  }
                  variant={isGameOver ? 'primary' : 'success'}
                  onPress={isGameOver ? handleNewGamePress : handleRollOrClaim}
                  style={[
                    styles.btn,
                    isGameOver ? styles.newGamePrimaryButton : styles.menuActionButtonSuccess,
                  ]}
                  textStyle={isGameOver ? styles.newGamePrimaryButtonText : undefined}
                  disabled={
                    isGameOver
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
                  textStyle={styles.settingsFooterButtonTextSmall}
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
          </View>

          

          {/* CLAIM PICKER */}
          <BluffModal
            visible={claimPickerOpen}
            options={claimOptions}
            onCancel={() => setClaimPickerOpen(false)}
            onSelect={handleSelectClaim}
            canShowSocial={hasRolled && lastPlayerRoll === 41}
            onShowSocial={() => handleSelectClaim(41)}
          />

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
                  {claims && claims.length > 0 ? (
                    [...claims].reverse().map((h, i) => {
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
                  <RulesContent />
                </ScrollView>
                <View style={styles.rulesActions}>
                  <StyledButton
                    label="Quick Play Tutorial"
                    variant="primary"
                    onPress={handleTutorialReplay}
                    style={styles.rulesTutorialButton}
                  />
                </View>
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

                <View style={styles.settingsActions}>
                  <StyledButton
                    label="Reset Game"
                    variant="primary"
                    onPress={handleResetGamePress}
                    style={styles.resetGameButton}
                  />
                </View>
              </View>
            </View>
          </Modal>

        </SafeAreaView>

        <ScreenshotTutorial visible={showTutorial} onDone={handleTutorialDone} />
      </FeltBackground>
    </View>
  );
}

const BAR_BG = '#2A2D31';
const HEADER_MIN_HEIGHT = 220; // Enough space for claim text plus two narration lines

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1B1D1F' },
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  headerCard: {
    position: 'relative',
    backgroundColor: '#2A2D31',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    minHeight: HEADER_MIN_HEIGHT,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexGrow: 1,
  },
  playerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarEmoji: {
    fontSize: 32,
  },
  userAvatarImage: {
    width: 35,
    height: 35,
    resizeMode: 'contain',
  },
  rivalAvatarImage: {
    width: 42,
    height: 42,
  },
  playerScoreLabel: {
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  playerScoreLabelYou: {
    color: '#53A7F3',
  },
  playerScoreLabelRival: {
    color: '#FE9902',
  },
  scoreDie: {
    marginTop: 6,
  },
  titleColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    flexShrink: 1,
  },
  titleColumnCompact: {
    marginTop: 12,
  },
  titleColumnTall: {
    marginTop: 28,
  },
  claimHeaderContainer: {
    alignItems: 'center',
    marginTop: Platform.select({
      android: 15,
      default: 0,
    }),
    paddingTop: 50,
    marginBottom: 8,
  },
  claimHeaderLine: {
    color: '#FE9902',
    fontSize: Platform.select({
      ios: 18,
      web: 18,
      android: 14,
      default: 18,
    }),
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 2,
  },
  title: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 24,
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  status: {
    color: '#fff',
    opacity: 0.95,
    textAlign: 'center',
  },
  statusSmall: {
    fontSize: 14,
  },
  narrationContainer: {
    minHeight: 60,
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
    marginBottom: 0,
  },
  diceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    backgroundColor: BAR_BG,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: -DIE_SIZE * 1.5,
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
  newGameBtn: {
    borderWidth: 2,
    borderColor: '#B26B01',
  },
  menuBtn: {
    borderWidth: 2,
    borderColor: '#063a25',
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
  newGamePrimaryButton: {
    backgroundColor: '#FE9902',
    borderColor: '#FFEA70',
    borderWidth: 2,
  },
  newGamePrimaryButtonText: {
    color: '#1B1D1F',
    fontWeight: '800',
  },
  historyBox: {
    alignSelf: 'center',
    width: '70%',
    minHeight: 72,
    backgroundColor: '#3C4045',
    borderColor: '#000',
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
    color: '#E6FFE6',
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
    backgroundColor: '#3C4045',
    borderRadius: 12,
    padding: 20,
    maxHeight: '70%',
    width: '85%',
    borderColor: '#B26B01',
    borderWidth: 2,
    zIndex: 1001,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  modalBody: {
    marginBottom: 8,
  },
  modalMessage: {
    color: '#E6FFE6',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#E6FFE6',
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
    color: '#E6FFE6',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  noHistoryText: {
    color: '#C9F0D6',
    textAlign: 'center',
    fontSize: 14,
    marginVertical: 20,
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
    backgroundColor: '#3C4045',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxHeight: '75%',
    borderColor: '#B26B01',
    borderWidth: 2,
  },
  rulesActions: {
    marginTop: 16,
  },
  rulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rulesTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
  },
  rulesCloseButton: {
    padding: 4,
  },
  rulesClose: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  rulesScroll: {
    maxHeight: '100%',
  },
  rulesTutorialButton: {
    backgroundColor: '#FE9902',
    borderColor: '#FFEA70',
    borderWidth: 2,
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
  settingsActions: {
    marginTop: 16,
  },
  resetGameButton: {
    alignSelf: 'stretch',
    backgroundColor: '#C21807',
    borderColor: '#8B0000',
    borderWidth: 2,
    borderRadius: 12,
    marginTop: 4,
  },
  settingsBtn: {
    borderWidth: 2,
    borderColor: '#53A7F3',
  },
  footerButtonTextSmall: {
    fontSize: 14,
  },
  settingsFooterButtonTextSmall: {
    fontSize: Platform.OS === 'android' ? 12.6 : 14,
  },
  // End-of-game banner styles
  endBannerContainer: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  endBannerContent: {
    minWidth: 240,
    maxWidth: '80%',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  endBannerWin: {
    backgroundColor: '#53A7F3',
    borderWidth: 2,
    borderColor: '#1C75BC',
  },
  endBannerLose: {
    backgroundColor: '#260000',
    borderWidth: 2,
    borderColor: '#ff4444',
  },
  endBannerTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  endBannerTitleWin: {
    color: '#F0F6FC',
  },
  endBannerTitleLose: {
    color: '#ffffff',
  },
  endBannerSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  endBannerSubtitleWin: {
    color: '#E0F2FF',
  },
  endBannerSubtitleLose: {
    color: '#ffcccc',
  },
  // rulesButton styles removed; using StyledButton with newGameBtn styling instead
});
