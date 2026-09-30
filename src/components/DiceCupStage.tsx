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
  /** Fires once per reveal, when the last die has landed. Good moment for a haptic. */
  onDiceSettle?: () => void;
};

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const ANDROID_CONTENT_SCALE = Platform.OS === 'android' ? 0.6 : 1;
const IOS_CONTENT_SCALE = Platform.OS === 'ios' ? 0.8 : 1;
const CONTENT_SCALE = ANDROID_CONTENT_SCALE * IOS_CONTENT_SCALE;

const STAGE_WIDTH = 270;
const CUP_IMAGE = require('../../assets/images/cup.png');
const CUP_SCALE = 1.8 * CONTENT_SCALE;
const alignAndroidPixel = (value: number) =>
  Platform.OS === 'android' ? PixelRatio.roundToNearestPixel(value) : value;
const CUP_WIDTH = alignAndroidPixel(178 * CUP_SCALE);
const CUP_HEIGHT = alignAndroidPixel(146 * CUP_SCALE);
const CUP_TOP = 13 - (CUP_HEIGHT - 146) / 2;
const CUP_LEFT = (STAGE_WIDTH - CUP_WIDTH) / 2;

// Dice are sized relative to the cup: about 15% of its width reads clearly without crowding the
// cup (19% looked oversized on phones). Android keeps a floor so pips stay legible.
const DIE_SIZE = Math.max(
  Platform.OS === 'android' ? 30 : 0,
  Math.round(CUP_WIDTH * 0.15)
);
const DIE_DEPTH_FAR_OFFSET = Math.max(3, Math.round(DIE_SIZE * 0.09));
const DIE_DEPTH_NEAR_OFFSET = Math.max(2, Math.round(DIE_SIZE * 0.055));
const DIE_SHELL_SIZE = DIE_SIZE + DIE_DEPTH_FAR_OFFSET;

// Resting tilt is random per roll, but bounded so the footprint stays predictable.
const MIN_TILT_DEG = 3;
const MAX_TILT_DEG = 12;
// Extra rotation the die "spins off" while landing, on top of its resting tilt.
const MIN_LANDING_SPIN_DEG = 14;
const MAX_LANDING_SPIN_DEG = 24;
// Each die starts its landing this far outward and slides in as it settles, so the two never
// cross while they are still enlarged and spun mid-air.
const LANDING_SPREAD = Math.round(DIE_SIZE * 0.3);
// Whole-pair scatter so the landing spot varies without ever moving the dice toward each other.
const MAX_SCATTER_X = Math.round(DIE_SIZE * 0.08);
const MAX_SCATTER_Y = Math.round(DIE_SIZE * 0.05);

const degToRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Horizontal room a die can claim beyond its own square: the growth of a square's bounding box
 * when rotated by the maximum tilt, plus the extruded depth that hangs off its right edge.
 */
const MAX_TILT_GROWTH =
  DIE_SIZE * (Math.cos(degToRad(MAX_TILT_DEG)) + Math.sin(degToRad(MAX_TILT_DEG)) - 1);
const DICE_GAP = Math.ceil(MAX_TILT_GROWTH + DIE_DEPTH_FAR_OFFSET + DIE_SIZE * 0.05);

const DICE_ROW_TOP = 70;
const DICE_ROW_WIDTH = DIE_SHELL_SIZE * 2 + DICE_GAP;
const DICE_ROW_LEFT = (STAGE_WIDTH - DICE_ROW_WIDTH) / 2;
// The cup image is portrait (2:3) drawn with "contain" into a wider box, so its visible body is
// narrower than CUP_WIDTH: this is the on-screen width of the leather.
const CUP_VISIBLE_WIDTH = CUP_HEIGHT * (1024 / 1536);
// Revealed pose: instead of lifting the cup its whole height (which parks it on top of the
// panels above), it tips aside to the right and rises just enough for the rim to clear the dice.
const CUP_LIFTED_SCALE = 0.78;
const CUP_LIFTED_X = Math.round(CUP_VISIBLE_WIDTH * 0.7);
const CUP_LIFTED_ROTATION = -24;
const CUP_LIFTED_OPACITY = 1;
const CUP_REVEAL_Y = -Math.round(DIE_SIZE * 1.15);
const PLAY_GROUP_OFFSET_Y = 65 - (Platform.OS === 'android' ? STAGE_WIDTH * 0.1 : 0);
const STAGE_HEIGHT = PLAY_GROUP_OFFSET_Y + CUP_TOP + CUP_HEIGHT + 24;

