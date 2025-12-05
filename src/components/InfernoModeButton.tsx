import React from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';

const infernoModeButton = require('../../assets/images/infernomodebutton.png');

type InfernoModeButtonProps = {
  onPress?: () => void;
};

export const InfernoModeButton: React.FC<InfernoModeButtonProps> = ({ onPress }) => (
  <Pressable onPress={onPress} style={styles.wrapper} hitSlop={4}>
    <Image source={infernoModeButton} style={styles.image} resizeMode="contain" />
  </Pressable>
);

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  image: {
    width: 182,
    height: 49,
  },
});
