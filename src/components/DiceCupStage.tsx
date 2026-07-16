import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  PanResponder,
  PixelRatio,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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

const ANDROID_CONTENT_SCALE = Platform.OS === 'android' ? 0.6 : 1;
const IOS_CONTENT_SCALE = Platform.OS === 'ios' ? 0.8 : 1;
const DIE_SIZE = 46 * 0.8 * ANDROID_CONTENT_SCALE * IOS_CONTENT_SCALE;
const DIE_DEPTH_FAR_OFFSET = 5 * 0.8 * ANDROID_CONTENT_SCALE * IOS_CONTENT_SCALE;
const DIE_DEPTH_NEAR_OFFSET = 3 * 0.8 * ANDROID_CONTENT_SCALE * IOS_CONTENT_SCALE;
const DICE_GAP = 6 * 0.8 * ANDROID_CONTENT_SCALE * IOS_CONTENT_SCALE;
const DICE_ROW_TOP = 70;
const STAGE_WIDTH = 270;
const DICE_ROW_WIDTH = (DIE_SIZE + DIE_DEPTH_FAR_OFFSET) * 2 + DICE_GAP;
const DICE_ROW_LEFT = (STAGE_WIDTH - DICE_ROW_WIDTH) / 2;
const CUP_IMAGE = require('../../assets/images/cup.png');
const CUP_SCALE = 1.8 * ANDROID_CONTENT_SCALE * IOS_CONTENT_SCALE;
const alignAndroidPixel = (value: number) =>
  Platform.OS === 'android' ? PixelRatio.roundToNearestPixel(value) : value;
const CUP_WIDTH = alignAndroidPixel(178 * CUP_SCALE);
const CUP_HEIGHT = alignAndroidPixel(146 * CUP_SCALE);
const CUP_TOP = 13 - (CUP_HEIGHT - 146) / 2;
const CUP_LEFT = (STAGE_WIDTH - CUP_WIDTH) / 2;
const DICE_PEEK_VISIBLE_HEIGHT = DIE_SIZE * 0.3;
const CUP_REVEAL_Y =
  DICE_ROW_TOP + DIE_SIZE - DICE_PEEK_VISIBLE_HEIGHT - (CUP_TOP + CUP_HEIGHT);
const PLAY_GROUP_OFFSET_Y = 65 - (Platform.OS === 'android' ? STAGE_WIDTH * 0.1 : 0);
const STAGE_HEIGHT = PLAY_GROUP_OFFSET_Y + CUP_TOP + CUP_HEIGHT + 24;

const CUP_DICE_RESTING_POSES = [
  {
    left: { x: 0, y: 0, rotation: -8 },
    right: { x: 0, y: 0, rotation: 9 },
  },
  {
    left: { x: -4, y: 2, rotation: -17 },
    right: { x: 3, y: -1, rotation: 5 },
  },
  {
    left: { x: 3, y: -2, rotation: 2 },
    right: { x: -2, y: 3, rotation: 18 },
  },
  {
    left: { x: -2, y: 1, rotation: 11 },
    right: { x: 4, y: 2, rotation: -12 },
  },
];

const nextCupDicePoseIndex = (current: number) =>
  (current + 1 + Math.floor(Math.random() * (CUP_DICE_RESTING_POSES.length - 1))) %
  CUP_DICE_RESTING_POSES.length;

// Android can paint the first rolling frame before a normal effect selects the next dice pose.
// A layout effect prevents that one-frame snap; iOS retains its existing effect timing.
const useCupPoseEffect = Platform.OS === 'android' ? useLayoutEffect : useEffect;

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
  return <Image source={CUP_IMAGE} style={styles.cupImage} resizeMode="contain" />;
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
  const [restingPoseIndex, setRestingPoseIndex] = useState(0);
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

  useCupPoseEffect(() => {
    if (phase === 'rolling') {
      setRestingPoseIndex(nextCupDicePoseIndex);
    }
  }, [phase]);

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
        cupY.setValue(CUP_REVEAL_Y);
        cupRotation.setValue(-7);
        cupOpacity.setValue(1);
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
        if (finished) {
          activeAnimationRef.current = null;
          finishPhase('rolling');
        }
      });
    }

    if (phase === 'revealing') {
      const duration = theatrical ? 1150 : 760;
      const animation = Animated.parallel([
        Animated.timing(cupY, {
          toValue: CUP_REVEAL_Y,
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
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
      ]);
      activeAnimationRef.current = animation;
      scheduleCompletionFallback('revealing', duration + 800);
      animation.start(({ finished }) => {
        if (finished) {
          activeAnimationRef.current = null;
          finishPhase('revealing');
        }
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
        if (finished) {
          activeAnimationRef.current = null;
          finishPhase('discarding');
        }
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
  const restingPose = CUP_DICE_RESTING_POSES[restingPoseIndex];

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
      { translateX: restingPose.left.x },
      { translateY: restingPose.left.y },
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
      { rotateZ: `${restingPose.left.rotation}deg` },
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
      { translateX: restingPose.right.x },
      { translateY: restingPose.right.y },
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
      { rotateZ: `${restingPose.right.rotation}deg` },
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
        return coveredStatus ?? 'TAP OR LIFT ↑ TO PEEK';
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
      style={[
        styles.stage,
        (phase === 'revealing' || phase === 'revealed') && styles.stageCupLifted,
      ]}
      accessibilityLabel={`${status.toLowerCase()}. Leather dice cup with two dice.`}
      {...panResponder.panHandlers}
    >
      <Animated.View
        renderToHardwareTextureAndroid={Platform.OS === 'android'}
        style={[
          styles.movingGroup,
          {
            transform: [
              { translateY: PLAY_GROUP_OFFSET_Y },
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

        <Animated.View
          renderToHardwareTextureAndroid={Platform.OS === 'android'}
          style={[styles.cup, cupStyle]}
        >
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
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stageCupLifted: {
    overflow: 'visible',
  },
  movingGroup: {
    ...StyleSheet.absoluteFillObject,
  },
  diceRow: {
    position: 'absolute',
    top: DICE_ROW_TOP,
    left: DICE_ROW_LEFT,
    zIndex: 2,
    flexDirection: 'row',
    gap: DICE_GAP,
  },
  diceConcealed: {
    opacity: 0,
  },
  dieShell: {
    width: DIE_SIZE + DIE_DEPTH_FAR_OFFSET,
    height: DIE_SIZE + DIE_DEPTH_FAR_OFFSET,
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
    left: DIE_DEPTH_FAR_OFFSET,
    top: DIE_DEPTH_FAR_OFFSET,
    opacity: 0.82,
  },
  dieDepthNear: {
    left: DIE_DEPTH_NEAR_OFFSET,
    top: DIE_DEPTH_NEAR_OFFSET,
    backgroundColor: '#8B0A10',
  },
  cup: {
    position: 'absolute',
    top: CUP_TOP,
    left: CUP_LEFT,
    zIndex: 4,
  },
  cupImage: {
    width: CUP_WIDTH,
    height: CUP_HEIGHT,
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
