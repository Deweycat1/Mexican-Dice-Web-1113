import React from 'react';
import { Animated, Text } from 'react-native';

type ParticleProps = {
  emoji: string;
  size?: number;
  animatedStyle?: any;
};

export function Particle({ emoji, size = 100, animatedStyle }: ParticleProps) {
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          justifyContent: 'center',
          alignItems: 'center',
        },
        animatedStyle,
      ]}
    >
      <Text style={{ fontSize: size * 1.0 }}>{emoji}</Text>
    </Animated.View>
  );
}
