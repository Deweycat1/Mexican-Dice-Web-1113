import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

type Props = {
  visible: boolean;
  onDone?: () => void;
  duration?: number;
  bursts?: number;
};

type Particle = {
  angle: number;
  radius: number;
  size: number;
  color: string;
};

const COLORS = ['#FFD166', '#EF476F', '#06D6A0', '#118AB2', '#FF9F1C'];

export default function FireworksOverlay({
  visible,
  onDone,
  duration = 950,
  bursts = 12,
}: Props) {
  const [animating, setAnimating] = useState(false);

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: bursts }).map((_, index) => {
      const angle = (Math.PI * 2 * index) / bursts + (index % 2 === 0 ? 0 : Math.PI / bursts);
      const radius = 120 + (index % 4) * 28;
      return {
        angle,
        radius,
        size: 6 + (index % 3) * 2,
        color: COLORS[index % COLORS.length],
      };
    });
  }, [bursts]);

  const progressRefs = useRef<Animated.Value[]>(particles.map(() => new Animated.Value(0)));

  useEffect(() => {
    progressRefs.current = particles.map(() => new Animated.Value(0));
  }, [particles]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setAnimating(true);
    progressRefs.current.forEach((value) => value.setValue(0));

    const animations = progressRefs.current.map((value) =>
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );

    const sequence = Animated.stagger(60, animations);
    sequence.start(({ finished }) => {
      if (finished) {
        onDone?.();
      }
      setAnimating(false);
    });

    return () => {
      sequence.stop();
    };
  }, [visible, duration, onDone]);

  if (!visible && !animating) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.wrap]}>
      {particles.map((particle, index) => {
        const progress = progressRefs.current[index] ?? new Animated.Value(0);
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(particle.angle) * particle.radius],
        });
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(particle.angle) * particle.radius],
        });
        const opacity = progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1, 0],
        });
        const scale = progress.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0.4, 1, 0.2],
        });

        const animatedStyle = {
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        };

        return (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              { backgroundColor: particle.color, width: particle.size, height: particle.size },
              animatedStyle,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    borderRadius: 14,
  },
});
