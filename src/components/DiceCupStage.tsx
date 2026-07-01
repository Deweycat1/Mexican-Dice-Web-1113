import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import Dice from './Dice';
import { resolveCupGesture } from '../lib/cupGestures';
import {
  getRollDiceColorways,
  type DiceColorway,
  type RollOwner,
} from '../theme/dice';

export type DiceCupPhase =
  | 'ready'
  | 'rolling'
  | 'covered'
  | 'handed'
  | 'revealing'
  | 'revealed'
  | 'discarding';

type DiceCupStageProps = {
  phase: DiceCupPhase;
  diceValues: [number | null, number | null];
  rollOwner?: RollOwner;
  coveredStatus?: string;
  rollingStatus?: string;
  readyStatus?: string;
  handedStatus?: string;
  discardDirection?: 'left' | 'right';
  onCupTap?: () => void;
  onCupSwipeUp?: () => void;
  onCupSwipeSide?: (direction: 'left' | 'right') => void;
  theatrical?: boolean;
  onAnimationComplete?: (phase: DiceCupPhase) => void;
};

const DIE_SIZE = 46;

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

function LeatherCup() {
  return (
    <Svg width={178} height={146} viewBox="0 0 178 146">
      <Defs>
        <LinearGradient id="cupLeather" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#3C3D3A" />
          <Stop offset="0.34" stopColor="#20211F" />
          <Stop offset="0.72" stopColor="#101110" />
          <Stop offset="1" stopColor="#272522" />
        </LinearGradient>
        <LinearGradient id="cupShine" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.02} />
          <Stop offset="0.48" stopColor="#D8D4CB" stopOpacity={0.22} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.01} />
        </LinearGradient>
        <LinearGradient id="cupRim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#343431" />
          <Stop offset="1" stopColor="#090A09" />
        </LinearGradient>
      </Defs>

      <Path
        d="M38 20 C38 10 61 5 89 5 C117 5 140 10 140 20 L147 122 Q148 131 139 132 H39 Q30 131 31 122 Z"
        fill="url(#cupLeather)"
        stroke="#070807"
        strokeWidth="3"
      />
      <Ellipse
        cx="89"
        cy="20"
        rx="51"
        ry="15"
        fill="#292A27"
        stroke="#090A09"
        strokeWidth="2"
      />
      <Ellipse cx="82" cy="16" rx="29" ry="7" fill="#FFFFFF" opacity={0.09} />
      <Path
        d="M43 29 C66 36 112 36 135 29"
        fill="none"
        stroke="#918B82"
        strokeOpacity={0.48}
        strokeWidth="1.5"
        strokeDasharray="3 4"
      />
      <Path
        d="M53 28 L48 116 H80 L82 29 C70 30 61 30 53 28 Z"
        fill="url(#cupShine)"
      />
      <Path
        d="M42 109 H136"
        fill="none"
        stroke="#918B82"
        strokeOpacity={0.54}
        strokeWidth="2"
        strokeDasharray="3 5"
      />
      <Path
        d="M31 116 H147 L148 126 Q148 132 141 132 H37 Q30 132 30 126 Z"
        fill="url(#cupRim)"
        stroke="#070807"
        strokeWidth="3"
      />
      <Path d="M38 123 H140" stroke="#89837B" strokeOpacity={0.38} strokeWidth="2" />
    </Svg>
  );
}

const DIE_DEPTH_COLORS: Record<DiceColorway, readonly [string, string]> = {
  red: ['#65080C', '#8B0A10'],
  blue: ['#02386B', '#056CAA'],
  orange: ['#7D2305', '#B83D08'],
};

function ExtrudedDie({ value, colorway }: { value: number | null; colorway: DiceColorway }) {
  const [farDepth, nearDepth] = DIE_DEPTH_COLORS[colorway];
  return (
    <View style={styles.dieShell}>
      <View style={[styles.dieDepth, styles.dieDepthFar, { backgroundColor: farDepth }]} />
      <View style={[styles.dieDepth, styles.dieDepthNear, { backgroundColor: nearDepth }]} />
      <Dice value={value} size={DIE_SIZE} displayMode="values" colorway={colorway} />
    </View>
  );
}

