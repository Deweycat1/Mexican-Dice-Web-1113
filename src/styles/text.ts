import { Platform } from 'react-native';

// Shared helper for tightening Android text layout without affecting iOS.
export const androidTextTight = Platform.OS === 'android'
  ? ({ includeFontPadding: false } as const)
  : {};