const SHADOW_WIDTH = DIE_SIZE * 1.2;
const SHADOW_HEIGHT = DIE_SIZE * 0.34;

// ---------------------------------------------------------------------------
// Per-roll pose
// ---------------------------------------------------------------------------

type DieLanding = {
  tilt: number; // resting rotateZ in degrees
  spin: number; // extra degrees the die rotates through while landing (same sign as tilt)
};

type RollPose = {
  left: DieLanding;
  right: DieLanding;
  scatterX: number;
  scatterY: number;
  lead: 'left' | 'right';
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const randomSign = () => (Math.random() < 0.5 ? -1 : 1);

const randomLanding = (): DieLanding => {
  const sign = randomSign();
  return {
    tilt: sign * randomBetween(MIN_TILT_DEG, MAX_TILT_DEG),
    spin: sign * randomBetween(MIN_LANDING_SPIN_DEG, MAX_LANDING_SPIN_DEG),
  };
};

const createRollPose = (): RollPose => ({
  left: randomLanding(),
  right: randomLanding(),
  scatterX: Math.round(randomBetween(-MAX_SCATTER_X, MAX_SCATTER_X)),
  scatterY: Math.round(randomBetween(-MAX_SCATTER_Y, MAX_SCATTER_Y)),
  lead: Math.random() < 0.5 ? 'left' : 'right',
});

const INITIAL_POSE: RollPose = {
  left: { tilt: -7, spin: -28 },
  right: { tilt: 8, spin: 30 },
  scatterX: 0,
  scatterY: 0,
  lead: 'left',
};

// Android can paint the first rolling frame before a normal effect selects the next pose.
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

type LandingDieProps = {
  value: number | null;
  colorway: DiceColorway;
  side: 'left' | 'right';
  landing: DieLanding;
  /** 0 = mid-air / just released, 1 = at rest. Springs may overshoot past 1 for a bounce. */
  settle: Animated.Value;
};

/**
 * One die with its extruded edge and a soft ground shadow. The shadow tightens and darkens as
 * the die lands, which sells the drop far better than the static edge alone.
 */
function LandingDie({ value, colorway, side, landing, settle }: LandingDieProps) {
  const [farDepth, nearDepth] = DIE_DEPTH_COLORS[colorway];
  const spread = side === 'left' ? -LANDING_SPREAD : LANDING_SPREAD;

  const dieStyle = useMemo(
    () => ({
      transform: [
        {
          translateX: settle.interpolate({
            inputRange: [0, 1],
            outputRange: [spread, 0],
            extrapolate: 'clamp',
          }),
        },
        {
          translateY: settle.interpolate({
            inputRange: [0, 1],
            outputRange: [-DIE_SIZE * 0.22, 0],
            extrapolate: 'clamp',
          }),
        },
        {
          scale: settle.interpolate({
            inputRange: [0, 1, 1.15],
            outputRange: [1.12, 1, 0.97],
            extrapolate: 'clamp',
          }),
        },
        {
          rotateZ: settle.interpolate({
            inputRange: [0, 1],
            outputRange: [`${landing.tilt + landing.spin}deg`, `${landing.tilt}deg`],
            extrapolate: 'clamp',
          }),
        },
      ],
    }),
    [landing.spin, landing.tilt, settle, spread]
  );

  const shadowStyle = useMemo(
    () => ({
      opacity: settle.interpolate({
        inputRange: [0, 1],
        outputRange: [0.12, 0.42],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          scaleX: settle.interpolate({
            inputRange: [0, 1],
            outputRange: [0.7, 1],
            extrapolate: 'clamp',
          }),
        },
        {
          scaleY: settle.interpolate({
            inputRange: [0, 1],
            outputRange: [0.6, 1],
            extrapolate: 'clamp',
          }),
        },
      ],
    }),
    [settle]
  );

  return (
    <View style={styles.dieShell}>
      <Animated.View pointerEvents="none" style={[styles.dieShadow, shadowStyle]} />
      <Animated.View style={[styles.dieBody, dieStyle]}>
        <View style={[styles.dieDepth, styles.dieDepthFar, { backgroundColor: farDepth }]} />
        <View style={[styles.dieDepth, styles.dieDepthNear, { backgroundColor: nearDepth }]} />
        <Dice value={value} size={DIE_SIZE} displayMode="values" colorway={colorway} />
      </Animated.View>
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
  onDiceSettle,
}: DiceCupStageProps) {
  const reducedMotion = useReducedMotion();
  const [highDieColor, lowDieColor] = getRollDiceColorways(rollOwner);
  const cupX = useRef(new Animated.Value(0)).current;
  const cupY = useRef(new Animated.Value(0)).current;
  const cupRotation = useRef(new Animated.Value(0)).current;
  const cupOpacity = useRef(new Animated.Value(1)).current;
  const cupScale = useRef(new Animated.Value(1)).current;
  const groupX = useRef(new Animated.Value(0)).current;
  const groupY = useRef(new Animated.Value(0)).current;
  const leftSettle = useRef(new Animated.Value(1)).current;
  const rightSettle = useRef(new Animated.Value(1)).current;
  const [pose, setPose] = useState<RollPose>(INITIAL_POSE);
  const gestureX = useRef(new Animated.Value(0)).current;
  const gestureY = useRef(new Animated.Value(0)).current;
  const activeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const completionFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedPhaseRef = useRef<DiceCupPhase | null>(null);
  const diceSettledRef = useRef(false);
  const onAnimationCompleteRef = useRef(onAnimationComplete);
  const onDiceSettleRef = useRef(onDiceSettle);
  const onCupTapRef = useRef(onCupTap);
  const onCupSwipeUpRef = useRef(onCupSwipeUp);
  const onCupSwipeSideRef = useRef(onCupSwipeSide);

  onAnimationCompleteRef.current = onAnimationComplete;
  onDiceSettleRef.current = onDiceSettle;
  onCupTapRef.current = onCupTap;
  onCupSwipeUpRef.current = onCupSwipeUp;
  onCupSwipeSideRef.current = onCupSwipeSide;

  useCupPoseEffect(() => {
    if (phase === 'rolling') {
      setPose(createRollPose());
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

  const notifyDiceSettled = useCallback(() => {
    if (diceSettledRef.current) return;
    diceSettledRef.current = true;
    onDiceSettleRef.current?.();
  }, []);

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
        cupX.setValue(CUP_LIFTED_X);
        cupY.setValue(CUP_REVEAL_Y);
        cupRotation.setValue(CUP_LIFTED_ROTATION);
        cupOpacity.setValue(CUP_LIFTED_OPACITY);
        cupScale.setValue(CUP_LIFTED_SCALE);
        leftSettle.setValue(1);
        rightSettle.setValue(1);
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
        cupScale.setValue(1);
      }
    },
    [
      cupOpacity,
      cupRotation,
      cupScale,
      cupX,
      cupY,
      discardDirection,
      groupX,
      groupY,
      leftSettle,
      rightSettle,
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
      cupScale.setValue(1);
    }
    if (phase === 'revealed') {
      // Reached after the lift, or mounted straight into it: cup lifted, dice at rest.
      applyEndState('revealed');
    } else if (phase === 'discarding') {
      leftSettle.setValue(1);
      rightSettle.setValue(1);
    } else if (phase !== 'revealing') {
      // Concealed: arm the next landing.
      leftSettle.setValue(0);
      rightSettle.setValue(0);
      diceSettledRef.current = false;
    }

    const animatedPhase =
      phase === 'rolling' || phase === 'revealing' || phase === 'discarding';
    if (!animatedPhase) return;

    if (reducedMotion) {
      applyEndState(phase);
      if (phase === 'revealing') notifyDiceSettled();
      const frame = requestAnimationFrame(() => finishPhase(phase));
      return () => cancelAnimationFrame(frame);
    }

    if (phase === 'rolling') {
      // The dice are hidden under the cup here, so only the cup and its contents rattle.
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
      // Sub-pixel rest thresholds: the defaults kept these springs "running" for over a second
      // after the cup had visibly stopped, which is why taps right after a shake felt ignored.
      const settle = Animated.parallel([
        Animated.spring(groupX, {
          toValue: 0,
          damping: 13,
          stiffness: 180,
          restDisplacementThreshold: 0.4,
          restSpeedThreshold: 0.4,
          useNativeDriver: true,
        }),
        Animated.spring(groupY, {
          toValue: 0,
          damping: 14,
          stiffness: 180,
          restDisplacementThreshold: 0.4,
          restSpeedThreshold: 0.4,
          useNativeDriver: true,
        }),
        Animated.spring(cupRotation, {
          toValue: 0,
          damping: 14,
          stiffness: 180,
          restDisplacementThreshold: 0.2,
          restSpeedThreshold: 0.2,
          useNativeDriver: true,
        }),
      ]);
      const animation = Animated.sequence([...concealedShakes, settle]);
      activeAnimationRef.current = animation;
      scheduleCompletionFallback('rolling', Math.max(2800, shakeDuration + 1400));
      animation.start(({ finished }) => {
        if (finished) {
          activeAnimationRef.current = null;
          finishPhase('rolling');
        }
      });
    }

    if (phase === 'revealing') {
      const duration = theatrical ? 1150 : 760;
      // Dice start landing once the rim has cleared them, the second die a beat behind.
      const landingDelay = Math.round(duration * 0.38);
      const stagger = theatrical ? 120 : 80;
      const leadValue = pose.lead === 'left' ? leftSettle : rightSettle;
      const trailValue = pose.lead === 'left' ? rightSettle : leftSettle;
      // Rest thresholds are deliberately loose (about 1% of travel): the visible bounce is over in
      // well under a second, and the phase must report done promptly so the controls unlock.
      const landing = (value: Animated.Value) =>
        Animated.spring(value, {
          toValue: 1,
          damping: 11,
          stiffness: 260,
          mass: 0.9,
          overshootClamping: false,
          restDisplacementThreshold: 0.012,
          restSpeedThreshold: 0.03,
          useNativeDriver: true,
        });
      const cupLift = Animated.parallel([
        Animated.timing(cupY, {
          toValue: CUP_REVEAL_Y,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cupX, {
          toValue: CUP_LIFTED_X,
          duration,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cupRotation, {
          toValue: CUP_LIFTED_ROTATION,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Shrink and soften the cup as it rises so it intrudes less on the panels above.
        Animated.timing(cupScale, {
          toValue: CUP_LIFTED_SCALE,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cupOpacity, {
          toValue: CUP_LIFTED_OPACITY,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      const diceLanding = Animated.sequence([
        Animated.delay(landingDelay),
        Animated.parallel([
          landing(leadValue),
          Animated.sequence([Animated.delay(stagger), landing(trailValue)]),
        ]),
      ]);
      const animation = Animated.parallel([cupLift, diceLanding]);
      activeAnimationRef.current = animation;
      scheduleCompletionFallback('revealing', duration + 700);
      // The haptic belongs to the moment the second die touches down, not to the spring's tail.
      const settleTimer = setTimeout(
        notifyDiceSettled,
        landingDelay + stagger + 140
      );
      animation.start(({ finished }) => {
        clearTimeout(settleTimer);
        if (finished) {
          activeAnimationRef.current = null;
          notifyDiceSettled();
          finishPhase('revealing');
        }
      });
      return () => {
        clearTimeout(settleTimer);
        stopActiveAnimation();
      };
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
    cupScale,
    cupX,
    cupY,
    discardDirection,
    finishPhase,
    groupX,
    groupY,
    leftSettle,
    notifyDiceSettled,
    phase,
    pose.lead,
    reducedMotion,
    rightSettle,
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

  const cupStyle = {
    opacity: cupOpacity,
    transform: [
      { perspective: 700 },
      { translateX: cupX },
      { translateY: cupY },
      { scale: cupScale },
      {
        rotateZ: cupRotation.interpolate({
          inputRange: [-30, 30],
          outputRange: ['-30deg', '30deg'],
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
        <View
          style={[
            styles.diceRow,
            {
              transform: [
                { translateX: pose.scatterX },
                { translateY: pose.scatterY },
              ],
            },
            !valuesVisible && styles.diceConcealed,
          ]}
        >
          <LandingDie
            value={shownValues[0]}
            colorway={highDieColor}
            side="left"
            landing={pose.left}
            settle={leftSettle}
          />
          <LandingDie
            value={shownValues[1]}
            colorway={lowDieColor}
            side="right"
            landing={pose.right}
            settle={rightSettle}
          />
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
    width: DIE_SHELL_SIZE,
    height: DIE_SHELL_SIZE,
    overflow: 'visible',
  },
  dieBody: {
    width: DIE_SHELL_SIZE,
    height: DIE_SHELL_SIZE,
  },
  dieShadow: {
    position: 'absolute',
    left: (DIE_SHELL_SIZE - SHADOW_WIDTH) / 2 + DIE_DEPTH_NEAR_OFFSET,
    top: DIE_SHELL_SIZE - SHADOW_HEIGHT * 0.55,
    width: SHADOW_WIDTH,
    height: SHADOW_HEIGHT,
    borderRadius: SHADOW_HEIGHT,
    backgroundColor: '#000000',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.9,
        shadowRadius: SHADOW_HEIGHT * 0.5,
        shadowOffset: { width: 0, height: 0 },
      },
      default: {},
    }),
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