export default function DiceCupStage({
  phase,
  diceValues,
  rollOwner = 'player',
  coveredStatus,
  rollingStatus,
  readyStatus,
  handedStatus,
  discardDirection = 'right',
  onCupTap,
  onCupSwipeUp,
  onCupSwipeSide,
  theatrical = false,
  onAnimationComplete,
}: DiceCupStageProps) {
  const reducedMotion = useReducedMotion();
  const [highDieColor, lowDieColor] = getRollDiceColorways(rollOwner);
  const cupX = useRef(new Animated.Value(0)).current;
  const cupY = useRef(new Animated.Value(0)).current;
  const cupRotation = useRef(new Animated.Value(0)).current;
  const cupOpacity = useRef(new Animated.Value(1)).current;
  const diceRoll = useRef(new Animated.Value(0)).current;
  const groupX = useRef(new Animated.Value(0)).current;
  const groupY = useRef(new Animated.Value(0)).current;
  const gestureX = useRef(new Animated.Value(0)).current;
  const gestureY = useRef(new Animated.Value(0)).current;
  const activeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const completionFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedPhaseRef = useRef<DiceCupPhase | null>(null);
  const onAnimationCompleteRef = useRef(onAnimationComplete);
  const onCupTapRef = useRef(onCupTap);
  const onCupSwipeUpRef = useRef(onCupSwipeUp);
  const onCupSwipeSideRef = useRef(onCupSwipeSide);

  onAnimationCompleteRef.current = onAnimationComplete;
  onCupTapRef.current = onCupTap;
  onCupSwipeUpRef.current = onCupSwipeUp;
  onCupSwipeSideRef.current = onCupSwipeSide;

  const finishPhase = useCallback(
    (completedPhase: DiceCupPhase) => {
      if (completedPhaseRef.current === completedPhase) return;
      completedPhaseRef.current = completedPhase;
      if (completionFallbackRef.current) {
        clearTimeout(completionFallbackRef.current);
        completionFallbackRef.current = null;
      }
      onAnimationCompleteRef.current?.(completedPhase);
    },
    []
  );

  const stopActiveAnimation = useCallback(() => {
    activeAnimationRef.current?.stop();
    activeAnimationRef.current = null;
    if (completionFallbackRef.current) {
      clearTimeout(completionFallbackRef.current);
      completionFallbackRef.current = null;
    }
  }, []);

  const scheduleCompletionFallback = useCallback(
    (completedPhase: DiceCupPhase, delayMs: number) => {
      if (completionFallbackRef.current) clearTimeout(completionFallbackRef.current);
      completionFallbackRef.current = setTimeout(() => finishPhase(completedPhase), delayMs);
    },
    [finishPhase]
  );

  const applyEndState = useCallback(
    (targetPhase: DiceCupPhase) => {
      if (targetPhase === 'revealing' || targetPhase === 'revealed') {
        cupX.setValue(48);
        cupY.setValue(-112);
        cupRotation.setValue(-7);
        cupOpacity.setValue(0.82);
      } else if (targetPhase === 'discarding') {
        groupX.setValue(discardDirection === 'left' ? -310 : 310);
        groupY.setValue(0);
      } else {
        groupX.setValue(0);
        groupY.setValue(0);
        cupX.setValue(0);
        cupY.setValue(0);
        cupRotation.setValue(0);
        cupOpacity.setValue(1);
      }
      if (targetPhase === 'rolling') diceRoll.setValue(1);
    },
    [
      cupOpacity,
      cupRotation,
      cupX,
      cupY,
      diceRoll,
      discardDirection,
      groupX,
      groupY,
    ]
  );

  useEffect(() => {
    stopActiveAnimation();
    completedPhaseRef.current = null;

    if (phase !== 'discarding') groupX.setValue(0);
    groupY.setValue(0);
    if (phase !== 'revealing' && phase !== 'revealed') {
      cupX.setValue(0);
      cupY.setValue(0);
      cupRotation.setValue(0);
      cupOpacity.setValue(1);
    }
    if (phase !== 'rolling') diceRoll.setValue(0);
    const animatedPhase =
      phase === 'rolling' || phase === 'revealing' || phase === 'discarding';
    if (!animatedPhase) return;

    if (reducedMotion) {
      applyEndState(phase);
      const frame = requestAnimationFrame(() => finishPhase(phase));
      return () => cancelAnimationFrame(frame);
    }

    if (phase === 'rolling') {
      const shakeDuration = theatrical ? 2350 : 1350;
      const beat = theatrical ? 145 : 112;
      const shakeSteps = theatrical ? 12 : 8;
      const concealedShakes = Array.from({ length: shakeSteps }, (_, index) =>
        Animated.parallel([
          Animated.timing(groupX, {
            toValue: index % 2 === 0 ? -18 : 18,
            duration: beat,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(groupY, {
            toValue: index % 3 === 0 ? -5 : 2,
            duration: beat,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(cupRotation, {
            toValue: index % 2 === 0 ? -6 : 6,
            duration: beat,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      const settle = Animated.parallel([
        Animated.spring(groupX, {
          toValue: 0,
          damping: 13,
          stiffness: 180,
          useNativeDriver: true,
        }),
        Animated.spring(groupY, {
          toValue: 0,
          damping: 14,
          stiffness: 180,
          useNativeDriver: true,
        }),
        Animated.spring(cupRotation, {
          toValue: 0,
          damping: 14,
          stiffness: 180,
          useNativeDriver: true,
        }),
      ]);
      const shake = Animated.sequence([...concealedShakes, settle]);
      const animation = Animated.parallel([
        shake,
        Animated.timing(diceRoll, {
          toValue: 1,
          duration: shakeDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      activeAnimationRef.current = animation;
      scheduleCompletionFallback('rolling', theatrical ? 4000 : 2800);
      animation.start(({ finished }) => {
        if (finished) finishPhase('rolling');
      });
    }

    if (phase === 'revealing') {
      const duration = theatrical ? 1150 : 760;
      const animation = Animated.parallel([
        Animated.timing(cupY, {
          toValue: -112,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cupX, {
          toValue: 48,
          duration,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cupRotation, {
          toValue: -7,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cupOpacity, {
          toValue: 0.82,
          duration,
          useNativeDriver: true,
        }),
      ]);
      activeAnimationRef.current = animation;
      scheduleCompletionFallback('revealing', duration + 800);
      animation.start(({ finished }) => {
        if (finished) finishPhase('revealing');
      });
    }

    if (phase === 'discarding') {
      const animation = Animated.parallel([
        Animated.timing(groupX, {
          toValue: discardDirection === 'left' ? -310 : 310,
          duration: 620,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cupRotation, {
          toValue: discardDirection === 'left' ? -9 : 9,
          duration: 620,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      activeAnimationRef.current = animation;
      scheduleCompletionFallback('discarding', 1600);
      animation.start(({ finished }) => {
        if (finished) finishPhase('discarding');
      });
    }

    return stopActiveAnimation;
  }, [
    applyEndState,
    cupOpacity,
    cupRotation,
    cupX,
    cupY,
    diceRoll,
    discardDirection,
    finishPhase,
    groupX,
    groupY,
    phase,
    reducedMotion,
    scheduleCompletionFallback,
    stopActiveAnimation,
    theatrical,
  ]);

  const gesturesEnabled = Boolean(onCupTap || onCupSwipeUp || onCupSwipeSide);
  const gesturesEnabledRef = useRef(gesturesEnabled);
  gesturesEnabledRef.current = gesturesEnabled;
  const resetGesturePosition = useCallback(() => {
    Animated.parallel([
      Animated.spring(gestureX, {
        toValue: 0,
        damping: 18,
        stiffness: 230,
        useNativeDriver: true,
      }),
      Animated.spring(gestureY, {
        toValue: 0,
        damping: 18,
        stiffness: 230,
        useNativeDriver: true,
      }),
    ]).start();
  }, [gestureX, gestureY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => gesturesEnabledRef.current,
        onMoveShouldSetPanResponder: () => gesturesEnabledRef.current,
        onPanResponderMove: (_event, gestureState) => {
          gestureX.setValue(Math.max(-64, Math.min(64, gestureState.dx)));
          gestureY.setValue(Math.max(-72, Math.min(20, gestureState.dy)));
        },
        onPanResponderRelease: (_event, gestureState) => {
          const gesture = resolveCupGesture(
            gestureState.dx,
            gestureState.dy,
            gestureState.vx,
            gestureState.vy
          );
          resetGesturePosition();

          if (gesture === 'tap') {
            onCupTapRef.current?.();
          } else if (gesture === 'swipe-up') {
            onCupSwipeUpRef.current?.();
          } else if (gesture === 'swipe-left' || gesture === 'swipe-right') {
            onCupSwipeSideRef.current?.(gesture === 'swipe-left' ? 'left' : 'right');
          }
        },
        onPanResponderTerminate: resetGesturePosition,
        // A vertical ScrollView may otherwise take over before an upward cup swipe is released.
        // Keep the responder while calling bluff is available; allow normal scrolling when it is not.
        onPanResponderTerminationRequest: () => !onCupSwipeUpRef.current,
      }),
    [gestureX, gestureY, resetGesturePosition]
  );

  const valuesVisible = phase === 'revealing' || phase === 'revealed';
  const shownValues: [number | null, number | null] = valuesVisible
    ? diceValues
    : [5, 2];

  const leftDieStyle = {
    transform: [
      { perspective: 460 },
      {
        translateY: diceRoll.interpolate({
          inputRange: [0, 0.2, 0.43, 0.68, 1],
          outputRange: [0, -6, 2, -5, 0],
        }),
      },
      {
        translateX: diceRoll.interpolate({
          inputRange: [0, 0.33, 0.66, 1],
          outputRange: [0, 5, -4, 0],
        }),
      },
      {
        rotateX: diceRoll.interpolate({
          inputRange: [0, 1],
          outputRange: ['12deg', '1092deg'],
        }),
      },
      {
        rotateY: diceRoll.interpolate({
          inputRange: [0, 1],
          outputRange: ['-12deg', '708deg'],
        }),
      },
      { rotateZ: '-8deg' },
    ],
  };

  const rightDieStyle = {
    transform: [
      { perspective: 460 },
      {
        translateY: diceRoll.interpolate({
          inputRange: [0, 0.24, 0.5, 0.76, 1],
          outputRange: [0, -5, 2, -7, 0],
        }),
      },
      {
        translateX: diceRoll.interpolate({
          inputRange: [0, 0.35, 0.72, 1],
          outputRange: [0, -5, 4, 0],
        }),
      },
      {
        rotateX: diceRoll.interpolate({
          inputRange: [0, 1],
          outputRange: ['-8deg', '-728deg'],
        }),
      },
      {
        rotateY: diceRoll.interpolate({
          inputRange: [0, 1],
          outputRange: ['14deg', '1094deg'],
        }),
      },
      { rotateZ: '9deg' },
    ],
  };

  const cupStyle = {
    opacity: cupOpacity,
    transform: [
      { perspective: 700 },
      { translateX: cupX },
      { translateY: cupY },
      {
        rotateZ: cupRotation.interpolate({
          inputRange: [-10, 10],
          outputRange: ['-10deg', '10deg'],
        }),
      },
    ],
  };

  const status = useMemo(() => {
    switch (phase) {
      case 'rolling':
        return rollingStatus ?? (theatrical ? 'INFERNO SHAKE' : 'SHAKING');
      case 'covered':
        return coveredStatus ?? 'CUP DOWN  •  PEEK TO REVEAL';
      case 'handed':
        return handedStatus ?? "INFERNOMAN'S CUP";
      case 'revealing':
        return 'LIFTING THE CUP';
      case 'revealed':
        return theatrical ? 'INFERNO REVEALED' : 'ROLL REVEALED';
      case 'discarding':
        return 'BELIEVED  •  DICE DISCARDED';
      default:
        return readyStatus ?? 'CUP READY';
    }
  }, [coveredStatus, handedStatus, phase, readyStatus, rollingStatus, theatrical]);

  return (
    <View
      style={styles.stage}
      accessibilityLabel={`${status.toLowerCase()}. Leather dice cup with two dice.`}
      {...panResponder.panHandlers}
    >
      <View pointerEvents="none" style={styles.tableShadow} />

      <Animated.View
        style={[
          styles.movingGroup,
          {
            transform: [
              { translateX: groupX },
              { translateY: groupY },
              { translateX: gestureX },
              { translateY: gestureY },
            ],
          },
        ]}
      >
        <View style={[styles.diceRow, !valuesVisible && styles.diceConcealed]}>
          <Animated.View style={leftDieStyle}>
            <ExtrudedDie value={shownValues[0]} colorway={highDieColor} />
          </Animated.View>
          <Animated.View style={rightDieStyle}>
            <ExtrudedDie value={shownValues[1]} colorway={lowDieColor} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.cup, cupStyle]}>
          <LeatherCup />
        </Animated.View>
      </Animated.View>

      <View pointerEvents="none" style={styles.statusPill}>
        <Text style={[styles.statusText, theatrical && styles.statusTextInferno]}>{status}</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: 270,
    height: 186,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  movingGroup: {
    ...StyleSheet.absoluteFillObject,
  },
  diceRow: {
    position: 'absolute',
    top: 70,
    left: 81,
    zIndex: 2,
    flexDirection: 'row',
    gap: 6,
  },
  diceConcealed: {
    opacity: 0,
  },
  dieShell: {
    width: DIE_SIZE + 5,
    height: DIE_SIZE + 5,
  },
  dieDepth: {
    position: 'absolute',
    width: DIE_SIZE,
    height: DIE_SIZE,
    borderRadius: DIE_SIZE * 0.2,
    backgroundColor: '#65080C',
    borderColor: '#3D0305',
    borderWidth: 1,
  },
  dieDepthFar: {
    left: 5,
    top: 5,
    opacity: 0.82,
  },
  dieDepthNear: {
    left: 3,
    top: 3,
    backgroundColor: '#8B0A10',
  },
  cup: {
    position: 'absolute',
    top: 13,
    left: 46,
    zIndex: 4,
  },
  tableShadow: {
    position: 'absolute',
    top: 133,
    width: 176,
    height: 28,
    borderRadius: 90,
    backgroundColor: 'rgba(0, 0, 0, 0.44)',
    transform: [{ scaleY: 0.55 }],
  },
  statusPill: {
    position: 'absolute',
    bottom: 4,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 4,
    backgroundColor: 'rgba(17, 18, 20, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  statusText: {
    color: '#D9E7EF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  statusTextInferno: {
    color: '#FFB24A',
  },
});
