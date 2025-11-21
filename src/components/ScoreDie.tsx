import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import Dice from './Dice';

type ScoreDieProps = {
  points: number; // 0–5
  style?: ViewStyle;
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
const clampFace = (points: number): number => {
  const face = points + 1;
  if (face < 1) return 1;
  if (face > 6) return 6;
  return face;
};

export const ScoreDie: React.FC<ScoreDieProps> = ({ points, style }) => {
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
        style,
        {
          transform: [{ rotateY }],
        },
      ]}
    >
      <Dice value={face} size={30} rolling={false} displayMode="values" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    overflow: 'hidden',
  },
});
