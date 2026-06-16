import React, { useEffect, useRef } from 'react';
import { Animated, Modal, ScrollView, StyleSheet, View } from 'react-native';

import { INFERNO_SLOTS, type InfernoSlotId } from '../survival/infernoLetters';
import { AppText as Text } from './AppText';
import FireworksOverlay from './FireworksOverlay';
import StyledButton from './StyledButton';

type Props = {
  visible: boolean;
  streak: number;
  personalBest: number;
  bluffsCaught: number;
  infernosRolled: number;
  socialRolls: number;
  claimsMade: number;
  collectedLetters: Set<InfernoSlotId>;
  highlightLabel: string;
  highlightText: string;
  didSetPersonalBest: boolean;
  onPlayAgain: () => void;
  onMainMenu: () => void;
};

export default function InfernoRunSummaryOverlay({
  visible,
  streak,
  personalBest,
  bluffsCaught,
  infernosRolled,
  socialRolls,
  claimsMade,
  collectedLetters,
  highlightLabel,
  highlightText,
  didSetPersonalBest,
  onPlayAgain,
  onMainMenu,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      translateY.setValue(12);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        {didSetPersonalBest ? <FireworksOverlay visible duration={950} bursts={14} /> : null}

        <Animated.View
          style={[
            styles.panel,
            didSetPersonalBest ? styles.panelRecord : styles.panelDefault,
            { opacity, transform: [{ translateY }] },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.eyebrow, didSetPersonalBest && styles.eyebrowRecord]}>
              {didSetPersonalBest ? 'NEW PERSONAL BEST' : 'INFERNO RUN COMPLETE'}
            </Text>
            <Text style={[styles.title, didSetPersonalBest && styles.titleRecord]}>
              Streak {streak}
            </Text>
            <Text style={styles.personalBest}>Personal Best: {personalBest}</Text>

            <View style={styles.divider} />

            <View style={styles.highlight}>
              <Text style={styles.sectionLabel}>{highlightLabel}</Text>
              <Text style={styles.highlightText}>{highlightText}</Text>
            </View>

            <View style={styles.statsGrid}>
              <Stat label="Bluffs Caught" value={bluffsCaught} />
              <Stat label="Infernos Rolled" value={infernosRolled} />
              <Stat label="Social Rolls" value={socialRolls} />
              <Stat label="Your Claims" value={claimsMade} />
            </View>

            <View style={styles.letters}>
              <Text style={styles.sectionLabel}>INFERNO LETTERS</Text>
              <View style={styles.letterRow}>
                {INFERNO_SLOTS.map((slot) => {
                  const collected = collectedLetters.has(slot.id);
                  return (
                    <View
                      key={slot.id}
                      style={[styles.letterCell, collected && styles.letterCellCollected]}
                    >
                      <Text style={[styles.letterText, collected && styles.letterTextCollected]}>
                        {slot.char}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <StyledButton
              label="Play Again"
              variant="success"
              onPress={onPlayAgain}
              style={[styles.action, styles.playAgainAction]}
            />
            <StyledButton
              label="Main Menu"
              variant="primary"
              onPress={onMainMenu}
              style={[styles.action, styles.mainMenuAction]}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(11, 13, 15, 0.84)',
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    borderRadius: 10,
    borderWidth: 2,
    padding: 18,
    backgroundColor: '#161B22',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
  },
  panelDefault: {
    borderColor: '#C21807',
  },
  panelRecord: {
    borderColor: '#42C6FF',
    backgroundColor: '#161B22',
  },
  eyebrow: {
    color: '#FE9902',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 5,
  },
  eyebrowRecord: {
    color: '#42C6FF',
  },
  title: {
    color: '#F0F6FC',
    fontSize: 27,
    fontWeight: '900',
    textAlign: 'center',
  },
  titleRecord: {
    color: '#F0F6FC',
  },
  personalBest: {
    color: '#F0F3F6',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#30363D',
    marginVertical: 14,
  },
  highlight: {
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sectionLabel: {
    color: '#FE9902',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  highlightText: {
    color: '#F0F6FC',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  stat: {
    width: '50%',
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
  },
  statLabel: {
    color: '#8B949E',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  letters: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
    paddingTop: 12,
  },
  letterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  letterCell: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#30363D',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  letterCellCollected: {
    borderColor: '#FE9902',
    backgroundColor: '#C21807',
  },
  letterText: {
    color: '#8B949E',
    fontSize: 15,
    fontWeight: '900',
  },
  letterTextCollected: {
    color: '#F0F6FC',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  action: {
    flex: 1,
  },
  playAgainAction: {
    borderWidth: 1,
    borderColor: '#F0F6FC',
  },
  mainMenuAction: {
    borderWidth: 1,
    borderColor: '#F0F6FC',
  },
});
