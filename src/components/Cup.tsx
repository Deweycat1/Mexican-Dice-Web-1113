import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export type CupState = 'down' | 'peek' | 'up' | 'passing';
export type CupRef = {
  lift: () => void;
  lower: () => void;
  peek: () => void;
  passTo: (dir: 'left' | 'right') => void;
};

type Props = { width?: number; height?: number };

const CUP_DARK = '#2b1f1a';
const CUP_MED = '#3a2a23';
const CUP_HI = '#6b5850';
const AnimatedView = Animated.createAnimatedComponent(View);

const Cup = forwardRef<CupRef, Props>(({ width = 170, height = 200 }, ref) => {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const shadow = useSharedValue(0.35);

  useImperativeHandle(ref, () => ({
    lift() {
      translateY.value = withTiming(-height * 0.55, {
        duration: 350,
        easing: Easing.out(Easing.quad),
      });
      shadow.value = withTiming(0.2, { duration: 350 });
    },
    lower() {
      translateY.value = withTiming(0, {
        duration: 280,
        easing: Easing.in(Easing.quad),
      });
      shadow.value = withTiming(0.35, { duration: 280 });
    },
    peek() {
      translateY.value = withSequence(
        withTiming(-height * 0.25, { duration: 220 }),
        withDelay(280, withTiming(0, { duration: 220 }))
      );
    },
    passTo(dir) {
      const dx = (dir === 'left' ? -1 : 1) * 120;
      rotate.value = withSequence(
        withTiming(dir === 'left' ? -10 : 10, { duration: 120 }),
        withTiming(0, { duration: 120 })
      );
      translateX.value = withSequence(
        withTiming(dx, { duration: 280, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) })
      );
    },
  }));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotateZ: `${rotate.value}deg` },
    ],
    shadowOpacity: shadow.value,
  }));

  const rimWidth = width * 0.82;
  const baseWidth = width * 0.72;

  return (
    <AnimatedView style={[styles.shadow, { width, height }, animatedStyle]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="leather" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={CUP_HI} />
            <Stop offset="45%" stopColor={CUP_MED} />
            <Stop offset="100%" stopColor={CUP_DARK} />
          </LinearGradient>
          <LinearGradient id="spec" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.18} />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect
          x={(width - rimWidth) / 2}
          y={8}
          width={rimWidth}
          height={height * 0.2}
          rx={18}
          fill="url(#leather)"
        />
        <Rect
          x={(width - rimWidth * 0.9) / 2}
          y={height * 0.18}
          width={rimWidth * 0.9}
          height={height * 0.46}
          rx={18}
          fill="url(#leather)"
        />
        <Rect
          x={(width - baseWidth) / 2}
          y={height * 0.58}
          width={baseWidth}
          height={height * 0.32}
          rx={20}
          fill="url(#leather)"
        />
        <Rect
          x={width * 0.44}
          y={height * 0.14}
          width={width * 0.08}
          height={height * 0.7}
          rx={8}
          fill="url(#spec)"
        />
      </Svg>
    </AnimatedView>
  );
});

const styles = StyleSheet.create({
  shadow: {
    width: 170,
    height: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
});

export default Cup;

