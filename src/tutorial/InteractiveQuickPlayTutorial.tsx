import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '../components/AppText';
import Dice from '../components/Dice';
import FeltBackground from '../components/FeltBackground';
import { ScoreDie } from '../components/ScoreDie';
import StyledButton from '../components/StyledButton';
import { getClaimActionLabel } from '../lib/claimActionLabel';
import {
  TUTORIAL_ROUND_COUNT,
  createTutorialState,
  tutorialPrompts,
  tutorialReducer,
  type TutorialAction,
} from './quickPlayTutorialMachine';

type Props = {
  visible: boolean;
  onComplete: () => void;
  onExit: () => void;
};

const ICEMAN = require('../../assets/images/User.png');
const INFERNOMAN = require('../../assets/images/Rival.png');

const splitRoll = (roll: number | null): [number | null, number | null] => {
  if (roll == null) return [null, null];
  return [Math.floor(roll / 10), roll % 10];
};

const formatClaim = (claim: number | null) => {
  if (claim == null) return '—';
  if (claim === 21) return '21 (Inferno)';
  if (claim === 31) return '31 (Reverse)';
  if (claim === 41) return '41 (Social)';
  return String(claim);
};

export default function InteractiveQuickPlayTutorial({ visible, onComplete, onExit }: Props) {
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const dieSize = compact ? 66 : 78;
  const scoreDieSize = compact ? 42 : 48;
  const [state, dispatch] = useReducer(tutorialReducer, undefined, createTutorialState);
  const [rolling, setRolling] = useState(false);
  const [exitConfirmationVisible, setExitConfirmationVisible] = useState(false);
  const rollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      dispatch({ type: 'RESET' });
      setRolling(false);
      setExitConfirmationVisible(false);
    }
    return () => {
      if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
    };
  }, [visible]);

  const prompt = tutorialPrompts[state.stage];
  const [firstDie, secondDie] = splitRoll(state.activeRoll);

  const isRollStep =
    state.stage === 'roll-53' ||
    state.stage === 'answer-61' ||
    state.stage === 'answer-64' ||
    state.stage === 'roll-social' ||
    state.stage === 'answer-54-with-reverse';
  const isTruthClaimStep = state.stage === 'read-53' || state.stage === 'claim-62';
  const isCallStep = state.stage === 'call-65' || state.stage === 'call-inferno';
  const isBluffOptionsStep = state.stage === 'open-bluff-options';
  const isSocialStep = state.stage === 'show-social';
  const isReverseStep = state.stage === 'claim-reverse';

  const primaryLabel = useMemo(() => {
    if (isSocialStep) return getClaimActionLabel(41);
    if (isReverseStep) return getClaimActionLabel(31);
    if (isTruthClaimStep) return getClaimActionLabel(state.activeRoll);
    return 'Roll';
  }, [isReverseStep, isSocialStep, isTruthClaimStep, state.activeRoll]);

  const send = useCallback((action: TutorialAction) => dispatch(action), []);

  const handlePrimaryAction = useCallback(() => {
    if (rolling) return;
    if (isRollStep) {
      setRolling(true);
      rollTimerRef.current = setTimeout(() => {
        dispatch({ type: 'ROLL' });
        setRolling(false);
        rollTimerRef.current = null;
      }, 420);
      return;
    }
    if (isTruthClaimStep) dispatch({ type: 'CLAIM_TRUTH' });
    if (isSocialStep) dispatch({ type: 'SHOW_SOCIAL' });
    if (isReverseStep) dispatch({ type: 'CLAIM_REVERSE' });
  }, [isReverseStep, isRollStep, isSocialStep, isTruthClaimStep, rolling]);

  const requestExit = useCallback(() => {
    setExitConfirmationVisible(true);
  }, []);

  const confirmExit = useCallback(() => {
    setExitConfirmationVisible(false);
    onExit();
  }, [onExit]);

  const handleCoachAction = useCallback(() => {
    if (state.stage === 'complete') {
      onComplete();
      return;
    }
    dispatch({ type: 'CONTINUE' });
  }, [onComplete, state.stage]);

  const diceDisplayMode = state.diceHidden
    ? 'question'
    : state.activeRoll == null
      ? 'prompt'
      : 'values';
  const diceLabel = state.diceHidden
    ? "Infernoman's hidden roll"
    : state.diceOwner === 'cpu'
      ? "Infernoman's actual roll"
      : state.activeRoll == null
        ? 'Ready to roll'
        : 'Your roll';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={requestExit}
    >
      <FeltBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.topEyebrow}>QUICK PLAY TUTORIAL</Text>
              <Text style={styles.topProgress}>
                {state.round === 0
                  ? `Lesson ${prompt.lesson} of 6`
                  : `Round ${state.round} of ${TUTORIAL_ROUND_COUNT}`}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Exit tutorial"
              onPress={requestExit}
              style={({ pressed }) => [styles.exitButton, pressed && styles.pressed]}
              testID="tutorial-exit"
            >
              <Text style={styles.exitButtonText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.content, compact && styles.contentCompact]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.scoreCard}>
              <View style={styles.playerBlock}>
                <Image source={ICEMAN} style={styles.playerAvatar} resizeMode="contain" />
                <Text style={styles.playerName}>You</Text>
                <ScoreDie points={state.playerScore} size={scoreDieSize} />
              </View>

              <View style={styles.claimBlock}>
                <Text style={styles.claimLabel}>CURRENT CLAIM</Text>
                <Text style={styles.claimValue}>{formatClaim(state.currentClaim)}</Text>
                <Text style={styles.healthText}>
                  {state.playerScore} – {state.cpuScore}
                </Text>
              </View>

              <View style={styles.playerBlock}>
                <Image source={INFERNOMAN} style={styles.rivalAvatar} resizeMode="contain" />
                <Text style={styles.rivalName}>Infernoman</Text>
                <ScoreDie points={state.cpuScore} size={scoreDieSize} />
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

              {state.stage === 'ranking' && (
                <View style={styles.rankingCard}>
                  <View style={styles.rankingGroup}>
                    <Text style={styles.rankingLabel}>MIXED ROLLS • HIGH TO LOW</Text>
                    <Text style={styles.rankingValue}>
                      65 &gt; 64 &gt; 63 &gt; 62 &gt; 61 &gt; 54 &gt; 53 &gt; 52 &gt; 51 &gt; 43 &gt; 42 &gt; 32
                    </Text>
                  </View>
                  <View style={styles.rankingGroup}>
                    <Text style={styles.rankingLabel}>DOUBLES • ABOVE EVERY MIXED ROLL</Text>
                    <Text style={styles.rankingValue}>66 &gt; 55 &gt; 44 &gt; 33 &gt; 22 &gt; 11</Text>
                  </View>
                  <View style={styles.rankingRow}>
                    <Text style={styles.rankingLabel}>Top roll</Text>
                    <Text style={styles.rankingValueSpecial}>21 Inferno</Text>
                  </View>
                  <Text style={styles.rankingNote}>
                    31 Reverse and 41 Social are special plays that interrupt normal ranking.
                  </Text>
                </View>
              )}

              {prompt.actionLabel && (
                <StyledButton
                  label={prompt.actionLabel}
                  variant="success"
                  onPress={handleCoachAction}
                  style={[styles.coachAction, styles.gameBlueButton]}
                  testID="tutorial-coach-action"
                />
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open recent events"
              disabled={state.stage !== 'open-history'}
              onPress={() => send({ type: 'OPEN_HISTORY' })}
              style={[
                styles.historyPreview,
                state.stage === 'open-history' && styles.guidedOutline,
              ]}
              testID="tutorial-history"
            >
              <View style={styles.historyHeaderRow}>
                <Text style={styles.historyTitle}>Recent Events</Text>
                <Text style={styles.historyHint}>
                  {state.stage === 'open-history' ? 'TAP TO OPEN' : `${state.history.length}/10`}
                </Text>
              </View>
              <Text style={styles.historyLine} numberOfLines={2}>
                {state.history.length > 0
                  ? state.history[state.history.length - 1]
                  : 'Claims and round results will appear here.'}
              </Text>
            </Pressable>

            <View style={styles.diceSection}>
              <Text style={styles.diceLabel}>{diceLabel}</Text>
              <View style={styles.diceRow}>
                <Dice
                  value={rolling ? 3 : firstDie}
                  size={dieSize}
                  rolling={rolling}
                  displayMode={rolling ? 'values' : diceDisplayMode}
                  overlayText={state.activeRoll == null ? 'Your' : undefined}
                />
                <View style={styles.diceGap} />
                <Dice
                  value={rolling ? 5 : secondDie}
                  size={dieSize}
                  rolling={rolling}
                  displayMode={rolling ? 'values' : diceDisplayMode}
                  overlayText={state.activeRoll == null ? 'Roll' : undefined}
                />
              </View>
            </View>

            <View style={styles.controls}>
              <View style={styles.actionRow}>
                <StyledButton
                  label={primaryLabel}
                  variant="success"
                  onPress={handlePrimaryAction}
                  disabled={
                    rolling ||
                    (!isRollStep && !isTruthClaimStep && !isSocialStep && !isReverseStep)
                  }
                  style={[
                    styles.actionButton,
                    styles.gameBlueButton,
                    (isRollStep || isTruthClaimStep || isSocialStep || isReverseStep) &&
                      styles.guidedAction,
                  ]}
                  testID="tutorial-primary-action"
                />
                <StyledButton
                  label="Call Bluff"
                  variant="primary"
                  onPress={() => send({ type: 'CALL_BLUFF' })}
                  disabled={!isCallStep}
                  style={[styles.actionButton, isCallStep && styles.guidedAction]}
                  testID="tutorial-call-bluff"
                />
              </View>
              <StyledButton
                label="Bluff Options"
                variant="outline"
                onPress={() => send({ type: 'OPEN_BLUFF_OPTIONS' })}
                disabled={!isBluffOptionsStep}
                style={[styles.bluffButton, isBluffOptionsStep && styles.guidedAction]}
                testID="tutorial-bluff-options"
              />
            </View>

            <Text style={styles.sandboxNote}>
              Tutorial games do not affect stats, badges, rankings, or opponent learning.
            </Text>
          </ScrollView>

          <Modal
            visible={state.historyOpen}
            transparent
            animationType="fade"
            onRequestClose={() => send({ type: 'CLOSE_HISTORY' })}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleWrap}>
                    <Text style={styles.modalEyebrow}>ICEMAN • RECENT EVENTS</Text>
                    <Text style={styles.modalTitle}>Last 10 events</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close recent events"
                    onPress={() => send({ type: 'CLOSE_HISTORY' })}
                    style={({ pressed }) => [
                      styles.modalClose,
                      styles.guidedOutline,
                      pressed && styles.pressed,
                    ]}
                    testID="tutorial-history-close"
                  >
                    <Text style={styles.modalCloseText}>✕</Text>
                  </Pressable>
                </View>
                <Text style={styles.modalCoachText}>{prompt.body}</Text>
                <ScrollView style={styles.eventList}>
                  {[...state.history].reverse().map((entry, index) => (
                    <View key={`${entry}-${index}`} style={styles.eventRow}>
                      <View style={styles.eventDot} />
                      <Text style={styles.eventText}>{entry}</Text>
                    </View>
                  ))}
                </ScrollView>
                <StyledButton
                  label="Close Recent Events"
                  variant="success"
                  onPress={() => send({ type: 'CLOSE_HISTORY' })}
                  style={[styles.coachAction, styles.gameBlueButton]}
                />
              </View>
            </View>
          </Modal>

          <Modal
            visible={exitConfirmationVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setExitConfirmationVisible(false)}
          >
            <View style={styles.modalBackdrop}>
              <View style={[styles.modalCard, styles.exitConfirmationCard]}>
                <View style={styles.exitConfirmationHeader}>
                  <View style={styles.exitConfirmationAvatarWrap}>
                    <Image source={ICEMAN} style={styles.exitConfirmationAvatar} resizeMode="contain" />
                  </View>
                  <View style={styles.exitConfirmationHeading}>
                    <Text style={styles.modalEyebrow}>ICEMAN • HOLD UP</Text>
                    <Text style={styles.modalTitle}>Leave the tutorial?</Text>
                  </View>
                </View>

                <Text style={styles.exitConfirmationBody}>
                  We haven’t finished freezing out Infernoman yet. Leaving now discards this tutorial match.
                </Text>

                <View style={styles.exitResetNotice}>
                  <Text style={styles.exitResetIcon}>↻</Text>
                  <Text style={styles.exitResetText}>
                    Your next tutorial will restart from the beginning.
                  </Text>
                </View>

                <StyledButton
                  label="Keep Playing"
                  variant="success"
                  onPress={() => setExitConfirmationVisible(false)}
                  style={[styles.exitKeepPlayingButton, styles.gameBlueButton]}
                  testID="tutorial-exit-cancel"
                />
                <StyledButton
                  label="Exit Tutorial"
                  variant="primary"
                  onPress={confirmExit}
                  style={styles.exitConfirmButton}
                  testID="tutorial-exit-confirm"
                />
              </View>
            </View>
          </Modal>

          <Modal
            visible={state.bluffOptionsOpen}
            transparent
            animationType="fade"
            onRequestClose={() => send({ type: 'CANCEL_BLUFF_OPTIONS' })}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.modalEyebrow}>ICEMAN • GUIDED CLAIM</Text>
                <Text style={styles.modalTitle}>Choose your claim</Text>
                <Text style={styles.modalCoachText}>{prompt.body}</Text>

                <View style={styles.claimComparison}>
                  <View style={styles.claimComparisonItem}>
                    <Text style={styles.comparisonLabel}>YOUR ROLL</Text>
                    <Text style={styles.comparisonBad}>32</Text>
                  </View>
                  <Text style={styles.comparisonArrow}>→</Text>
                  <View style={styles.claimComparisonItem}>
                    <Text style={styles.comparisonLabel}>LEGAL BLUFF</Text>
                    <Text style={styles.comparisonGood}>65</Text>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => send({ type: 'SELECT_CLAIM', claim: 65 })}
                  style={({ pressed }) => [
                    styles.claimOption,
                    styles.guidedOutline,
                    pressed && styles.pressed,
                  ]}
                  testID="tutorial-claim-65"
                >
                  <Text style={styles.claimOptionText}>Claim 65</Text>
                  <Text style={styles.claimOptionSubtext}>Beats Infernoman’s 64</Text>
                </Pressable>

                <Pressable
                  onPress={() => send({ type: 'CANCEL_BLUFF_OPTIONS' })}
                  style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
                >
                  <Text style={styles.cancelText}>Cancel — Keep My Roll</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </FeltBackground>
    </Modal>
  );
}

