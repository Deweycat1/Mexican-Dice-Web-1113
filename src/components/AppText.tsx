import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';

export function AppText(props: TextProps) {
  return <RNText {...props} allowFontScaling={false} maxFontSizeMultiplier={1.0} />;
}
