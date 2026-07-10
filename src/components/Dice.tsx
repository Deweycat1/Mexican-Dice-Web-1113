import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { AppText as Text } from './AppText';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { DIE_SIZE, type DiceColorway } from '../theme/dice';
import { FlameEmojiIcon } from './FlameEmojiIcon';

type DiceProps = {
  value: number | null;
  size?: number;
  rolling?: boolean;
  displayMode?: 'prompt' | 'question' | 'values';
  overlayText?: string;
  thinkingOverlay?: 'rival' | 'thought';
  angryThinking?: boolean;
  colorway?: DiceColorway;
  glow?: boolean;
  randomRestingPose?: boolean;
};

const DICE_PALETTES: Record<
  DiceColorway,
  {
    base: string;
    start: string;
    middle: string;
    core: string;
    edge: string;
    rim: string;
    glow: string;
    spark: string;
    pip: string;
    pipRim: string;
    pipShadow: string;
  }
> = {
  red: {
    base: '#D21A13',
    start: '#FFEEE2',
    middle: '#FF4D05',
    core: '#FFB000',
    edge: '#9A0904',
    rim: '#FFE14A',
    glow: '#FFEF38',
    spark: '#FFF8B5',
    pip: '#F8F7EF',
    pipRim: '#9F9E96',
    pipShadow: '#3E332D',
  },
  blue: {
    base: '#043DFF',
    start: '#9EF7FF',
    middle: '#064BFF',
    core: '#00B8FF',
    edge: '#06106E',
    rim: '#54FBFF',
    glow: '#00D8FF',
    spark: '#B8F7FF',
    pip: '#F7F6EA',
    pipRim: '#9F9E96',
    pipShadow: '#1A2136',
  },
  orange: {
    base: '#F43B00',
    start: '#FFF08A',
    middle: '#FF6A00',
    core: '#FFC600',
    edge: '#A91402',
    rim: '#FFE23A',
    glow: '#FFDC1E',
    spark: '#FFF5A6',
    pip: '#F8F7EF',
    pipRim: '#9F9E96',
    pipShadow: '#3E2B19',
  },
};
const THINKING_RIVAL = require('../../assets/images/ThinkingRival.png');
const ANGRY_RIVAL = require('../../assets/images/angryrival..png');

const RESIN_FLECKS = [
  { x: 0.17, y: 0.19, r: 0.012, opacity: 0.28 },
  { x: 0.33, y: 0.15, r: 0.007, opacity: 0.18 },
  { x: 0.61, y: 0.18, r: 0.01, opacity: 0.2 },
  { x: 0.78, y: 0.28, r: 0.008, opacity: 0.18 },
  { x: 0.2, y: 0.46, r: 0.009, opacity: 0.16 },
  { x: 0.41, y: 0.42, r: 0.014, opacity: 0.25 },
  { x: 0.67, y: 0.51, r: 0.007, opacity: 0.17 },
  { x: 0.31, y: 0.69, r: 0.008, opacity: 0.18 },
  { x: 0.56, y: 0.78, r: 0.011, opacity: 0.19 },
  { x: 0.82, y: 0.72, r: 0.006, opacity: 0.16 },
];

const RESIN_STREAKS = [
  { x: 0.12, y: 0.32, width: 0.28, height: 0.012, opacity: 0.13 },
  { x: 0.49, y: 0.27, width: 0.31, height: 0.009, opacity: 0.11 },
  { x: 0.17, y: 0.59, width: 0.21, height: 0.008, opacity: 0.1 },
  { x: 0.57, y: 0.64, width: 0.24, height: 0.01, opacity: 0.12 },
];

const RESTING_POSES = [
  { x: 0, y: 0, rotation: 0 },
  { x: -0.04, y: 0.025, rotation: 9 },
  { x: 0.035, y: -0.02, rotation: -14 },
  { x: 0.025, y: 0.035, rotation: 15 },
];

const nextPoseIndex = (current: number) =>
  (current + 1 + Math.floor(Math.random() * (RESTING_POSES.length - 1))) %
  RESTING_POSES.length;

