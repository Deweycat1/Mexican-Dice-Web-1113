import React, { useEffect, useMemo } from 'react';
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
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

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
};

const DICE_PALETTES: Record<
  DiceColorway,
  { base: string; start: string; middle: string; edge: string; rim: string; pip: string }
> = {
  red: {
    base: '#C81D25',
    start: '#E21D25',
    middle: '#B80F15',
    edge: '#70090C',
    rim: '#5C060A',
    pip: '#FCFAFA',
  },
  blue: {
    base: '#078AD1',
    start: '#35D4FF',
    middle: '#078ED8',
    edge: '#034A8C',
    rim: '#032F62',
    pip: '#FFF1C7',
  },
  orange: {
    base: '#F26A16',
    start: '#FFB62E',
    middle: '#F46A12',
    edge: '#A52E06',
    rim: '#702006',
    pip: '#FFF1C7',
  },
};
const THINKING_RIVAL = require('../../assets/images/ThinkingRival.png');
const ANGRY_RIVAL = require('../../assets/images/angryrival..png');

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
}: DiceProps) {
  const rotate = useSharedValue(0);
  const tilt = useSharedValue(0);
  const pulse = useSharedValue(1);
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotate.value}deg` },
      { rotateZ: `${tilt.value}deg` },
      { scale: rolling ? 0.98 : 1 },
    ],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: displayMode === 'values' ? 0 : 1,
  }));

  const pipRadius = size * 0.07;
  const overlayLabel = displayMode === 'question' ? '?' : overlayText ?? '';
  const showOverlay = thinkingOverlay != null || displayMode !== 'values';
  const palette = DICE_PALETTES[colorway];
  const thinkingImageSource = angryThinking ? ANGRY_RIVAL : THINKING_RIVAL;
  const faceGradientId = useMemo(
    () => `dice-face-${Math.random().toString(36).slice(2, 9)}`,
    []
  );
  const highlightGradientId = useMemo(
    () => `dice-highlight-${Math.random().toString(36).slice(2, 9)}`,
    []
  );

  const borderRadius = size * 0.2;
  const svgRx = size * 0.18;
  const faceInset = size * 0.02;
  const highlightRx = size * 0.15;
  const overlayFontSize = displayMode === 'question' ? size * 0.52 : size * 0.28;

  return (
    <Animated.View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius, backgroundColor: palette.base },
        animatedStyle,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={faceGradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={palette.start} stopOpacity={0.94} />
            <Stop offset="58%" stopColor={palette.middle} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={palette.edge} />
          </LinearGradient>
          <LinearGradient id={highlightGradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.35} />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Rect
          x={faceInset}
          y={faceInset}
          width={size - faceInset * 2}
          height={size - faceInset * 2}
          rx={svgRx}
          fill={`url(#${faceGradientId})`}
          stroke={palette.rim}
          strokeWidth={size * 0.025}
        />
        <Rect
          x={size * 0.08}
          y={size * 0.08}
          width={size * 0.42}
          height={size * 0.25}
          rx={highlightRx}
          fill={`url(#${highlightGradientId})`}
        />

        {pipLayout?.map(({ x, y }, index) => (
          <Circle
            key={index}
            cx={x * size}
            cy={y * size}
            r={pipRadius}
            fill={palette.pip}
          />
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
