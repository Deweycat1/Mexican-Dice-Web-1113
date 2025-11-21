import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, DimensionValue, StyleSheet, View } from 'react-native';
import { Particle } from './Particle';

type Props = {
  visible: boolean;
  onComplete?: () => void;
  particleCount?: number;
  emojis?: string[];
  distance?: number;
  duration?: number;
  particleSize?: number;
  centerX?: DimensionValue;
  centerY?: DimensionValue;
};

type ParticleData = {
  emoji: string;
  angle: number;
  distance: number;
};

const DEFAULT_EMOJIS = ['🎲', '🔥', '🌶️', '💥', '✨'];
const DICE_SIZE = 100; // Match dice component default size

export default function ParticleBurst({
  visible,
  onComplete,
  particleCount = 5,
  emojis = DEFAULT_EMOJIS,
  distance = 25,
  duration = 300,
  particleSize = DICE_SIZE,
  centerX = '50%',
  centerY = '50%',
}: Props) {
  const [animating, setAnimating] = React.useState(false);

  const particles = useMemo<ParticleData[]>(() => {
    return Array.from({ length: particleCount }).map((_, index) => {
      const angle = (Math.PI * 2 * index) / particleCount + Math.random() * 0.3;
      return {
        emoji: emojis[index % emojis.length],
        angle,
        distance: distance + Math.random() * 10,
      };
    });
  }, [particleCount, emojis, distance]);

  const animValues = useRef(particles.map(() => new Animated.Value(0))).current;
  const opacityValues = useRef(particles.map(() => new Animated.Value(1))).current;

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
      {particles.map((particle, index) => {
        const translateX = animValues[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(particle.angle) * particle.distance],
        });
        const translateY = animValues[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(particle.angle) * particle.distance],
        });

        return (
          <Particle
            key={index}
            emoji={particle.emoji}
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
