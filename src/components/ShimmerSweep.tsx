import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  intervalMs?: number;
  durationMs?: number;
  bandWidth?: number;
};

export default function ShimmerSweep({
  intervalMs = 3600,
  durationMs = 900,
  bandWidth = 90,
}: Props) {
  const translate = useRef(new Animated.Value(0));

  const { delayMs, outputRange } = useMemo(() => {
    const delay = Math.max(0, intervalMs - durationMs);
    const min = -bandWidth;
    const max = bandWidth + 240;
    return {
      delayMs: delay,
      outputRange: [min, max],
    };
  }, [intervalMs, durationMs, bandWidth]);

  useEffect(() => {
    translate.current.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translate.current, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(delayMs),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [durationMs, delayMs]);

  const translateX = translate.current.interpolate({
    inputRange: [0, 1],
    outputRange,
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Animated.View
        style={[
          styles.band,
          {
            width: bandWidth,
            transform: [{ translateX }],
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(224,181,12,0)', 'rgba(224,181,12,0.45)', 'rgba(224,181,12,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});
