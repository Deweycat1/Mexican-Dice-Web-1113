import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Dice from './Dice';
import { DIE_SIZE } from '../theme/dice';

type AnimatedDiceRevealProps = {
  hidden: boolean;
  diceValues: [number | null, number | null];
  size?: number;
  onRevealComplete?: () => void;
};

/**
 * Flip-animates a pair of dice from hidden ("?") faces to their actual values.
 * When `hidden` switches from true -> false, both dice flip horizontally (rotateY)
 * and reveal the real pips with a true 3D effect.
 */
export default function AnimatedDiceReveal({
  hidden,
  diceValues,
  size = DIE_SIZE,
  onRevealComplete,
}: AnimatedDiceRevealProps) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hidden) {
      // Reset to hidden state
      rotation.stopAnimation();
      rotation.setValue(0);
      return;
    }

    // Start flip sequence: rotate 180 degrees with 3D perspective
    rotation.stopAnimation();
    rotation.setValue(0);

    Animated.timing(rotation, {
      toValue: 1,
      duration: 450,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        // Increased delay after animation completes before calling callback
        setTimeout(() => {
          if (onRevealComplete) onRevealComplete();
        }, 1700); // ← extended post-flip pause for 1 full second after reveal
      }
    });
  }, [hidden, onRevealComplete, rotation]);

  // Interpolate rotateY for 3D flip effect
  const rotateY = rotation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '180deg'],
  });

  // Cross-fade between question and actual faces based on flip progress
  const frontOpacity = rotation.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  const backOpacity = rotation.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  const dieStyle = {
    transform: [
      { perspective: size * 8 }, // maintain same relative 3D depth
      { rotateY },
    ],
  };

  const [hi, lo] = diceValues;
  const dieGap = size * 0.24;
  const wrapperSize = size + size * 0.16;
  const wrapperPadding = size * 0.08;

  return (
    <View style={[styles.row, { paddingHorizontal: size * 0.08 }]}>
      {/* Left die with extra padding to prevent clipping */}
      <View style={[styles.dieWrapper, { width: wrapperSize, height: wrapperSize, padding: wrapperPadding }]}>
        <Animated.View style={[styles.dieOverflow, dieStyle]}>
          <Animated.View
            style={[
              styles.dieFaceLayer,
              { opacity: frontOpacity },
            ]}
          >
            <Dice value={null} size={size} displayMode="question" />
          </Animated.View>
          <Animated.View
            style={[
              styles.dieFaceLayer,
              { opacity: backOpacity },
            ]}
          >
            <Dice value={hi} size={size} displayMode="values" />
          </Animated.View>
        </Animated.View>
      </View>

      <View style={{ width: dieGap }} />

      {/* Right die with extra padding to prevent clipping */}
      <View style={[styles.dieWrapper, { width: wrapperSize, height: wrapperSize, padding: wrapperPadding }]}>
        <Animated.View style={[styles.dieOverflow, dieStyle]}>
          <Animated.View
            style={[
              styles.dieFaceLayer,
              { opacity: frontOpacity },
            ]}
          >
            <Dice value={null} size={size} displayMode="question" />
          </Animated.View>
          <Animated.View
            style={[
              styles.dieFaceLayer,
              { opacity: backOpacity },
            ]}
          >
            <Dice value={lo} size={size} displayMode="values" />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  dieWrapper: {
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dieOverflow: {
    overflow: 'visible',
  },
  dieFaceLayer: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
