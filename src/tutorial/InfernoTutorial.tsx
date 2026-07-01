import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '../components/AppText';
import Dice from '../components/Dice';
import DiceCupStage, { type DiceCupPhase } from '../components/DiceCupStage';
import FeltBackground from '../components/FeltBackground';
import StyledButton from '../components/StyledButton';
import { getRollDiceColorways } from '../theme/dice';
import {
  createSurvivalTutorialState,
  survivalTutorialPrompts,
  survivalTutorialReducer,
} from './survivalTutorialMachine';

type Props = {
  visible: boolean;
  onDone: () => void;
};

type PendingCupAction = 'call' | 'roll-inferno' | null;

const ICEMAN = require('../../assets/images/User.png');
const LETTERS = 'INFERNO'.split('');

const splitRoll = (roll: number | null): [number | null, number | null] => {
  if (roll == null) return [null, null];
  return [Math.floor(roll / 10), roll % 10];
};

export function InfernoTutorial({ visible, onDone }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height < 740;
  const [state, dispatch] = useReducer(
    survivalTutorialReducer,
    undefined,
    createSurvivalTutorialState
  );
  const [cupPhase, setCupPhase] = useState<DiceCupPhase>('ready');
  const [animating, setAnimating] = useState(false);
  const pendingCupActionRef = useRef<PendingCupAction>(null);

  useEffect(() => {
    if (!visible) return;
    dispatch({ type: 'RESET' });
    pendingCupActionRef.current = null;
    setCupPhase('ready');
    setAnimating(false);
  }, [visible]);

  useEffect(() => {
    if (animating) return;
    if (state.stage === 'call-first-bluff' || state.stage === 'call-truth') {
      setCupPhase('handed');
      return;
    }
    if (state.stage === 'roll-inferno' || state.stage === 'welcome') {
      setCupPhase('ready');
      return;
    }
    setCupPhase('revealed');
  }, [animating, state.stage]);

  const prompt = survivalTutorialPrompts[state.stage];
  const canCallBluff =
    !animating &&
    cupPhase === 'handed' &&
    (state.stage === 'call-first-bluff' || state.stage === 'call-truth');
  const canRollInferno =
    !animating && state.stage === 'roll-inferno' && cupPhase === 'ready';
  const canClaimInferno = !animating && state.stage === 'claim-inferno';

  const displayRoll =
    pendingCupActionRef.current === 'roll-inferno' ? 21 : state.activeRoll;
  const [rollHi, rollLo] = splitRoll(displayRoll);
  const [claimHi, claimLo] = splitRoll(state.currentClaim);
  const [claimHighColor, claimLowColor] = getRollDiceColorways(
    state.claimOwner === 'cpu' ? 'cpu' : 'player'
  );

  const handleCallBluff = useCallback(() => {
    if (!canCallBluff) return;
    pendingCupActionRef.current = 'call';
    setCupPhase('revealing');
    setAnimating(true);
  }, [canCallBluff]);

  const handleRollInferno = useCallback(() => {
    if (!canRollInferno) return;
    pendingCupActionRef.current = 'roll-inferno';
    setCupPhase('rolling');
    setAnimating(true);
  }, [canRollInferno]);

  const handlePrimaryAction = useCallback(() => {
    if (canRollInferno) {
      handleRollInferno();
      return;
    }
    if (canClaimInferno) dispatch({ type: 'CLAIM_INFERNO' });
  }, [canClaimInferno, canRollInferno, handleRollInferno]);

  const handleCupAnimationComplete = useCallback((completedPhase: DiceCupPhase) => {
    if (
      completedPhase === 'rolling' &&
      pendingCupActionRef.current === 'roll-inferno'
    ) {
      setCupPhase('revealing');
      return;
    }
    if (completedPhase !== 'revealing') return;

    const pendingAction = pendingCupActionRef.current;
    pendingCupActionRef.current = null;
    if (pendingAction === 'call') dispatch({ type: 'CALL_BLUFF' });
    if (pendingAction === 'roll-inferno') dispatch({ type: 'ROLL_INFERNO' });
    setCupPhase('revealed');
    setAnimating(false);
  }, []);

  const handleCoachAction = useCallback(() => {
    if (state.stage === 'complete') {
      onDone();
      return;
    }
    dispatch({ type: 'CONTINUE' });
  }, [onDone, state.stage]);

  const primaryLabel = animating
    ? cupPhase === 'rolling'
      ? 'Rolling...'
      : 'Revealing...'
    : canClaimInferno
      ? 'Claim 21 Inferno'
      : 'Roll';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onDone}
    >
      <FeltBackground>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 8, 18) }]}>
            <Text style={styles.topEyebrow}>INFERNO MODE TUTORIAL</Text>
            <Text style={styles.topProgress}>Lesson {prompt.lesson} of 3</Text>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              compact && styles.contentCompact,
              { paddingBottom: Math.max(insets.bottom + 16, 20) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.survivalCard}>
              <View style={styles.letterRow}>
                {LETTERS.map((letter, index) => (
                  <Text
                    key={`${letter}-${index}`}
                    style={[
                      styles.letter,
                      state.exampleLetterLit && index === 0 && styles.letterLit,
                    ]}
                  >
                    {letter}
                  </Text>
                ))}
              </View>

              <View style={styles.streakHeader}>
                <Text style={styles.streakLabel}>Tutorial Streak</Text>
                <Text style={[styles.streakValue, state.runEnded && styles.streakEndedValue]}>
                  {state.runEnded ? `Ended at ${state.streak}` : state.streak}
                </Text>
              </View>
              <View style={styles.streakTrack}>
                {[0, 1, 2].map((segment) => (
                  <View
                    key={segment}
                    style={[
                      styles.streakSegment,
                      segment < state.streak && styles.streakSegmentActive,
                      state.runEnded && styles.streakSegmentEnded,
                    ]}
                  />
                ))}
              </View>

              <View style={styles.claimArea}>
                <Text style={styles.claimLabel}>Claim</Text>
                {claimHi !== null && claimLo !== null ? (
                  <View style={styles.claimDiceRow}>
                    <Dice value={claimHi} size={30} colorway={claimHighColor} />
                    <View style={styles.claimDiceGap} />
                    <Dice value={claimLo} size={30} colorway={claimLowColor} />
                  </View>
                ) : (
                  <Text style={styles.noClaim}>—</Text>
                )}
              </View>
            </View>

            <View style={styles.coachCard}>
              <View style={styles.coachHeader}>
                <View style={styles.coachAvatarWrap}>
                  <Image source={ICEMAN} style={styles.coachAvatar} resizeMode="contain" />
                </View>
                <Text style={styles.coachEyebrow}>{prompt.eyebrow}</Text>
              </View>
              <Text style={styles.coachTitle}>{prompt.title}</Text>
              <Text style={styles.coachBody}>{prompt.body}</Text>
              {prompt.actionLabel && (
                <StyledButton
                  label={prompt.actionLabel}
                  variant="success"
                  onPress={handleCoachAction}
                  style={[styles.coachAction, styles.blueButton]}
                  testID="survival-tutorial-coach-action"
                />
              )}
            </View>

            <View style={styles.historyCard}>
              <Text style={styles.historyTitle}>Tutorial Events</Text>
              {state.history.length === 0 ? (
                <Text style={styles.historyLine}>Your short run will appear here.</Text>
              ) : (
                state.history.slice(-2).map((entry, index) => (
                  <Text key={`${entry}-${index}`} style={styles.historyLine} numberOfLines={1}>
                    {entry}
                  </Text>
                ))
              )}
            </View>

            <View style={styles.cupArea}>
              <DiceCupStage
                phase={cupPhase}
                diceValues={[rollHi, rollLo]}
                rollOwner={state.rollOwner === 'cpu' ? 'cpu' : 'player'}
                readyStatus={canRollInferno ? 'TAP CUP TO ROLL' : undefined}
                handedStatus={canCallBluff ? 'SWIPE ↑ TO CALL BLUFF' : undefined}
                theatrical={displayRoll === 21 || state.currentClaim === 21}
                onCupTap={canRollInferno ? handleRollInferno : undefined}
                onCupSwipeUp={canCallBluff ? handleCallBluff : undefined}
                onAnimationComplete={handleCupAnimationComplete}
              />
            </View>

            <View style={styles.controls}>
              <View style={styles.actionRow}>
                <StyledButton
                  label={primaryLabel}
                  variant="success"
                  onPress={handlePrimaryAction}
                  disabled={!canRollInferno && !canClaimInferno}
                  style={[
                    styles.actionButton,
                    styles.blueButton,
                    (canRollInferno || canClaimInferno) && styles.guidedAction,
                  ]}
                  testID="survival-tutorial-primary-action"
                />
                <StyledButton
                  label="Call Bluff"
                  variant="primary"
                  onPress={handleCallBluff}
                  disabled={!canCallBluff}
                  style={[styles.actionButton, canCallBluff && styles.guidedAction]}
                  testID="survival-tutorial-call-bluff"
                />
              </View>
            </View>

            <Text style={styles.sandboxNote}>
              Tutorial actions do not affect streaks, records, letters, badges, or stats.
            </Text>

            <StyledButton
              label="Exit Tutorial"
              variant="ghost"
              onPress={onDone}
              style={styles.exitButton}
              textStyle={styles.exitButtonText}
              testID="survival-tutorial-exit"
            />
          </ScrollView>
        </SafeAreaView>
      </FeltBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#343A40',
    backgroundColor: 'rgba(18, 20, 23, 0.94)',
  },
  topEyebrow: {
    color: '#FE9902',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.7,
  },
  topProgress: { color: '#D8DEE4', fontSize: 12, fontWeight: '800', marginTop: 3 },
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 12,
  },
  contentCompact: { paddingTop: 9, gap: 9 },
  survivalCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#343A40',
  },
  letterRow: { flexDirection: 'row', justifyContent: 'center', gap: 9, marginBottom: 12 },
  letter: { color: '#7D8590', fontSize: 21, fontWeight: '900', letterSpacing: 1 },
  letterLit: {
    color: '#FE9902',
    textShadowColor: 'rgba(254, 153, 2, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakLabel: { color: '#D8DEE4', fontSize: 14, fontWeight: '800' },
  streakValue: { color: '#53A7F3', fontSize: 18, fontWeight: '900' },
  streakEndedValue: { color: '#FE9902' },
  streakTrack: { flexDirection: 'row', gap: 5, marginTop: 8 },
  streakSegment: { flex: 1, height: 8, borderRadius: 8, backgroundColor: '#30363D' },
  streakSegmentActive: { backgroundColor: '#53A7F3' },
  streakSegmentEnded: { backgroundColor: '#A86516' },
  claimArea: { alignItems: 'center', marginTop: 10 },
  claimLabel: {
    color: '#AEB7C2',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  claimDiceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  claimDiceGap: { width: 6 },
  noClaim: { color: '#7D8590', fontSize: 22, lineHeight: 34 },
  coachCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#20242A',
    borderWidth: 1,
    borderColor: '#4A535D',
  },
  coachHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  coachAvatarWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#123D5A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  coachAvatar: { width: 23, height: 23 },
  coachEyebrow: { flex: 1, color: '#53A7F3', fontSize: 11, fontWeight: '900', letterSpacing: 0.9 },
  coachTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginBottom: 5 },
  coachBody: { color: '#D8DEE4', fontSize: 14, lineHeight: 20 },
  coachAction: { marginTop: 12 },
  blueButton: { backgroundColor: '#1C75BC', borderColor: '#53A7F3' },
  historyCard: {
    minHeight: 62,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: '#2A2F36',
    borderWidth: 1,
    borderColor: '#3D454F',
  },
  historyTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', marginBottom: 4 },
  historyLine: { color: '#C5CDD5', fontSize: 12, lineHeight: 17 },
  cupArea: { minHeight: 186, alignItems: 'center', justifyContent: 'center' },
  controls: { borderRadius: 14, padding: 12, backgroundColor: '#161B22' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1 },
  guidedAction: {
    borderWidth: 2,
    borderColor: '#FFD166',
    shadowColor: '#FFD166',
    shadowOpacity: 0.45,
    shadowRadius: 7,
    elevation: 4,
  },
  sandboxNote: { color: '#8B949E', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  exitButton: { borderColor: '#B00020', borderWidth: 1, marginTop: 2 },
  exitButtonText: { color: '#FF6B81' },
});

export default InfernoTutorial;
