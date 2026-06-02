import React, { useEffect, useRef } from 'react';
import { Animated, Modal, ScrollView, StyleSheet, View } from 'react-native';

import type { BadgeMeta } from '../stats/badgeMetadata';
import { AppText as Text } from './AppText';
import FireworksOverlay from './FireworksOverlay';
import StyledButton from './StyledButton';

type Props = {
  visible: boolean;
  didPlayerWin: boolean;
  playerScore: number;
  cpuScore: number;
  roundsPlayed: number;
  bluffsCaught: number;
  incorrectBluffCalls: number;
  socialRolls: number;
  bestMoment: string | null;
  earnedBadges: BadgeMeta[];
  onPlayAgain: () => void;
  onMainMenu: () => void;
};

export default function QuickPlayMatchSummaryOverlay({
  visible,
  didPlayerWin,
  playerScore,
  cpuScore,
  roundsPlayed,
  bluffsCaught,
  incorrectBluffCalls,
  socialRolls,
  bestMoment,
  earnedBadges,
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
        {didPlayerWin ? <FireworksOverlay visible duration={950} bursts={14} /> : null}

        <Animated.View
          style={[
            styles.panel,
            didPlayerWin ? styles.panelWin : styles.panelLose,
            { opacity, transform: [{ translateY }] },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.eyebrow, didPlayerWin ? styles.eyebrowWin : styles.eyebrowLose]}>
              QUICK PLAY COMPLETE
            </Text>
            <Text style={[styles.title, didPlayerWin ? styles.titleWin : styles.titleLose]}>
              {didPlayerWin ? 'You Win' : 'Infernoman Wins'}
            </Text>
            <Text style={styles.finalScore}>
              You {playerScore} - {cpuScore} Infernoman
            </Text>

            <View style={styles.divider} />

            <View style={styles.statsGrid}>
              <Stat label="Rounds Played" value={roundsPlayed} />
              <Stat label="Bluffs Caught" value={bluffsCaught} />
              <Stat label="Bad Calls" value={incorrectBluffCalls} />
              <Stat label="Social Rolls" value={socialRolls} />
            </View>

            {bestMoment ? (
              <View style={styles.highlight}>
                <Text style={styles.sectionLabel}>BEST MOMENT</Text>
                <Text style={styles.highlightText}>{bestMoment}</Text>
              </View>
            ) : null}

            {earnedBadges.length > 0 ? (
              <View style={styles.badges}>
                <Text style={styles.sectionLabel}>BADGES EARNED</Text>
                {earnedBadges.map((badge) => (
                  <View key={badge.id} style={styles.badgeRow}>
                    <Text style={styles.badgeIcon}>{badge.icon}</Text>
                    <View style={styles.badgeCopy}>
                      <Text style={styles.badgeTitle}>{badge.title}</Text>
                      <Text style={styles.badgeDescription}>{badge.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <StyledButton label="Play Again" variant="success" onPress={onPlayAgain} style={styles.action} />
            <StyledButton label="Main Menu" variant="outline" onPress={onMainMenu} style={styles.action} />
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
    backgroundColor: 'rgba(11, 13, 15, 0.82)',
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    borderRadius: 10,
    borderWidth: 2,
    padding: 18,
    backgroundColor: '#24282C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
  },
  panelWin: {
    borderColor: '#53A7F3',
  },
  panelLose: {
    borderColor: '#8F2018',
    backgroundColor: '#292326',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 5,
  },
  eyebrowWin: {
    color: '#8CCBFF',
  },
  eyebrowLose: {
    color: '#E79088',
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
    textAlign: 'center',
  },
  titleWin: {
    color: '#D7F1FF',
  },
  titleLose: {
    color: '#FFD2CE',
  },
  finalScore: {
    color: '#F0F3F6',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#42484E',
    marginVertical: 14,
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
    color: '#AAB3BC',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  highlight: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#42484E',
    paddingTop: 12,
  },
  sectionLabel: {
    color: '#9FA8B2',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 6,
  },
  highlightText: {
    color: '#FFE29A',
    fontSize: 14,
    fontWeight: '800',
  },
  badges: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#42484E',
    paddingTop: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  badgeIcon: {
    fontSize: 22,
    marginRight: 9,
  },
  badgeCopy: {
    flex: 1,
  },
  badgeTitle: {
    color: '#F0F3F6',
    fontSize: 13,
    fontWeight: '900',
  },
  badgeDescription: {
    color: '#AAB3BC',
    fontSize: 11,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  action: {
    flex: 1,
  },
});
