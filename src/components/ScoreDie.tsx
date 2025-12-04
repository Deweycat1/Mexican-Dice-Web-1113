import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import Dice from './Dice';
import { SMALL_SCORE_DIE_BASE_SIZE } from '../theme/dice';

type ScoreDieProps = {
  points: number; // 0–5
  style?: ViewStyle;
  size?: number;
  animationKey?: number;
};

/**
 * Visualize score loss as the die counting up.
 * 5 points → face 1, 0 points → face 6.
 */
const MAX_POINTS = 5;

const clampFace = (points: number): number => {
  const inverted = MAX_POINTS - points;
  const rawFace = inverted + 1;
  if (rawFace < 1) return 1;
  if (rawFace > 6) return 6;
  return rawFace;
};

export const ScoreDie: React.FC<ScoreDieProps> = ({
  points,
  style,
  size = SMALL_SCORE_DIE_BASE_SIZE,
  animationKey,
}) => {
  const targetFace = useMemo(() => clampFace(points), [points]);

  const [face, setFace] = useState<number>(() => targetFace);

  const rotation = useRef(new Animated.Value(0)).current;
  const entryTranslateY = useRef(new Animated.Value(0)).current;

  const runEntryAnimation = useCallback(() => {
    const entryOffset = size * 0.8;
    entryTranslateY.setValue(-entryOffset);
    Animated.spring(entryTranslateY, {
      toValue: 0,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [entryTranslateY, size]);

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

  useEffect(() => {
    if (typeof animationKey === 'number') {
      runEntryAnimation();
    }
  }, [animationKey, runEntryAnimation]);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          width: size,
          height: size,
          borderRadius: size * 0.2,
          transform: [{ translateY: entryTranslateY }, { rotateY }],
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
