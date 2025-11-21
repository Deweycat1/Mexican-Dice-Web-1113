import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  text: string;
  minShowMs?: number;
  maxShowMs?: number;
  onHeightChange?: (height: number) => void;
};

const IN_DURATION = 260;
const OUT_DURATION = 220;

export default function NarrationBanner({
  text,
  minShowMs = 1500,
  maxShowMs = 1500,
  onHeightChange,
}: Props) {
  const trimmedText = (text ?? '').trim();
  const insets = useSafeAreaInsets();
  const open = useSharedValue(0);

  const [displayText, setDisplayText] = useState('');
  const lastShowRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTextRef = useRef('');
  const heightRef = useRef(0);

  const clearTimers = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (closingTimerRef.current) {
      clearTimeout(closingTimerRef.current);
      closingTimerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  };

  const scheduleHide = () => {
    clearTimers();
    const elapsed = Date.now() - lastShowRef.current;
    const wait = Math.max(0, minShowMs - elapsed);

    hideTimerRef.current = setTimeout(() => {
      open.value = withTiming(0, { duration: OUT_DURATION, easing: Easing.in(Easing.cubic) });
      closingTimerRef.current = setTimeout(() => {
        setDisplayText('');
        if (heightRef.current !== 0) {
          heightRef.current = 0;
          onHeightChange?.(0);
        }
      }, OUT_DURATION);
    }, wait);
  };

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!trimmedText) {
      scheduleHide();
      prevTextRef.current = '';
      return;
    }

    if (trimmedText === prevTextRef.current) {
      return;
    }

    prevTextRef.current = trimmedText;
    clearTimers();
    setDisplayText(trimmedText);
    lastShowRef.current = Date.now();
    open.value = withTiming(1, { duration: IN_DURATION, easing: Easing.out(Easing.cubic) });

    const delay = Math.max(minShowMs, maxShowMs);
    maxTimerRef.current = setTimeout(scheduleHide, delay);
  }, [trimmedText, minShowMs, maxShowMs]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -100 * (1 - open.value) }],
    opacity: 0.7 + 0.3 * open.value,
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (Math.abs(height - heightRef.current) > 0.5) {
      heightRef.current = height;
      onHeightChange?.(height);
    }
  };

  if (!displayText) {
    return null;
  }

  return (
    <Animated.View
      accessibilityRole="header"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      onLayout={handleLayout}
      style={[
        styles.wrap,
        { paddingTop: insets.top + 8, paddingBottom: 12 },
        animatedStyle,
      ]}
    >
      <View style={styles.chip}>
        <Text style={styles.txt} numberOfLines={2}>
          {displayText}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(9, 46, 30, 0.88)',
    borderBottomWidth: Platform.OS === 'ios' ? 0 : 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    zIndex: 50,
  },
  chip: {
    alignSelf: 'center',
    maxWidth: '94%',
    backgroundColor: '#0FA958',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  txt: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
