import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type DiceProps = {
  value: number | null;
  size?: number;
  rolling?: boolean;
  displayMode?: 'prompt' | 'question' | 'values';
  overlayText?: string;
};

const VEGAS_RED = '#B80F15';
const EDGE = '#70090C';
const PIP = '#fcfafaff';
const BASE_RED = '#C81D25';

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
  size = 100,
  rolling,
  displayMode = 'values',
  overlayText,
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
  const showOverlay = displayMode !== 'values';
  
  // Scale border radius based on size: smaller dice = more square
  const borderRadius = size <= 40 ? size * 0.2 : 20;
  const svgRx = size <= 40 ? size * 0.2 : 18;

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size, borderRadius }, animatedStyle]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="face" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#E21D25" />
            <Stop offset="60%" stopColor={VEGAS_RED} />
            <Stop offset="100%" stopColor={EDGE} />
          </LinearGradient>
          <LinearGradient id="highlight" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.35} />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Rect x={2} y={2} width={size - 4} height={size - 4} rx={svgRx} fill="url(#face)" />
        <Rect
          x={size * 0.08}
          y={size * 0.08}
          width={size * 0.42}
          height={size * 0.25}
          rx={size <= 40 ? size * 0.15 : 12}
          fill="url(#highlight)"
        />

        {pipLayout?.map(({ x, y }, index) => (
          <Circle key={index} cx={x * size} cy={y * size} r={pipRadius} fill={PIP} />
        ))}
      </Svg>
      {showOverlay && (
        <Animated.View pointerEvents="none" style={[styles.overlay, pulseStyle]}>
          <Text
            style={[
              styles.overlayText,
              displayMode === 'question' ? styles.questionText : styles.promptText,
            ]}
          >
            {overlayLabel}
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    borderRadius: 20,
    backgroundColor: BASE_RED,
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
  questionText: {
    fontSize: 52,
  },
  promptText: {
    fontSize: 28,
  },
});
