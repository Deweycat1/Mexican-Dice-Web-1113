import React from 'react';
import { Image, ImageStyle } from 'react-native';

type IceEmojiIconProps = {
  size?: number;
  style?: ImageStyle | ImageStyle[];
};

const IceEmojiIcon: React.FC<IceEmojiIconProps> = ({ size = 18, style }) => {
  return (
    <Image
      source={require('../../assets/images/IceEmoji.png')}
      style={[
        {
          width: size,
          height: size,
          resizeMode: 'contain',
        },
        style,
      ]}
    />
  );
};

export default IceEmojiIcon;
