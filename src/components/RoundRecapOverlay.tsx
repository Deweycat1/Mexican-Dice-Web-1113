import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { splitClaim } from '../engine/mexican';
import { AppText as Text } from './AppText';
import Dice from './Dice';

export type RoundRecapTone = 'success' | 'danger' | 'social';

export type RoundRecapRow = {
  label: string;
  value: string;
};

export type RoundRecapData = {
  id: number;
  title: string;
  tone: RoundRecapTone;
  claimed: number;
  actual: number;
  diceMode?: 'claimActual' | 'single';
  singleDiceLabel?: string;
  rows: RoundRecapRow[];
};

type Props = {
  recap: RoundRecapData | null;
  onDone: () => void;
  durationMs?: number;
};

const MINI_DIE_SIZE = 30;

function DicePair({ value }: { value: number }) {
  const [hi, lo] = splitClaim(value);

  return (
    <View style={styles.dicePair}>
      <Dice value={hi} size={MINI_DIE_SIZE} />
      <View style={styles.diceGap} />
      <Dice value={lo} size={MINI_DIE_SIZE} />
    </View>
  );
}

export default function RoundRecapOverlay({ recap, onDone, durationMs = 5000 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const doneRef = useRef(onDone);
  const animationRef = useRef<ReturnType<typeof Animated.sequence> | null>(null);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  const handleDismiss = useCallback(() => {
    animationRef.current?.stop();
    opacity.setValue(0);
    translateY.setValue(8);
    doneRef.current();
  }, [opacity, translateY]);

  useEffect(() => {
    if (!recap) {
      animationRef.current?.stop();
      opacity.setValue(0);
      translateY.setValue(8);
      return;
    }

    animationRef.current?.stop();
    opacity.setValue(0);
    translateY.setValue(8);

    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(durationMs),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -6,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animationRef.current = animation;
    animation.start(({ finished }) => {
      if (finished) {
        doneRef.current();
      }
    });

    return () => {
      animation.stop();
    };
  }, [durationMs, opacity, recap, translateY]);

  if (!recap) return null;

  const toneStyle = recap.tone === 'success' ? styles.cardSuccess : styles.cardDanger;
  const titleStyle = recap.tone === 'success' ? styles.titleSuccess : styles.titleDanger;
  const isSingleDice = recap.diceMode === 'single';
  const resolvedToneStyle =
    recap.tone === 'social' ? styles.cardSocial : toneStyle;
  const resolvedTitleStyle =
    recap.tone === 'social' ? styles.titleSocial : titleStyle;

  return (
    <Animated.View
      pointerEvents="auto"
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable style={styles.dismissLayer} onPress={handleDismiss}>
        <View style={[styles.card, resolvedToneStyle]}>
          <Text style={[styles.title, resolvedTitleStyle]}>{recap.title}</Text>

          {isSingleDice ? (
            <View style={styles.singleDiceSummary}>
              <Text style={styles.diceLabel}>{recap.singleDiceLabel ?? 'Roll'}</Text>
              <DicePair value={recap.claimed} />
            </View>
          ) : (
            <View style={styles.diceSummary}>
              <View style={styles.diceSummaryColumn}>
                <Text style={styles.diceLabel}>Claimed</Text>
                <DicePair value={recap.claimed} />
              </View>
              <View style={styles.divider} />
              <View style={styles.diceSummaryColumn}>
                <Text style={styles.diceLabel}>Actual</Text>
                <DicePair value={recap.actual} />
              </View>
            </View>
          )}

          <View style={styles.rows}>
            {recap.rows.map((row) => (
              <View key={`${row.label}-${row.value}`} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.dismissHint}>
            <Text style={styles.dismissHintText}>Tap anywhere to continue</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  dismissLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '84%',
    maxWidth: 360,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#2A2D31',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  cardSuccess: {
    borderColor: '#53A7F3',
  },
  cardDanger: {
    borderColor: '#C21807',
  },
  cardSocial: {
    borderColor: '#FFD166',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  titleSuccess: {
    color: '#BFE8FF',
  },
  titleDanger: {
    color: '#FFD1D1',
  },
  titleSocial: {
    color: '#FFE8A3',
  },
  diceSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  diceSummaryColumn: {
    flex: 1,
    alignItems: 'center',
  },
  singleDiceSummary: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  diceLabel: {
    color: '#C9D1D9',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  dicePair: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  diceGap: {
    width: 5,
  },
  divider: {
    width: 1,
    height: 42,
    backgroundColor: '#4A5158',
    marginHorizontal: 10,
  },
  rows: {
    borderTopWidth: 1,
    borderTopColor: '#3C4045',
    paddingTop: 8,
    gap: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    color: '#9FA8B2',
    fontSize: 12,
    fontWeight: '700',
  },
  rowValue: {
    flex: 1,
    color: '#F0F6FC',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  dismissHint: {
    borderTopWidth: 1,
    borderTopColor: '#3C4045',
    marginTop: 10,
    paddingTop: 8,
  },
  dismissHintText: {
    color: '#BFE8FF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
