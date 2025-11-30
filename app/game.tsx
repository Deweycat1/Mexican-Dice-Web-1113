import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Image,
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
    Alert,
    Platform,
} from 'react-native';

import BluffModal from '../src/components/BluffModal';
import DialogBanner from '../src/components/DialogBanner';
import Dice from '../src/components/Dice';
import FeltBackground from '../src/components/FeltBackground';
import FireworksOverlay from '../src/components/FireworksOverlay';
import { ScoreDie } from '../src/components/ScoreDie';
import AnimatedDiceReveal from '../src/components/AnimatedDiceReveal';
import StyledButton from '../src/components/StyledButton';
import ThinkingIndicator from '../src/components/ThinkingIndicator';
import RulesContent from '../src/components/RulesContent';
import { isAlwaysClaimable, meetsOrBeats, resolveActiveChallenge, resolveBluff, splitClaim } from '../src/engine/mexican';
import { buildClaimOptions } from '../src/lib/claimOptions';
import { pickRandomLine, rivalPointWinLines, userPointWinLines } from '../src/lib/dialogLines';
import { useGameStore } from '../src/state/useGameStore';

// ---------- helpers ----------
function formatClaim(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ' - ';
  if (value === 21) return '21 (Mexican)';
  if (value === 31) return '31 (Reverse)';
  if (value === 41) return '41 (Social)';
  const hi = Math.floor(value / 10);
  const lo = value % 10;
  return `${hi}${lo}`;
}
function formatRoll(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ' - ';
  const [hi, lo] = splitClaim(value);
  return `${hi}${lo}`;
}
function facesFromRoll(value: number | null | undefined): readonly [number | null, number | null] {
  if (typeof value !== 'number' || Number.isNaN(value)) return [null, null] as const;
  const [hi, lo] = splitClaim(value);
  return [hi, lo] as const;
}

// Devil/demon themed Rival opening lines
const rivalOpeningLines = [
  // Sinister but playful
  "Welcome to my little hell. You won't like the heat.",
  "You rolled into the wrong circle today.",
  "I hope your soul is fireproof.",
  "Careful. I play with souls the way you play with dice.",
  "Try not to scream. It distracts me.",

  // Cocky / mocking
  "Ready to burn through those points?",
  "Good. I needed a warm up snack.",
  "I can smell fear. Delicious.",
  "You brought bravery. Cute. Useless, but cute.",
  "I love when mortals think they can win.",

  // Dark humor
  "Relax. Only your pride is at risk. Probably.",
  "Don't worry. Pain builds character.",
  "Let's make this quick. I have tormenting to do.",
  "Losing to me counts as a minor sin.",
  "If you hear whispering, that is just your doom.",

  // Taunting / tempting
  "I'll trade you a win for your dignity. Deal?",
  "Go ahead. Make your first mistake.",
  "If you win, I'll be shocked. Truly.",
  "You step into my fire, you get burned.",
  "Play well. I hate a boring sacrifice.",

  // Mischievous / smart-ass
  "I sharpened my dice just for you.",
  "Try not to melt. I like a challenge.",
  "One roll in and your fate is sealed.",
  "Feeling brave? Or just flammable?",
  "Let's see how fast you fall.",
];

const pickRandomRivalLine = () => {
  const index = Math.floor(Math.random() * rivalOpeningLines.length);
  return rivalOpeningLines[index];
};

// End-of-game banner lines
const HEAVENLY_LINES = [
  "You ascend victorious.",
  "Heaven smiles on your rolls.",
  "Saint of the six pips.",
  "You just blessed those dice.",
];

const DEMONIC_LINES = [
  "Dragged into dice hell.",
  "The devil devoured your points.",
  "Your luck just went up in smoke.",
  "You gambled with demons and lost.",
];

const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

// ------------------------------

