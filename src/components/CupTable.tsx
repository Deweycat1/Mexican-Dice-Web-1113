import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import Cup, { CupRef } from './Cup';
import Dice from './Dice';
import FeltBackground from './FeltBackground';
import { DIE_SIZE, DICE_SPACING } from '../theme/dice';

type Side = 'player' | 'cpu';

type Props = {
  d1: number | null;
  d2: number | null;
  holder: Side;
  revealTrigger?: number;
  passTrigger?: { to: Side; nonce: number };
  rolling?: boolean;
};

const AnimatedView = Animated.createAnimatedComponent(View);

export default function CupTable({
  d1,
  d2,
  holder,
  revealTrigger,
  passTrigger,
  rolling,
}: Props) {
  const cupRef = useRef<CupRef>(null);
  const bob = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  useEffect(() => {
    bob.value = withTiming(holder === 'player' ? -6 : 6, { duration: 240 });
  }, [holder, bob]);

  useEffect(() => {
    if (revealTrigger) {
      cupRef.current?.lift();
      const id = setTimeout(() => cupRef.current?.lower(), 950);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [revealTrigger]);

  useEffect(() => {
    if (passTrigger) {
      const direction = passTrigger.to === 'player' ? 'left' : 'right';
      cupRef.current?.lower();
      const id = setTimeout(() => cupRef.current?.passTo(direction), 120);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [passTrigger]);

  return (
    <FeltBackground>
      <View style={styles.pad}>
        <View style={styles.diceRow}>
          <Dice value={d1} rolling={rolling} />
          <View style={styles.spacer} />
          <Dice value={d2} rolling={rolling} />
        </View>
        <AnimatedView style={[styles.cupArea, animatedStyle]}>
          <Cup ref={cupRef} />
        </AnimatedView>
      </View>
    </FeltBackground>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, paddingTop: DICE_SPACING, alignItems: 'center' },
  diceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: DICE_SPACING,
    marginBottom: DIE_SIZE * 0.16,
  },
  spacer: { width: DICE_SPACING },
  cupArea: { marginTop: DIE_SIZE * 0.2 },
});