const pipsFor: Record<number, { x: number; y: number }[]> = {
  1: [{ x: 0.5, y: 0.5 }],
  2: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.75 },
  ],
  3: [
    { x: 0.25, y: 0.25 },
    { x: 0.5, y: 0.5 },
    { x: 0.75, y: 0.75 },
  ],
  4: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.25 },
    { x: 0.25, y: 0.75 },
    { x: 0.75, y: 0.75 },
  ],
  5: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.25 },
    { x: 0.5, y: 0.5 },
    { x: 0.25, y: 0.75 },
    { x: 0.75, y: 0.75 },
  ],
  6: [
    { x: 0.25, y: 0.2 },
    { x: 0.75, y: 0.2 },
    { x: 0.25, y: 0.5 },
    { x: 0.75, y: 0.5 },
    { x: 0.25, y: 0.8 },
    { x: 0.75, y: 0.8 },
  ],
};

export default function Dice({
  value,
  size = DIE_SIZE,
  rolling,
  displayMode = 'values',
  overlayText,
  thinkingOverlay,
  angryThinking = false,
  colorway = 'red',
  glow = false,
  randomRestingPose = false,
}: DiceProps) {
  const rotate = useSharedValue(0);
  const tilt = useSharedValue(0);
  const pulse = useSharedValue(1);
  const [restingPoseIndex, setRestingPoseIndex] = useState(0);
  const pipLayout: { x: number; y: number }[] | undefined =
    displayMode === 'values' && typeof value === 'number' ? pipsFor[value] : undefined;

  useEffect(() => {
    if (rolling) {
      rotate.value = withRepeat(
        withTiming(360, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        -1,
        false
      );
      tilt.value = withRepeat(
        withSequence(
          withTiming(8, { duration: 150 }),
          withTiming(-8, { duration: 300 }),
          withTiming(0, { duration: 150 })
        ),
        -1,
        false
      );
    } else {
      rotate.value = withTiming(0, { duration: 250 });
      tilt.value = withTiming(0, { duration: 250 });
    }
  }, [rolling, rotate, tilt]);

  useEffect(() => {
    if (displayMode === 'values') {
      pulse.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 360, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.94, { duration: 360, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      true
    );
  }, [displayMode, pulse]);

  useEffect(() => {
    if (
      !randomRestingPose ||
      rolling ||
      displayMode !== 'values' ||
      typeof value !== 'number'
    ) {
      return;
    }

    setRestingPoseIndex(nextPoseIndex);
  }, [displayMode, randomRestingPose, rolling, value]);

  const restingPose =
    randomRestingPose && displayMode === 'values' && !rolling
      ? RESTING_POSES[restingPoseIndex]
      : RESTING_POSES[0];
  const restingTranslateX = restingPose.x * size;
  const restingTranslateY = restingPose.y * size;
  const restingRotation = restingPose.rotation;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: restingTranslateX },
      { translateY: restingTranslateY },
      { rotateZ: `${restingRotation}deg` },
      { rotate: `${rotate.value}deg` },
      { rotateZ: `${tilt.value}deg` },
      { scale: rolling ? 0.98 : 1 },
    ],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: displayMode === 'values' ? 0 : 1,
  }));

  const pipRadius = size * 0.083;
  const overlayLabel = displayMode === 'question' ? '?' : overlayText ?? '';
  const showOverlay = thinkingOverlay != null || displayMode !== 'values';
  const palette = DICE_PALETTES[colorway];
  const thinkingImageSource = angryThinking ? ANGRY_RIVAL : THINKING_RIVAL;
  const gradientIds = useMemo(() => {
    const suffix = Math.random().toString(36).slice(2, 9);
    return {
      edge: `dice-edge-${suffix}`,
      face: `dice-face-${suffix}`,
      glow: `dice-glow-${suffix}`,
      highlight: `dice-highlight-${suffix}`,
      pip: `dice-pip-${suffix}`,
    };
  }, []);

  const borderRadius = size * 0.2;
  const svgRx = size * 0.18;
  const faceInset = size * 0.02;
  const highlightRx = size * 0.15;
  const overlayFontSize = displayMode === 'question' ? size * 0.52 : size * 0.28;
  const outerGlowStyle = glow
    ? {
        shadowColor: palette.glow,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.52,
        shadowRadius: size * 0.13,
        elevation: 5,
      }
    : null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: palette.base,
        },
        outerGlowStyle,
        animatedStyle,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradientIds.face} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={palette.start} stopOpacity={0.9} />
            <Stop offset="18%" stopColor={palette.middle} stopOpacity={0.96} />
            <Stop offset="55%" stopColor={palette.core} stopOpacity={0.78} />
            <Stop offset="100%" stopColor={palette.edge} />
          </LinearGradient>
          <RadialGradient id={gradientIds.glow} cx="48%" cy="43%" r="62%">
            <Stop offset="0%" stopColor={palette.glow} stopOpacity={0.78} />
            <Stop offset="42%" stopColor={palette.middle} stopOpacity={0.28} />
            <Stop offset="100%" stopColor={palette.edge} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={gradientIds.edge} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.75} />
            <Stop offset="24%" stopColor={palette.rim} stopOpacity={0.96} />
            <Stop offset="58%" stopColor={palette.middle} stopOpacity={0.34} />
            <Stop offset="100%" stopColor={palette.edge} stopOpacity={0.92} />
          </LinearGradient>
          <LinearGradient id={gradientIds.highlight} x1="0" y1="0" x2="0.8" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.72} />
            <Stop offset="44%" stopColor="#FFFFFF" stopOpacity={0.16} />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id={gradientIds.pip} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="46%" stopColor={palette.pip} />
            <Stop offset="100%" stopColor="#9B9B93" />
          </LinearGradient>
        </Defs>

        <Rect
          x={faceInset}
          y={faceInset}
          width={size - faceInset * 2}
          height={size - faceInset * 2}
          rx={svgRx}
          fill={`url(#${gradientIds.face})`}
          stroke={palette.edge}
          strokeWidth={size * 0.02}
        />
        <Rect
          x={size * 0.035}
          y={size * 0.035}
          width={size * 0.93}
          height={size * 0.93}
          rx={size * 0.18}
          fill="none"
          stroke={`url(#${gradientIds.edge})`}
          strokeWidth={size * 0.045}
        />
        <Circle
          cx={size * 0.5}
          cy={size * 0.46}
          r={size * 0.36}
          fill={`url(#${gradientIds.glow})`}
        />
        <Rect
          x={size * 0.11}
          y={size * 0.09}
          width={size * 0.62}
          height={size * 0.27}
          rx={highlightRx}
          fill={`url(#${gradientIds.highlight})`}
          opacity={0.86}
        />
        <Rect
          x={size * 0.1}
          y={size * 0.1}
          width={size * 0.8}
          height={size * 0.8}
          rx={size * 0.16}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.18}
          strokeWidth={size * 0.012}
        />

        {RESIN_STREAKS.map(({ x, y, width, height, opacity }, index) => (
          <Rect
            key={`streak-${index}`}
            x={x * size}
            y={y * size}
            width={width * size}
            height={height * size}
            rx={height * size}
            fill={palette.spark}
            opacity={opacity}
          />
        ))}

        {RESIN_FLECKS.map(({ x, y, r, opacity }, index) => (
          <Circle
            key={`fleck-${index}`}
            cx={x * size}
            cy={y * size}
            r={r * size}
            fill={palette.spark}
            opacity={opacity}
          />
        ))}

        {pipLayout?.map(({ x, y }, index) => (
          <React.Fragment key={index}>
            <Circle
              cx={x * size + pipRadius * 0.32}
              cy={y * size + pipRadius * 0.4}
              r={pipRadius * 1.18}
              fill="#000000"
              opacity={0.28}
            />
            <Circle
              cx={x * size}
              cy={y * size}
              r={pipRadius * 1.18}
              fill={palette.pipRim}
            />
            <Circle
              cx={x * size}
              cy={y * size}
              r={pipRadius}
              fill={`url(#${gradientIds.pip})`}
              stroke={palette.pipShadow}
              strokeOpacity={0.32}
              strokeWidth={size * 0.008}
            />
            <Circle
              cx={x * size - pipRadius * 0.3}
              cy={y * size - pipRadius * 0.36}
              r={pipRadius * 0.35}
              fill="#FFFFFF"
              opacity={0.78}
            />
          </React.Fragment>
        ))}
      </Svg>
      {showOverlay &&
        (thinkingOverlay ? (
          <View pointerEvents="none" style={styles.overlay}>
            {thinkingOverlay === 'rival' ? (
              <Image
                source={thinkingImageSource}
                style={{
                  width: size * 0.975,
                  height: size * 0.975,
                  resizeMode: 'contain',
                }}
              />
            ) : angryThinking ? (
              <FlameEmojiIcon size={size * 0.6} />
            ) : (
              <Text
                style={[
                  styles.overlayThought,
                  {
                    fontSize: size * 0.6,
                  },
                ]}
              >
                💭
              </Text>
            )}
          </View>
        ) : (
          <Animated.View pointerEvents="none" style={[styles.overlay, pulseStyle]}>
            <Text style={[styles.overlayText, { fontSize: overlayFontSize }]}>{overlayLabel}</Text>
          </Animated.View>
        ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  overlayThought: {
    textAlign: 'center',
    lineHeight: undefined,
  },
});