export default function Game() {
  const router = useRouter();
  const [claimPickerOpen, setClaimPickerOpen] = useState(false);
  const [rollingAnim, setRollingAnim] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [cpuDiceRevealed, setCpuDiceRevealed] = useState(false);
  const [pendingCpuBluffResolution, setPendingCpuBluffResolution] = useState(false);
  const [scoreDiceAnimKey, setScoreDiceAnimKey] = useState(0);
  const socialRevealNonceRef = useRef(0);
  const socialBannerNonceRef = useRef(0);
  const [showSocialReveal, setShowSocialReveal] = useState(false);
  const [socialDiceValues, setSocialDiceValues] = useState<[number | null, number | null]>([null, null]);
  const [socialRevealHidden, setSocialRevealHidden] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);

  // Rival opening taunt state
  const [hasRolledThisGame, setHasRolledThisGame] = useState<boolean>(false);
  const [shouldRevealCpuDice, setShouldRevealCpuDice] = useState(false);
  const [rivalBluffBannerVisible, setRivalBluffBannerVisible] = useState(false);
  const [rivalBluffBannerType, setRivalBluffBannerType] = useState<'got-em' | 'womp-womp' | 'social' | null>(null);
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
    message,
    claims,
    gameOver,
    mustBluff,
    mexicanFlashNonce,
    cpuSocialDice,
    cpuSocialRevealNonce,
    socialBannerNonce,
    lastBluffCaller,
    lastBluffDefenderTruth,
    bluffResultNonce,
  } = useGameStore();

  const narration = (buildBanner?.() || message || '').trim();
  const lastClaimValue = resolveActiveChallenge(baselineClaim, lastClaim);

  // Helper component to render claim with inline logo for Mexican
  const renderClaim = (value: number | null | undefined) => {
    const text = formatClaim(value);
    if (value === 21) {
      return (
        <>
          21 (Mexican <Image source={require('../assets/images/mexican-dice-logo.png')} style={{ width: 16, height: 16, marginBottom: -2 }} />)
        </>
      );
    }
    return text;
  };

  const claimText = useMemo(() => {
    const rollPart = formatRoll(lastPlayerRoll);
    return (
      <>
        Current claim: {renderClaim(lastClaim)} Your roll: {rollPart}
      </>
    );
  }, [lastClaim, lastPlayerRoll]);

  const [playerHi, playerLo] = facesFromRoll(lastPlayerRoll);
  const [cpuHi, cpuLo] = facesFromRoll(lastCpuRoll);
  const rolling = rollingAnim || isRolling;

  const isGameOver = gameOver !== null;
  const controlsDisabled = isGameOver || turn !== 'player' || isBusy || turnLock;
  const showCpuThinking = turn !== 'player' && !isGameOver;
  const hasRolled = turn === 'player' && lastPlayerRoll !== null;
  const rolledValue = hasRolled ? lastPlayerRoll : null;
  const rolledCanClaim =
    hasRolled &&
    rolledValue !== null &&
    (lastClaimValue == null || meetsOrBeats(rolledValue, lastClaimValue) || isAlwaysClaimable(rolledValue));

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

  const currentBluffBannerText = useMemo(() => {
    if (rivalBluffBannerType === 'social') return '🍻 SOCIAL!!! 🍻';
    if (rivalBluffBannerType === 'got-em') return "GOT 'EM!!!!";
    return 'WOMP WOMP';
  }, [rivalBluffBannerType]);

  const claimOptions = useMemo(() => buildClaimOptions(lastClaim, lastPlayerRoll), [lastClaim, lastPlayerRoll]);

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

  useEffect(() => {
    if (!mexicanFlashNonce) return;
    setShowFireworks(true);
  }, [mexicanFlashNonce]);

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
    setRivalBluffBannerType(type);
    setRivalBluffBannerVisible(true);
    rivalBluffBannerOpacity.stopAnimation();
    rivalBluffBannerScale.stopAnimation?.();
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      playerClaim(lastPlayerRoll);
      return;
    }

    if (hasRolled && mustBluff) return;

    // Mark first roll complete to disable intro message
    if (!hasRolledThisGame) {
      setHasRolledThisGame(true);
    }

    setRollingAnim(true);
    Haptics.selectionAsync();
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

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playerClaim(claim);
    setClaimPickerOpen(false);
  }

  const startFreshGame = useCallback(() => {
    newGame();
    setHasRolledThisGame(false);
    setScoreDiceAnimKey((k) => k + 1);
    const openingLine = pickRandomRivalLine();
    setTimeout(() => showDialog('rival', openingLine), 300);
  }, [newGame, setHasRolledThisGame, setScoreDiceAnimKey, showDialog]);

  const handleNewGamePress = useCallback(() => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      const confirmed = window.confirm('Start a new game? Your current round will be lost.');
      if (confirmed) {
        startFreshGame();
      }
      return;
    }

    Alert.alert(
      'Start a new game?',
      'Your current round will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, start over',
          style: 'destructive',
          onPress: () => startFreshGame(),
        },
      ]
    );
  }, [startFreshGame]);

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
    if (cpuSocialDice && cpuSocialRevealNonce > socialRevealNonceRef.current) {
      socialRevealNonceRef.current = cpuSocialRevealNonce;
      setSocialDiceValues(cpuSocialDice);
      setShowSocialReveal(true);
      setSocialRevealHidden(true);
      setIsRevealAnimating(true);
      requestAnimationFrame(() => setSocialRevealHidden(false));
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
                <Text style={styles.gotEmBannerText}>
                  {currentBluffBannerText}
                </Text>
              </View>
            </Animated.View>
          )}
          <View style={styles.content}>
            {/* HEADER */}
            <View style={styles.headerCard}>
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
              <View style={styles.headerRow}>
                {/* Player Column */}
                <View style={styles.playerColumn}>
                  <View style={styles.avatarCircle}>
                    <Image
                      source={require('../assets/images/User.png')}
                      style={styles.userAvatarImage}
                      resizeMode="cover"
                    />
                  </View>
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
                      size={38}
                      animationKey={scoreDiceAnimKey}
                    />
                  </Animated.View>
                </View>

                {/* Title Column - Now shows current claim */}
                <View style={styles.titleColumn}>
                  <Text style={styles.subtle}>{claimText}</Text>
                </View>

                {/* Rival Column */}
                <View style={styles.playerColumn}>
                  <View style={styles.avatarCircle}>
                    <Image
                      source={require('../assets/images/Rival.png')}
                      style={styles.rivalAvatarImage}
                      resizeMode="cover"
                    />
                  </View>
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
                      size={38}
                      animationKey={scoreDiceAnimKey}
                    />
                  </Animated.View>
                </View>
              </View>

              {/* Status text below */}
              <Text style={styles.status} numberOfLines={2}>
                {narration || 'Ready to roll.'}
              </Text>
              {showCpuThinking && (
                <Text style={styles.subtleSmall}>The Rival thinking…</Text>
              )}
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
                  [...claims.slice(-2)].reverse().map((h, i) => (
                    <Text key={i} style={styles.historyText} numberOfLines={1}>
                      {h.type === 'event' ? h.text : (
                        <>
                          {h.who === 'player' ? 'You' : 'The Rival'} {h.claim === 41 ? 'rolled' : 'claimed'} {renderClaim(h.claim)}
                        </>
                      )}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.historyText}>No recent events.</Text>
                )}
              </Animated.View>
            </Pressable>

            {/* DICE BLOCK */}
            <View testID="dice-area" style={styles.diceArea}>
              <View style={styles.diceRow}>
            {showCpuThinking ? (
              <>
                <ThinkingIndicator size={100} position="left" />
                <View style={{ width: 24 }} />
                <ThinkingIndicator size={100} position="right" />
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
                <View style={{ width: 24 }} />
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
            <View style={styles.controls}>
              <View style={styles.actionRow}>
                <StyledButton
                  label={hasRolled && !mustBluff ? 'Claim Roll' : 'Roll'}
                  variant="success"
                  onPress={handleRollOrClaim}
                  style={[styles.btn, styles.menuActionButtonSuccess]}
                  disabled={
                    controlsDisabled || isRevealAnimating || (hasRolled && !rolledCanClaim)
                  }
                />
                <StyledButton
                  label="Call Bluff"
                  variant="primary"
                  onPress={handleCallBluff}
                  style={[styles.btn, styles.menuActionButton]}
                  disabled={controlsDisabled || hasRolled}
                />
              </View>

              <View style={styles.bottomRow}>
                <StyledButton
                  label="Bluff Options"
                  variant="outline"
                  onPress={handleOpenBluff}
                  style={styles.btnWide}
                  disabled={controlsDisabled || isRevealAnimating}
                />
              </View>

              <View style={styles.bottomRow}>
                <StyledButton
                  label="New Game"
                  variant="ghost"
                  onPress={handleNewGamePress}
                  style={[styles.btn, styles.newGameBtn]}
                />
                <StyledButton
                  label="Menu"
                  variant="ghost"
                  onPress={() => router.push('/')}
                  style={[styles.btn, styles.menuBtn]}
                />
                <StyledButton
                  label="View Rules"
                  variant="ghost"
                  onPress={() => setRulesOpen(true)}
                  style={[styles.btn, styles.newGameBtn]}
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
                  <Text style={styles.modalTitle}>Full History</Text>
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
                    [...claims].reverse().map((h, i) => (
                      <View key={i} style={styles.historyItem}>
                        <Text style={styles.historyItemText}>
                          {h.type === 'event' ? h.text : (
                            <>
                              {h.who === 'player' ? 'You' : 'The Rival'} {h.claim === 41 ? 'rolled' : 'claimed'} {renderClaim(h.claim)}
                            </>
                          )}
                        </Text>
                      </View>
                    ))
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
              </View>
            </View>
          </Modal>

        </SafeAreaView>
      </FeltBackground>
      <FireworksOverlay visible={showFireworks} onDone={() => setShowFireworks(false)} />
    </View>
  );
}

