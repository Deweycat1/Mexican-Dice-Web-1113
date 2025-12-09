import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
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
  const initialShowActual =
    Platform.OS === 'android'
      ? false // Android: always start hidden to avoid pre-flash
      : !hidden; // iOS / web: preserve existing behavior
  const [showActual, setShowActual] = useState(initialShowActual);
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hidden) {
      // Reset to hidden state
      rotation.stopAnimation();
      rotation.setValue(0);
      setShowActual(false);
      return;
    }

    // Start flip sequence
    rotation.stopAnimation();
    rotation.setValue(0);
    setShowActual(false);

    Animated.timing(rotation, {
      toValue: 1,
      duration: Platform.OS === 'android' ? 900 : 450,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        // Delay after animation completes before calling callback
        setTimeout(() => {
          if (onRevealComplete) onRevealComplete();
        }, 1700);
      }
    });
  }, [hidden, onRevealComplete, rotation]);

  // Interpolate rotateY for 3D flip effect
  const rotateY = rotation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '180deg'],
  });

  // Android-only: lightweight "fake 3D flip" using scaleX
  const scaleX = rotation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, -1],
  });

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
    transform:
      Platform.OS === 'android'
        ? [
            // Android: fake 3D flip via scaleX for smoother animation
            { scaleX },
          ]
        : [
            // iOS / web: keep full 3D rotateY flip with perspective
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
          <Dice
            value={showActual ? hi : null}
            size={size}
            displayMode={showActual ? 'values' : 'question'}
          />
        </Animated.View>
      </View>

      <View style={{ width: dieGap }} />

      {/* Right die with extra padding to prevent clipping */}
      <View style={[styles.dieWrapper, { width: wrapperSize, height: wrapperSize, padding: wrapperPadding }]}>
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
  },
  dieWrapper: {
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dieOverflow: {
    overflow: 'visible',
    ...(Platform.OS === 'android'
      ? {
          renderToHardwareTextureAndroid: true,
          needsOffscreenAlphaCompositing: true,
        }
      : {}),
  },
});
