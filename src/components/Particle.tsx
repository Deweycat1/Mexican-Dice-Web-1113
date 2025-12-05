import React from 'react';
import { Animated, Text } from 'react-native';

type ParticleProps = {
  content: React.ReactNode;
  size?: number;
  animatedStyle?: any;
};

export function Particle({ content, size = 100, animatedStyle }: ParticleProps) {
  const renderContent =
    typeof content === 'string' ? <Text style={{ fontSize: size * 1.0 }}>{content}</Text> : content;

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
      {renderContent}
    </Animated.View>
  );
}
