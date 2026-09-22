import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, DimensionValue, StyleSheet, View } from 'react-native';
import { FlameEmojiIcon } from './FlameEmojiIcon';
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

const FLAME_SYMBOL = '__FLAME_ICON__' as const;
const STREAK_FLASH_EMOJIS = [
  FLAME_SYMBOL,
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

  // Read the callback through a ref so an inline `onComplete` prop (new identity
  // every parent render) cannot restart the burst mid-flight.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (visible) {
      setEmojiPair(pickRandomEmojiPair());
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      // Hidden while a burst was in flight: the cleanup below already stopped it,
      // so make sure we do not keep rendering frozen particles.
      setAnimating(false);
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

    const burst = Animated.parallel([...moveAnimations, ...fadeAnimations]);
    burst.start(({ finished }) => {
      if (finished) {
        setAnimating(false);
        onCompleteRef.current?.();
      }
    });

    return () => {
      // Stop on unmount or when `visible` flips; the callback then fires with
      // finished=false and is ignored.
      burst.stop();
    };
  }, [visible, animValues, opacityValues, duration]);

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

        const symbol = emojiPair[index] ?? emojiPair[emojiPair.length - 1];
        const content =
          symbol === FLAME_SYMBOL ? (
            <FlameEmojiIcon size={particleSize} />
          ) : (
            symbol
          );

        return (
          <Particle
            key={index}
            content={content}
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
