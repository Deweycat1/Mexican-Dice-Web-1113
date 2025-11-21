// src/components/StyledButton.tsx
import React from 'react';
import {
    Pressable,
    StyleProp,
    StyleSheet,
    Text,
    ViewStyle,
} from 'react-native';

// Try to use your theme colors, but fall back if the file/path changes.
let ThemeColors: any = {
  vegasRed: '#C21807',
  vegasGreen: '#0FA958',
  white: '#FFFFFF',
  black: '#000000',
  feltDark: '#092E1E',
  gray300: '#CCCCCC',
};
try {
  // If your theme file exists, this will override the fallback above.
   
  ThemeColors = require('../theme/colors').Colors;
} catch {
  // keep fallbacks
}

type Variant = 'primary' | 'success' | 'outline' | 'ghost';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export default function StyledButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  testID,
}: Props) {
  const v = getVariant(variant);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={
        variant === 'ghost' || variant === 'outline'
          ? undefined
          : { color: 'rgba(255,255,255,0.15)' }
      }
      style={({ pressed }) =>
        StyleSheet.flatten([
          styles.base,
          v.container,
          disabled && styles.disabled,
          pressed && styles.pressed,
          style,
        ])
      }
    >
      <Text style={[styles.label, v.label, disabled && styles.labelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function getVariant(variant: Variant) {
  switch (variant) {
    case 'primary':
      return {
        container: {
          backgroundColor: ThemeColors.vegasRed || '#C21807',
          borderColor: 'transparent',
        } as ViewStyle,
        label: { color: ThemeColors.white || '#fff' },
      };
    case 'success':
      return {
        container: {
          backgroundColor: ThemeColors.vegasGreen || '#0FA958',
          borderColor: 'transparent',
        } as ViewStyle,
        label: { color: ThemeColors.white || '#fff' },
      };
    case 'outline':
      return {
        container: {
          backgroundColor: 'transparent',
          borderColor: ThemeColors.white || '#fff',
          borderWidth: 2,
        } as ViewStyle,
        label: { color: ThemeColors.white || '#fff' },
      };
    case 'ghost':
      return {
        container: {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        } as ViewStyle,
        label: { color: ThemeColors.white || '#fff' },
      };
    default:
      return {
        container: {
          backgroundColor: ThemeColors.vegasRed || '#C21807',
          borderColor: 'transparent',
        } as ViewStyle,
        label: { color: ThemeColors.white || '#fff' },
      };
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow (iOS)
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    // Elevation (Android)
    elevation: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9, // never 0
  },
  disabled: {
    opacity: 0.55, // dim but visible
  },
  labelDisabled: {
    // keep contrast strong when disabled
    opacity: 0.9,
  },
});
