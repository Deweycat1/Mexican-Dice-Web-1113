import React, { useEffect, useRef } from 'react';
import { Animated, Modal, ScrollView, StyleSheet, View } from 'react-native';

import { AppText as Text } from './AppText';
import FireworksOverlay from './FireworksOverlay';
import StyledButton from './StyledButton';

type Props = {
  visible: boolean;
  didPlayerWin: boolean;
  playerScore: number;
  opponentScore: number;
  opponentName: string;
  finalBlowText: string;
  myWinksUsed: number;
  opponentWinksUsed: number;
  recordWins: number | null;
  recordLosses: number | null;
  recordGamesPlayed: number | null;
  recordLoading: boolean;
  rematchLabel: string;
  rematchDisabled: boolean;
  onRematch: () => void;
  onMainMenu: () => void;
};

export default function OnlineMatchSummaryOverlay({
  visible,
  didPlayerWin,
  playerScore,
  opponentScore,
  opponentName,
  finalBlowText,
  myWinksUsed,
  opponentWinksUsed,
  recordWins,
  recordLosses,
  recordGamesPlayed,
  recordLoading,
  rematchLabel,
  rematchDisabled,
  onRematch,
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

  const recordText = getRecordText({
    opponentName,
    recordGamesPlayed,
    recordWins,
    recordLosses,
    recordLoading,
  });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        {didPlayerWin ? <FireworksOverlay visible duration={950} bursts={14} /> : null}

        <Animated.View
          style={[
            styles.panel,
            didPlayerWin ? styles.panelWin : styles.panelLoss,
            { opacity, transform: [{ translateY }] },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.eyebrow, didPlayerWin ? styles.eyebrowWin : styles.eyebrowLoss]}>
              MULTIPLAYER MATCH COMPLETE
            </Text>
            <Text style={styles.title}>{didPlayerWin ? 'You Win' : `${opponentName} Wins`}</Text>
            <Text style={styles.finalScore}>
              You {playerScore} - {opponentScore} {opponentName}
            </Text>

            <View style={styles.divider} />

            <View style={styles.highlight}>
              <Text style={styles.sectionLabel}>FINAL BLOW</Text>
              <Text style={styles.highlightText}>{finalBlowText}</Text>
            </View>

            <View style={styles.record}>
              <Text style={styles.sectionLabel}>HEAD-TO-HEAD</Text>
              <Text style={styles.recordText}>{recordText}</Text>
            </View>

            <View style={styles.statsGrid}>
              <Stat label="Your Winks" value={myWinksUsed} />
              <Stat label={`${opponentName}'s Winks`} value={opponentWinksUsed} />
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <StyledButton
              label={rematchLabel}
              variant="success"
              disabled={rematchDisabled}
              onPress={onRematch}
              style={[
                styles.action,
                rematchLabel === 'Accept Rematch'
                  ? styles.acceptRematchAction
                  : styles.rematchAction,
              ]}
              textStyle={styles.actionText}
            />
            <StyledButton
              label="Main Menu"
              variant="primary"
              onPress={onMainMenu}
              style={[styles.action, styles.mainMenuAction]}
              textStyle={styles.actionText}
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
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function getRecordText({
  opponentName,
  recordGamesPlayed,
  recordWins,
  recordLosses,
  recordLoading,
}: {
  opponentName: string;
  recordGamesPlayed: number | null;
  recordWins: number | null;
  recordLosses: number | null;
  recordLoading: boolean;
}) {
  if (recordLoading) return `Updating record vs ${opponentName}...`;
  if (recordGamesPlayed === null || recordWins === null || recordLosses === null) {
    return `Record vs ${opponentName} is updating`;
  }
  return `${recordWins}-${recordLosses} vs ${opponentName}`;
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
  panelWin: {
    borderColor: '#53A7F3',
  },
  panelLoss: {
    borderColor: '#C21807',
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
  eyebrowLoss: {
    color: '#FE9902',
  },
  title: {
    color: '#F0F6FC',
    fontSize: 27,
    fontWeight: '900',
    textAlign: 'center',
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
    backgroundColor: '#30363D',
    marginVertical: 14,
  },
  highlight: {
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
  record: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
    paddingTop: 12,
  },
  recordText: {
    color: '#F0F6FC',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    marginTop: 15,
  },
  stat: {
    width: '50%',
    alignItems: 'center',
    paddingHorizontal: 6,
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
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  action: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
  },
  rematchAction: {
    backgroundColor: '#0FA958',
  },
  acceptRematchAction: {
    backgroundColor: '#FE9902',
  },
  mainMenuAction: {
    backgroundColor: '#C21807',
  },
  actionText: {
    fontSize: 13,
  },
});
