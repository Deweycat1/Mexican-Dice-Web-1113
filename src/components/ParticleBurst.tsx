import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, DimensionValue, StyleSheet, View } from 'react-native';
import { Particle } from './Particle';

type Props = {
  visible: boolean;
  onComplete?: () => void;
  distance?: number;
  duration?: number;
  particleSize?: number;
  centerX?: DimensionValue;
  centerY?: DimensionValue;
};

const STREAK_FLASH_EMOJIS = [
  '🔥',
  '⚡',
  '💥',
  '🚀',
  '🎲',
  '🌶️',
  '💀',
  '🎉',
  '🍀',
  '🎰',
  '😈',
  '🪅',
  '💸',
  '🤯',
  '🧨',
  '🪙',
  '🍄',
] as const;
const DICE_SIZE = 100; // Match dice component default size
const SHUFFLE_INTERVAL_MS = 200;
const SLOT_COUNT = 2;
type StreakEmoji = typeof STREAK_FLASH_EMOJIS[number];
type EmojiPair = readonly [StreakEmoji, StreakEmoji];

const pickRandomEmojiPair = (): EmojiPair => {
  const firstIndex = Math.floor(Math.random() * STREAK_FLASH_EMOJIS.length);
  let secondIndex = Math.floor(Math.random() * STREAK_FLASH_EMOJIS.length);
  while (secondIndex === firstIndex && STREAK_FLASH_EMOJIS.length > 1) {
    secondIndex = Math.floor(Math.random() * STREAK_FLASH_EMOJIS.length);
  }
  return [STREAK_FLASH_EMOJIS[firstIndex], STREAK_FLASH_EMOJIS[secondIndex]];
};

export default function ParticleBurst({
  visible,
  onComplete,
  distance = 25,
  duration = 300,
  particleSize = DICE_SIZE,
  centerX = '50%',
  centerY = '50%',
}: Props) {
  const [animating, setAnimating] = React.useState(false);
  const [emojiPair, setEmojiPair] = React.useState<EmojiPair>(() => pickRandomEmojiPair());
  const shuffleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const slots = useMemo(
    () =>
      Array.from({ length: SLOT_COUNT }).map((_, index) => ({
        offsetX: index === 0 ? -distance : distance,
        offsetY: 0,
      })),
    [distance]
  );

  const animValuesRef = useRef(slots.map(() => new Animated.Value(0)));
  const opacityValuesRef = useRef(slots.map(() => new Animated.Value(1)));

  useEffect(() => {
    if (animValuesRef.current.length !== slots.length) {
      animValuesRef.current = slots.map(() => new Animated.Value(0));
    }
    if (opacityValuesRef.current.length !== slots.length) {
      opacityValuesRef.current = slots.map(() => new Animated.Value(1));
    }
  }, [slots]);

  const animValues = animValuesRef.current;
  const opacityValues = opacityValuesRef.current;

  useEffect(() => {
    if (!visible) {
      if (shuffleIntervalRef.current) {
        clearInterval(shuffleIntervalRef.current);
        shuffleIntervalRef.current = null;
      }
      return;
    }

    setEmojiPair(pickRandomEmojiPair());
    shuffleIntervalRef.current = setInterval(() => {
      setEmojiPair(pickRandomEmojiPair());
    }, SHUFFLE_INTERVAL_MS);

    return () => {
      if (shuffleIntervalRef.current) {
        clearInterval(shuffleIntervalRef.current);
        shuffleIntervalRef.current = null;
      }
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setAnimating(true);
    animValues.forEach((v) => v.setValue(0));
    opacityValues.forEach((v) => v.setValue(1));

    const moveAnimations = animValues.map((value) =>
      Animated.timing(value, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      })
    );

    const fadeAnimations = opacityValues.map((value) =>
      Animated.timing(value, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      })
    );

    Animated.parallel([...moveAnimations, ...fadeAnimations]).start(({ finished }) => {
      if (finished) {
        setAnimating(false);
        onComplete?.();
      }
    });
  }, [visible, animValues, opacityValues, duration, onComplete]);

  if (!visible && !animating) {
    return null;
  }

  return (
    <View style={[styles.container, { top: centerY, left: centerX }]} pointerEvents="none">
      {slots.map((slot, index) => {
        const translateX = animValues[index].interpolate({
          inputRange: [0, 1],
          outputRange: [slot.offsetX, slot.offsetX],
        });
        const translateY = animValues[index].interpolate({
          inputRange: [0, 1],
          outputRange: [slot.offsetY, slot.offsetY],
        });

        return (
          <Particle
            key={index}
            emoji={emojiPair[index] ?? emojiPair[emojiPair.length - 1]}
            size={particleSize}
            animatedStyle={[
              styles.particle,
              {
                opacity: opacityValues[index],
                transform: [{ translateX }, { translateY }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
    zIndex: 1000,
  },
  particle: {
    position: 'absolute',
  },
});
