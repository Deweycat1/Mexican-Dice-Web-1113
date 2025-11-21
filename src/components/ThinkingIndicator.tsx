import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

type ThinkingIndicatorProps = {
  size?: number;
  position: 'left' | 'right';
};

const BASE_RED = '#C81D25';

export default function ThinkingIndicator({
  size = 100,
  position,
}: ThinkingIndicatorProps) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (position === 'right') {
      // Gentle pulse animation for thought bubble
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      scale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }
  }, [position, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: position === 'right' ? opacity.value : 1,
    transform: [{ scale: position === 'right' ? scale.value : 1 }],
  }));

  const borderRadius = size <= 40 ? size * 0.2 : 20;

  if (position === 'left') {
    // Brain emoji
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius,
          },
        ]}
      >
        <Text
          style={[
            styles.brainEmoji,
            {
              fontSize: size * 0.6,
            },
          ]}
        >
          🧠
        </Text>
      </View>
    );
  }

  // Thought bubble emoji
  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
        },
        animatedStyle,
      ]}
    >
      <Text
        style={[
          styles.thoughtBubble,
          {
            fontSize: size * 0.6,
          },
        ]}
      >
        💭
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BASE_RED,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brainEmoji: {
    textAlign: 'center',
    lineHeight: undefined,
  },
  thoughtBubble: {
    textAlign: 'center',
    lineHeight: undefined,
  },
});
