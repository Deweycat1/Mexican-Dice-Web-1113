// src/components/StyledButton.tsx
import React, { useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
  const sparkleProgress = useRef(new Animated.Value(0)).current;

  const sparkleSweepOpacity = sparkleProgress.interpolate({
    inputRange: [0, 0.15, 0.55, 1],
    outputRange: [0, 0.8, 0.45, 0],
    extrapolate: 'clamp',
  });

  const sparkleSweepTranslate = sparkleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-150, 150],
  });

  type SparkleBurstConfig = {
    key: string;
    start: number;
    rotation: string;
    position: Partial<Record<'top' | 'bottom' | 'left' | 'right', number | string>>;
  };

  const sparkles = useMemo<SparkleBurstConfig[]>(
    () => [
      { key: 'spark-a', start: 0, rotation: '-20deg', position: { top: '18%', left: '18%' } },
      { key: 'spark-b', start: 0.18, rotation: '15deg', position: { top: '20%', right: '16%' } },
      { key: 'spark-c', start: 0.35, rotation: '5deg', position: { bottom: '20%', left: '42%' } },
    ],
    []
  );

  const triggerSparkle = useCallback(() => {
    sparkleProgress.stopAnimation(() => {
      sparkleProgress.setValue(0);
      Animated.timing(sparkleProgress, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, [sparkleProgress]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    triggerSparkle();
  }, [disabled, triggerSparkle]);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
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
      <View style={styles.contentWrapper}>
        <Text style={[styles.label, v.label, disabled && styles.labelDisabled]}>
          {label}
        </Text>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.sparkleSweep,
            {
              opacity: sparkleSweepOpacity,
              transform: [{ translateX: sparkleSweepTranslate }, { rotate: '18deg' }],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        {sparkles.map((sparkle) => {
          const mid = Math.min(1, sparkle.start + 0.28);
          const end = Math.min(1, sparkle.start + 0.6);
          const opacity = sparkleProgress.interpolate({
            inputRange: [sparkle.start, mid, end],
            outputRange: [0, 0.9, 0],
            extrapolate: 'clamp',
          });
          const scale = sparkleProgress.interpolate({
            inputRange: [sparkle.start, mid, end],
            outputRange: [0.4, 1.25, 0.7],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={sparkle.key}
              pointerEvents="none"
              style={[
                styles.sparkleBurst,
                sparkle.position,
                {
                  opacity,
                  transform: [{ scale }, { scaleX: 1.4 }, { rotate: sparkle.rotation }],
                },
              ]}
            />
          );
        })}
      </View>
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
    position: 'relative',
  },
  contentWrapper: {
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
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
  sparkleSweep: {
    position: 'absolute',
    top: -28,
    bottom: -28,
    width: 110,
  },
  sparkleBurst: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
  },
});