const BAR_BG = '#115E38';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B3A26' },
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  headerCard: {
    position: 'relative',
    backgroundColor: '#115E38',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    borderWidth: 2,
    borderColor: '#E0B50C',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarEmoji: {
    fontSize: 32,
  },
  userAvatarImage: {
    width: 62,
    height: 62,
  },
  rivalAvatarImage: {
    width: 56,
    height: 56,
  },
  playerScoreLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  scoreDie: {
    marginTop: 6,
  },
  titleColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginTop: 75,
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
  subtle: {
    color: '#E0B50C',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtleSmall: {
    color: '#C9F0D6',
    opacity: 0.8,
    textAlign: 'center',
    fontSize: 13,
  },
  status: {
    color: '#fff',
    opacity: 0.95,
    textAlign: 'center',
  },
  diceArea: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    marginTop: -134,
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
    marginTop: -150,
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
    backgroundColor: '#2ECC71',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1E8E4E',
  },
  newGameBtn: {
    borderWidth: 2,
    borderColor: '#e0b50c',
  },
  menuBtn: {
    borderWidth: 2,
    borderColor: '#063a25',
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
    backgroundColor: 'rgba(0,0,0,0.32)',
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
    backgroundColor: '#16A34A',
    borderColor: 'rgba(255, 255, 255, 0.35)',
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
    backgroundColor: '#1a4d2e',
    borderRadius: 12,
    padding: 20,
    maxHeight: '70%',
    width: '85%',
    borderColor: '#e0b50c',
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
    backgroundColor: '#1a4d2e',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxHeight: '75%',
    borderColor: '#e0b50c',
    borderWidth: 2,
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
    backgroundColor: '#f5f6ff',
    borderWidth: 2,
    borderColor: '#ffd700',
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
    color: '#2a2a2a',
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
    color: '#444444',
  },
  endBannerSubtitleLose: {
    color: '#ffcccc',
  },
  // rulesButton styles removed; using StyledButton with newGameBtn styling instead
});
