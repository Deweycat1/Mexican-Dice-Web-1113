import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Dice from './Dice';

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
  size = 100,
  onRevealComplete,
}: AnimatedDiceRevealProps) {
  const [showActual, setShowActual] = useState(!hidden);
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hidden) {
      // Reset to hidden state
      rotation.stopAnimation();
      rotation.setValue(0);
      setShowActual(false);
      return;
    }

    // Start flip sequence: rotate 180 degrees with 3D perspective
    rotation.stopAnimation();
    rotation.setValue(0);
    setShowActual(false);

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

  // Switch the visible face at the midpoint of the flip (90 degrees)
  useEffect(() => {
    const listenerId = rotation.addListener(({ value }) => {
      if (value >= 0.5 && !showActual) {
        setShowActual(true);
      }
    });

    return () => {
      rotation.removeListener(listenerId);
    };
  }, [rotation, showActual]);

  const dieStyle = {
    transform: [
      { perspective: 800 }, // IMPORTANT: adds 3D depth perception
      { rotateY },
    ],
  };

  const [hi, lo] = diceValues;

  return (
    <View style={styles.row}>
      {/* Left die with extra padding to prevent clipping */}
      <View style={[styles.dieWrapper, { width: size + 16, height: size + 16 }]}>
        <Animated.View style={[styles.dieOverflow, dieStyle]}>
          <Dice
            value={showActual ? hi : null}
            size={size}
            displayMode={showActual ? 'values' : 'question'}
          />
        </Animated.View>
      </View>

      <View style={{ width: 24 }} />

      {/* Right die with extra padding to prevent clipping */}
      <View style={[styles.dieWrapper, { width: size + 16, height: size + 16 }]}>
        <Animated.View style={[styles.dieOverflow, dieStyle]}>
          <Dice
            value={showActual ? lo : null}
            size={size}
            displayMode={showActual ? 'values' : 'question'}
          />
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
    // Extra padding on container to ensure no clipping during rotation
    paddingHorizontal: 8,
  },
  dieWrapper: {
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    // Extra padding inside each wrapper prevents edge clipping
    padding: 8,
  },
  dieOverflow: {
    overflow: 'visible',
  },
});
