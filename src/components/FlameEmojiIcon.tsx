import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

const flameSource = require('../../assets/images/FlameEmoji.png');

type FlameEmojiIconProps = {
  size: number;
  style?: StyleProp<ImageStyle>;
};

export const FlameEmojiIcon: React.FC<FlameEmojiIconProps> = ({ size, style }) => {
  const scaledSize = size * 1.25;
  return (
    <Image source={flameSource} style={[{ width: scaledSize, height: scaledSize, resizeMode: 'contain' }, style]} />
  );
};
