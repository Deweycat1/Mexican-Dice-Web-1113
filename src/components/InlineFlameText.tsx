import React from 'react';
import { StyleSheet, TextProps } from 'react-native';

import { AppText as Text } from './AppText';
import { MEXICAN_ICON } from '../lib/constants';
import { FlameEmojiIcon } from './FlameEmojiIcon';

type InlineFlameTextProps = TextProps & {
  text?: string | null;
  iconSize?: number;
};

export const InlineFlameText: React.FC<InlineFlameTextProps> = ({
  text,
  iconSize = 18,
  ...textProps
}) => {
  const content = text ?? '';
  const segments = content.split(MEXICAN_ICON);

  if (segments.length === 1) {
    return (
      <Text {...textProps}>
        {content}
      </Text>
    );
  }

  return (
    <Text {...textProps}>
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          {segment}
          {index < segments.length - 1 && <FlameEmojiIcon size={iconSize} style={styles.inlineIcon} />}
        </React.Fragment>
      ))}
    </Text>
  );
};

const styles = StyleSheet.create({
  inlineIcon: {
    marginHorizontal: 2,
  },
});
