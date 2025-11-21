import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import Dice from './Dice';

type ScoreDieProps = {
  points: number; // 0–5
  style?: ViewStyle;
  size?: number;
};

/**
 * Clamp points to face value: points + 1
 * 5 points → 6 pips
 * 4 points → 5 pips
 * 3 points → 4 pips
 * 2 points → 3 pips
 * 1 point → 2 pips
 * 0 points → 1 pip
 */
const MAX_POINTS = 5;

const clampFace = (points: number): number => {
  const inverted = MAX_POINTS - points;
  const rawFace = inverted + 1;
  if (rawFace < 1) return 1;
  if (rawFace > 6) return 6;
  return rawFace;
};

export const ScoreDie: React.FC<ScoreDieProps> = ({ points, style, size = 30 }) => {
  const targetFace = useMemo(() => clampFace(points), [points]);

  const [face, setFace] = useState<number>(() => targetFace);

  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (targetFace === face) return;

    // Flip to 90 degrees, swap face at midpoint, then flip back to 0
    Animated.sequence([
      Animated.timing(rotation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(rotation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Swap the face at the halfway point (150ms in)
    const timeout = setTimeout(() => {
      setFace(targetFace);
    }, 150);

    return () => clearTimeout(timeout);
  }, [targetFace, face, rotation]);

  const rotateY = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          width: size,
          height: size,
          borderRadius: size * 0.2,
          transform: [{ rotateY }],
        },
        style,
      ]}
    >
      <Dice value={face} size={size} rolling={false} displayMode="values" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