const BLUE = '#53B5E8';
const ORANGE = '#FE9902';
const PANEL = '#24282D';
const PANEL_LIGHT = '#2D3238';
const TEXT = '#F5F7FA';
const MUTED = '#B8C0C8';

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#171A1E',
    borderBottomWidth: 1,
    borderBottomColor: '#343A40',
  },
  topEyebrow: { color: BLUE, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  topProgress: { color: TEXT, fontSize: 15, fontWeight: '800', marginTop: 2 },
  exitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#5A626B',
    backgroundColor: PANEL,
  },
  exitButtonText: { color: TEXT, fontSize: 21, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 26, rowGap: 12 },
  contentCompact: { paddingTop: 9, rowGap: 9 },
  scoreCard: {
    backgroundColor: PANEL,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#353B42',
  },
  playerBlock: { width: '29%', alignItems: 'center', minHeight: 94 },
  playerAvatar: { width: 35, height: 37 },
  rivalAvatar: { width: 35, height: 37 },
  playerName: { color: BLUE, fontWeight: '900', fontSize: 13, marginBottom: 4 },
  rivalName: { color: ORANGE, fontWeight: '900', fontSize: 12, marginBottom: 4 },
  claimBlock: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  claimLabel: { color: MUTED, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  claimValue: { color: ORANGE, fontSize: 19, fontWeight: '900', marginVertical: 4, textAlign: 'center' },
  healthText: { color: TEXT, fontWeight: '900', fontSize: 13 },
  coachCard: {
    backgroundColor: '#1E242B',
    borderRadius: 17,
    borderWidth: 2,
    borderColor: BLUE,
    padding: 14,
    shadowColor: BLUE,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  coachHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  coachAvatarWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#15394E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  coachAvatar: { width: 24, height: 27 },
  coachEyebrow: { flex: 1, color: BLUE, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  coachTitle: { color: TEXT, fontSize: 20, fontWeight: '900', lineHeight: 24, marginBottom: 5 },
  coachBody: { color: '#DCE4EA', fontSize: 14, lineHeight: 20 },
  coachAction: { marginTop: 12, minHeight: 46, borderWidth: 2, borderColor: '#BFE9FF' },
  gameBlueButton: {
    backgroundColor: '#42C6FF',
    borderColor: '#1E8AC4',
    borderWidth: 2,
    borderRadius: 12,
  },
  rankingCard: {
    backgroundColor: '#171B20',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    rowGap: 7,
  },
  rankingGroup: { rowGap: 3 },
  rankingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankingLabel: { color: MUTED, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  rankingValue: { color: TEXT, fontSize: 12, lineHeight: 17, fontWeight: '900' },
  rankingValueSpecial: { color: ORANGE, fontSize: 13, fontWeight: '900' },
  rankingNote: { color: '#AEB8C2', fontSize: 11, lineHeight: 16, borderTopWidth: 1, borderTopColor: '#343A40', paddingTop: 7 },
  historyPreview: {
    backgroundColor: PANEL_LIGHT,
    borderRadius: 13,
    padding: 11,
    minHeight: 64,
    borderWidth: 1,
    borderColor: '#464D55',
  },
  historyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyTitle: { color: TEXT, fontSize: 14, fontWeight: '900' },
  historyHint: { color: BLUE, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  historyLine: { color: '#D8E0D2', fontSize: 12, lineHeight: 17, marginTop: 5 },
  diceSection: { alignItems: 'center', minHeight: 105, justifyContent: 'center' },
  diceLabel: { color: MUTED, fontSize: 11, fontWeight: '800', marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.7 },
  diceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  diceGap: { width: 14 },
  controls: { backgroundColor: 'rgba(24,27,31,0.86)', borderRadius: 15, padding: 10, rowGap: 9 },
  actionRow: { flexDirection: 'row', columnGap: 9 },
  actionButton: { flex: 1, minHeight: 52 },
  bluffButton: { minHeight: 48 },
  guidedAction: {
    borderWidth: 3,
    borderColor: '#FFD166',
    shadowColor: '#FFD166',
    shadowOpacity: 0.75,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  guidedOutline: {
    borderWidth: 3,
    borderColor: '#FFD166',
    shadowColor: '#FFD166',
    shadowOpacity: 0.7,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  sandboxNote: { color: '#8F99A3', fontSize: 10, textAlign: 'center', lineHeight: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '82%',
    backgroundColor: '#272D33',
    borderRadius: 18,
    padding: 18,
    borderWidth: 2,
    borderColor: BLUE,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitleWrap: { flex: 1, paddingRight: 10 },
  modalEyebrow: { color: BLUE, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 4 },
  modalTitle: { color: TEXT, fontSize: 22, fontWeight: '900' },
  modalClose: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B1F24' },
  modalCloseText: { color: TEXT, fontSize: 20, fontWeight: '800' },
  modalCoachText: { color: '#D7E0E7', fontSize: 14, lineHeight: 20, marginVertical: 12 },
  exitConfirmationCard: {
    borderColor: BLUE,
    shadowColor: BLUE,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 },
    elevation: 10,
  },
  exitConfirmationHeader: { flexDirection: 'row', alignItems: 'center' },
  exitConfirmationAvatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#15394E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 2,
    borderColor: BLUE,
  },
  exitConfirmationAvatar: { width: 43, height: 48 },
  exitConfirmationHeading: { flex: 1 },
  exitConfirmationBody: { color: '#DCE4EA', fontSize: 15, lineHeight: 21, marginTop: 16 },
  exitResetNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2026',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#3D5667',
  },
  exitResetIcon: { color: BLUE, fontSize: 24, fontWeight: '900', marginRight: 10 },
  exitResetText: { color: '#C9D7E1', fontSize: 13, lineHeight: 18, flex: 1 },
  exitKeepPlayingButton: {
    marginTop: 16,
    minHeight: 50,
  },
  exitConfirmButton: {
    marginTop: 10,
    minHeight: 48,
    backgroundColor: '#8F1D23',
    borderWidth: 1,
    borderColor: '#E15B62',
  },
  eventList: { maxHeight: 280 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#3B424A' },
  eventDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ORANGE, marginTop: 6, marginRight: 10 },
  eventText: { color: TEXT, fontSize: 14, lineHeight: 19, flex: 1 },
  claimComparison: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  claimComparisonItem: { backgroundColor: '#1A1E23', borderRadius: 12, padding: 12, minWidth: 100, alignItems: 'center' },
  comparisonLabel: { color: MUTED, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  comparisonBad: { color: '#FF7276', fontSize: 24, fontWeight: '900', marginTop: 3 },
  comparisonGood: { color: '#69D795', fontSize: 24, fontWeight: '900', marginTop: 3 },
  comparisonArrow: { color: TEXT, fontSize: 24, marginHorizontal: 12 },
  claimOption: { backgroundColor: '#22272E', borderRadius: 14, padding: 15, alignItems: 'center' },
  claimOptionText: { color: TEXT, fontSize: 20, fontWeight: '900' },
  claimOptionSubtext: { color: '#D7F7E6', fontSize: 12, marginTop: 3 },
  cancelButton: { marginTop: 12, borderRadius: 12, padding: 12, backgroundColor: '#751A1F', alignItems: 'center' },
  cancelText: { color: TEXT, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
