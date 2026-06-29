import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { AppText as Text } from './AppText';
import FireworksOverlay from './FireworksOverlay';
import StyledButton from './StyledButton';

const APP_DOWNLOAD_URL = 'https://infernodice.com/app';

export type MatchSummarySelfie = {
  id: string;
  uri: string;
  claim: number;
  ownerLabel: string;
};

type Props = {
  visible: boolean;
  didPlayerWin: boolean;
  playerScore: number;
  opponentScore: number;
  opponentName: string;
  finalBlowText: string;
  mySelfiesUsed: number;
  opponentSelfiesUsed: number;
  selfies: MatchSummarySelfie[];
  selfiesLoading: boolean;
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
  mySelfiesUsed,
  opponentSelfiesUsed,
  selfies,
  selfiesLoading,
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
  const shareCardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [renderedSelfieIds, setRenderedSelfieIds] = useState<Record<string, true>>({});
  const selfieIdsKey = selfies.map((selfie) => selfie.id).join('|');

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

  useEffect(() => {
    setRenderedSelfieIds({});
  }, [selfieIdsKey]);

  const recordText = getRecordText({
    opponentName,
    recordGamesPlayed,
    recordWins,
    recordLosses,
    recordLoading,
  });

  const allSelfiesRendered =
    selfies.length > 0 && selfies.every((selfie) => renderedSelfieIds[selfie.id]);
  const canShareCollage =
    Platform.OS !== 'web' &&
    selfies.length > 0 &&
    !selfiesLoading &&
    allSelfiesRendered &&
    !isSharing;

  const markSelfieRendered = useCallback((selfieId: string) => {
    setRenderedSelfieIds((current) =>
      current[selfieId] ? current : { ...current, [selfieId]: true }
    );
  }, []);

  const performShareCollage = useCallback(async () => {
    if (!shareCardRef.current || !canShareCollage) return;

    setIsSharing(true);
    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
        return;
      }

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const imageUri = await captureRef(shareCardRef, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
      });

      await Sharing.shareAsync(imageUri, {
        dialogTitle: 'Share your Inferno Dice match',
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
      });
    } catch (error) {
      console.error('[ONLINE SUMMARY] collage share failed', error);
      Alert.alert('Share failed', 'The collage could not be shared. Please try again.');
    } finally {
      setIsSharing(false);
    }
  }, [canShareCollage]);

  const handleShareCollage = useCallback(() => {
    if (!canShareCollage) return;

    Alert.alert(
      'Share this collage?',
      "It includes your opponent's selfies. Share only with their permission.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => void performShareCollage() },
      ]
    );
  }, [canShareCollage, performShareCollage]);

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

            {selfies.length > 0 || selfiesLoading ? (
              <View style={styles.selfieSection}>
                <Text style={styles.sectionLabel}>MATCH SELFIES</Text>
                {selfiesLoading ? (
                  <ActivityIndicator color="#FE9902" style={styles.selfieLoading} />
                ) : (
                  <>
                    <View ref={shareCardRef} collapsable={false} style={styles.shareCard}>
                      <View style={styles.shareHeader}>
                        <Image
                          source={require('../../assets/images/mexican-dice-logo.png')}
                          style={styles.shareLogo}
                          resizeMode="contain"
                        />
                        <View style={styles.shareHeaderText}>
                          <Text style={styles.shareBrand}>INFERNO DICE</Text>
                          <Text style={styles.shareMatchType}>FRIEND MATCH</Text>
                        </View>
                      </View>

                      <Text
                        style={styles.shareResult}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.65}
                      >
                        {didPlayerWin ? 'YOU WON' : `${opponentName.toUpperCase()} WON`}
                      </Text>
                      <Text style={styles.shareScore} numberOfLines={2}>
                        You {playerScore} - {opponentScore} {opponentName}
                      </Text>

                      <View style={styles.shareSelfieGrid}>
                        {selfies.map((selfie) => (
                          <View key={selfie.id} style={styles.selfieItem}>
                            <Image
                              source={{ uri: selfie.uri }}
                              style={styles.selfieImage}
                              onLoadEnd={() => markSelfieRendered(selfie.id)}
                            />
                            <Text style={styles.selfieLabel} numberOfLines={1}>
                              {selfie.ownerLabel} | Claim {selfie.claim}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.shareFooter}>
                        <Text style={styles.shareFooterLabel}>PLAY WITH YOUR FRIENDS</Text>
                        <Text style={styles.shareDownloadUrl}>{APP_DOWNLOAD_URL}</Text>
                      </View>
                    </View>

                  </>
                )}
              </View>
            ) : null}

            <View style={styles.statsGrid}>
              <Stat label="Your Selfies" value={mySelfiesUsed} />
              <Stat label={`${opponentName}'s Selfies`} value={opponentSelfiesUsed} />
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
            {Platform.OS !== 'web' && (selfies.length > 0 || selfiesLoading) ? (
              <StyledButton
                label="Share"
                variant="primary"
                disabled={!canShareCollage}
                onPress={handleShareCollage}
                style={[styles.action, styles.shareAction]}
              >
                <View style={styles.shareActionContent}>
                  {isSharing || !allSelfiesRendered ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialIcons name="share" size={18} color="#FFFFFF" />
                  )}
                  <Text style={styles.shareActionText}>
                    {isSharing ? 'Preparing' : 'Share'}
                  </Text>
                </View>
              </StyledButton>
            ) : null}
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
  selfieSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
    paddingTop: 12,
  },
  selfieLoading: {
    marginVertical: 18,
  },
  shareCard: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#3D444D',
    borderRadius: 8,
    backgroundColor: '#0D1117',
  },
  shareHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  shareLogo: {
    width: 50,
    height: 45,
  },
  shareHeaderText: {
    marginLeft: 9,
  },
  shareBrand: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  shareMatchType: {
    color: '#FE9902',
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
  },
  shareResult: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 11,
  },
  shareScore: {
    color: '#C9D1D9',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 11,
  },
  shareSelfieGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  selfieItem: {
    width: '48%',
  },
  selfieImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
    backgroundColor: '#0D1117',
  },
  selfieLabel: {
    color: '#F0F6FC',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  shareFooter: {
    alignItems: 'center',
    marginTop: 13,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
  },
  shareFooterLabel: {
    color: '#8CCBFF',
    fontSize: 9,
    fontWeight: '900',
  },
  shareDownloadUrl: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 3,
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
    gap: 6,
    marginTop: 18,
  },
  action: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 5,
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
  shareAction: {
    backgroundColor: '#287CC1',
  },
  shareActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  shareActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  mainMenuAction: {
    backgroundColor: '#C21807',
  },
  actionText: {
    fontSize: 10,
  },
});
