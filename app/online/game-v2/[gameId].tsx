import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AnimatedDiceReveal from '../../../src/components/AnimatedDiceReveal';
import BluffModal from '../../../src/components/BluffModal';
import Dice from '../../../src/components/Dice';
import FeltBackground from '../../../src/components/FeltBackground';
import { ScoreDie } from '../../../src/components/ScoreDie';
import StyledButton from '../../../src/components/StyledButton';
import ThinkingIndicator from '../../../src/components/ThinkingIndicator';
import {
  claimMatchesRoll,
  isLegalRaise,
  isReverseOf,
  resolveBluff,
  splitClaim,
} from '../../../src/engine/mexican';
import { computeLegalTruth, rollDice } from '../../../src/engine/onlineRoll';
import { getCurrentUser } from '../../../src/lib/auth';
import { buildClaimOptions } from '../../../src/lib/claimOptions';
import { supabase } from '../../../src/lib/supabase';

const formatClaim = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return ' - ';
  if (value === 21) return '21 (Mexican)';
  if (value === 31) return '31 (Reverse)';
  if (value === 41) return '41 (Social)';
  const [hi, lo] = splitClaim(value);
  return `${hi}${lo}`;
};
const formatRoll = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return ' - ';
  const [hi, lo] = splitClaim(value);
  return `${hi}${lo}`;
};
const facesFromRoll = (value: number | null | undefined): [number | null, number | null] => {
  if (typeof value !== 'number' || Number.isNaN(value)) return [null, null];
  return splitClaim(value);
};

// Shared round metadata persisted on games_v2.round_state
export type RoundState = {
  baselineClaim: number | null;
  lastAction: 'normal' | 'reverseVsMexican';
  lastClaimer: 'host' | 'guest' | null;
  history: HistoryItem[];
  hostRoll: number | null;
  guestRoll: number | null;
  hostMustBluff: boolean;
  guestMustBluff: boolean;
  lastClaimRoll: number | null;
  socialRevealDice: [number | null, number | null] | null;
  socialRevealNonce: number;
};

type HistoryItem =
  | { id: string; type: 'claim'; who: 'host' | 'guest'; claim: number; timestamp: string }
  | { id: string; type: 'event'; text: string; timestamp: string };

type GameStatus = 'waiting' | 'in_progress' | 'finished' | 'cancelled';

type OnlineGameV2 = {
  id: string;
  host_id: string;
  guest_id: string | null;
  status: GameStatus;
  current_player_id: string | null;
  host_score: number;
  guest_score: number;
  last_roll_1: number | null;
  last_roll_2: number | null;
  last_claim: number | null | string;
  created_at: string;
  updated_at: string;
  round_state?: RoundState | null;
};

const defaultRoundState: RoundState = {
  baselineClaim: null,
  lastAction: 'normal',
  lastClaimer: null,
  history: [],
  hostRoll: null,
  guestRoll: null,
  hostMustBluff: false,
  guestMustBluff: false,
  lastClaimRoll: null,
  socialRevealDice: null,
  socialRevealNonce: 0,
};

const clampScore = (value: number) => Math.max(0, value);
const uuid = () => Math.random().toString(36).slice(2, 10);
const RULES_TEXT = `General Gameplay

Roll two dice and read them higher-first (3 and 5 → 53). Doubles beat mixed rolls, and Special Rolls beat everything. After you roll, claim a number to the next player ... truth or bluff. You may claim any roll that matches or beats the last claim, or a Special Roll (21 or 31 ... you cannot lie about a 41).

Special Rolls

🎲 21 “Mexican”: Claiming a Mexican makes the round worth 2 points. The next player must either accept the challenge and roll for a real 21, or Call Bluff. Whoever is wrong ... caller or claimer ... loses 2 points. Reverse does not reduce the penalty.

🔄 31 “Reverse”: Sends the challenge back so the previous player must now match or beat the reflected roll. Reverse can always be claimed (truth or bluff). If a Mexican is reversed onto someone, the 2-point penalty still applies.

🍺 41 “Social”: Must be shown, never bluffed. When rolled, the round resets ... all claims clear, no points are lost, and the dice pass to the next player.

Bluffs

If a bluff is suspected, the player may Call Bluff instead of accepting the claim.
• In normal rounds:
  • Claim true → caller loses 1 point
  • Claim false → bluffer loses 1 point

• In Mexican rounds:
  • The loser always loses 2 points

Scoring & Scorekeeper Dice

Everyone starts with 5 points. When you lose points, your scorekeeper die counts up instead of down:
• At full health (5 points), your die shows 1
• As you lose points, the die climbs toward 6
• When your die hits 6, you’ve reached 0 points ... and you’re out

This makes it easy to see danger at a glance:
• Low die = safe
• High die = close to elimination
• Face 6 = game over`;

export default function OnlineGameV2Screen() {
  const params = useLocalSearchParams<{ gameId?: string | string[] }>();
  const router = useRouter();
  const normalizedGameId = useMemo(() => {
    const raw = params.gameId;
    if (Array.isArray(raw)) return raw[0];
    return raw ?? null;
  }, [params.gameId]);

  const [game, setGame] = useState<OnlineGameV2 | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimPickerOpen, setClaimPickerOpen] = useState(false);
  const [banner, setBanner] = useState<{ type: 'got-em' | 'womp-womp' | 'social'; text: string } | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hostName, setHostName] = useState<string>('Host');
  const [guestName, setGuestName] = useState<string>('Guest');
  const [rollingAnim, setRollingAnim] = useState(false);
  const [revealDiceValues, setRevealDiceValues] = useState<[number | null, number | null] | null>(null);
  const [isRevealingBluff, setIsRevealingBluff] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [showSocialReveal, setShowSocialReveal] = useState(false);
  const [socialDiceValues, setSocialDiceValues] = useState<[number | null, number | null]>([null, null]);
  const [socialRevealHidden, setSocialRevealHidden] = useState(true);
  const [isRevealAnimating, setIsRevealAnimating] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      setUserId(user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!normalizedGameId) {
      setError('No game specified');
      setLoading(false);
      return;
    }
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    const loadGame = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('games_v2')
        .select('*')
        .eq('id', normalizedGameId)
        .single();

      if (!isMounted) return;
      if (fetchError || !data) {
        setError(fetchError?.message ?? 'Game not found');
        setLoading(false);
        return;
      }
      setGame(data as OnlineGameV2);
      setLoading(false);
    };

    loadGame();

    channel = supabase
      .channel(`game-v2-${normalizedGameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games_v2', filter: `id=eq.${normalizedGameId}` },
        (payload) => {
          if (payload.new) {
            setGame(payload.new as OnlineGameV2);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [normalizedGameId]);

  useEffect(() => {
    if (!game) return;
    const loadNames = async () => {
      if (game.host_id) {
        const { data } = await supabase
          .from('users')
          .select('username')
          .eq('id', game.host_id)
          .single();
        if (data?.username) setHostName(data.username);
      }
      if (game.guest_id) {
        const { data } = await supabase
          .from('users')
          .select('username')
          .eq('id', game.guest_id)
          .single();
        if (data?.username) setGuestName(data.username);
      }
    };
    loadNames();
  }, [game?.host_id, game?.guest_id]);

  useEffect(() => {
    if (!banner) return;
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 2500);
    return () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [banner]);
  useEffect(() => {
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, []);

  const roundState: RoundState = useMemo(() => {
    const raw = game?.round_state;
    if (raw && typeof raw === 'object') {
      return {
        ...defaultRoundState,
        ...raw,
        history: Array.isArray(raw.history) ? raw.history : [],
        lastClaimRoll:
          typeof (raw as RoundState).lastClaimRoll === 'number' || (raw as RoundState).lastClaimRoll === null
            ? (raw as RoundState).lastClaimRoll ?? null
            : null,
        socialRevealNonce:
          typeof (raw as RoundState).socialRevealNonce === 'number'
            ? (raw as RoundState).socialRevealNonce
            : 0,
        socialRevealDice:
          Array.isArray((raw as RoundState).socialRevealDice) &&
          (raw as RoundState).socialRevealDice.length === 2
            ? [
                typeof (raw as RoundState).socialRevealDice?.[0] === 'number' || (raw as RoundState).socialRevealDice?.[0] === null
                  ? (raw as RoundState).socialRevealDice?.[0] ?? null
                  : null,
                typeof (raw as RoundState).socialRevealDice?.[1] === 'number' || (raw as RoundState).socialRevealDice?.[1] === null
                  ? (raw as RoundState).socialRevealDice?.[1] ?? null
                  : null,
              ]
            : null,
      };
    }
    return defaultRoundState;
  }, [game?.round_state, game?.id]);
  const socialRevealNonceRef = useRef(roundState.socialRevealNonce ?? 0);
  useEffect(() => {
    const nonce = roundState.socialRevealNonce ?? 0;
    if (nonce < socialRevealNonceRef.current) {
      socialRevealNonceRef.current = nonce;
    }
  }, [roundState.socialRevealNonce]);

  const lastClaim = useMemo(() => {
    if (game?.last_claim == null) return null;
    if (typeof game.last_claim === 'number') return game.last_claim;
    const parsed = parseInt(game.last_claim, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [game?.last_claim]);

  const myRole: 'host' | 'guest' | null = useMemo(() => {
    if (!game || !userId) return null;
    if (userId === game.host_id) return 'host';
    if (userId === game.guest_id) return 'guest';
    return null;
  }, [game?.host_id, game?.guest_id, userId]);

  const isMyTurn = !!game && !!userId && game.current_player_id === userId;
  const opponentRole: 'host' | 'guest' | null = myRole === 'host' ? 'guest' : myRole === 'guest' ? 'host' : null;
  const myRoll = myRole === 'host' ? roundState.hostRoll : myRole === 'guest' ? roundState.guestRoll : null;
  const mustBluff = myRole === 'host' ? roundState.hostMustBluff : myRole === 'guest' ? roundState.guestMustBluff : false;
  const opponentName = myRole === 'host' ? guestName : hostName;
  const myScore = myRole === 'host' ? game?.host_score ?? 0 : game?.guest_score ?? 0;
  const opponentScore = myRole === 'host' ? game?.guest_score ?? 0 : game?.host_score ?? 0;
  const claimToCheck = roundState.baselineClaim ?? lastClaim;
  const [dieHi, dieLo] = facesFromRoll(myRoll);
  const claimSummary = useMemo(
    () => `Current claim: ${formatClaim(lastClaim)}     Your roll: ${formatRoll(myRoll)}`,
    [lastClaim, myRoll]
  );
  const isOpponentClaimPhase = useMemo(() => {
    if (!game) return false;
    if (!isMyTurn) return false;
    if (lastClaim == null || myRoll != null) return false;
    if (!roundState.lastClaimer) return false;
    return roundState.lastClaimer !== myRole;
  }, [game, isMyTurn, lastClaim, myRoll, roundState.lastClaimer, myRole]);
  const diceDisplayMode = useMemo(() => {
    if (isOpponentClaimPhase) return 'question';
    if (isMyTurn) return myRoll == null ? 'prompt' : 'values';
    return 'values';
  }, [isOpponentClaimPhase, isMyTurn, myRoll]);
  const overlayTextHi = diceDisplayMode === 'prompt' ? 'Your' : undefined;
  const overlayTextLo = diceDisplayMode === 'prompt' ? 'Roll' : undefined;
  const rolling = rollingAnim;
  const startSocialReveal = useCallback((dice: [number | null, number | null]) => {
    setSocialDiceValues(dice);
    setShowSocialReveal(true);
    setSocialRevealHidden(true);
    setIsRevealAnimating(true);
    requestAnimationFrame(() => setSocialRevealHidden(false));
  }, []);
  const handleSocialRevealComplete = useCallback(() => {
    setShowSocialReveal(false);
    setSocialRevealHidden(true);
    setIsRevealAnimating(false);
  }, []);
  useEffect(() => {
    const nonce = roundState.socialRevealNonce ?? 0;
    if (!nonce || !roundState.socialRevealDice) return;
    if (nonce > socialRevealNonceRef.current) {
      socialRevealNonceRef.current = nonce;
      startSocialReveal(roundState.socialRevealDice);
    }
  }, [roundState.socialRevealNonce, roundState.socialRevealDice, startSocialReveal]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.15, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [roundState.history, fadeAnim]);
  const collapsedHistory = useMemo(
    () => [...roundState.history.slice(-2)].reverse(),
    [roundState.history]
  );
  const modalHistory = useMemo(
    () => [...roundState.history.slice(-10)].reverse(),
    [roundState.history]
  );
  const formatHistoryEntry = useCallback(
    (entry: HistoryItem) => {
      if (entry.type === 'event') return entry.text;
      const whoLabel = entry.who === myRole ? 'You' : opponentName;
      const verb = entry.claim === 41 ? 'rolled' : 'claimed';
      return `${whoLabel} ${verb} ${formatClaim(entry.claim)}`;
    },
    [myRole, opponentName]
  );

  const myTurnText = (() => {
    if (!game) return '';
    if (game.status === 'finished') return 'Match finished';
    if (!myRole) return 'You are not part of this match.';
    if (!game.guest_id) return 'Waiting for your friend to join.';
    if (isMyTurn) {
      if (myRoll == null) return 'Roll to see your dice.';
      if (mustBluff) return `You rolled ${formatRoll(myRoll)}. You must bluff with a higher claim.`;
      return `You rolled ${formatRoll(myRoll)}. Choose a claim or bluff.`;
    }
    return 'Waiting for opponent...';
  })();

  const claimOptions = useMemo(() => {
    const baseline = claimToCheck ?? null;
    return buildClaimOptions(baseline, myRoll);
  }, [claimToCheck, myRoll]);

  const handleUpdate = useCallback(
    async (payload: Record<string, any>, nextRound?: RoundState) => {
      if (!normalizedGameId) throw new Error('Missing game id');
      const updatePayload = { ...payload };
      if (nextRound) updatePayload.round_state = nextRound;
      const { error: updateError } = await supabase
        .from('games_v2')
        .update(updatePayload)
        .eq('id', normalizedGameId);
      if (updateError) throw new Error(updateError.message);
    },
    [normalizedGameId]
  );

  const handleRoll = useCallback(async () => {
    if (!game || !myRole || !isMyTurn || game.status !== 'in_progress' || isRevealAnimating) return;
    if ((myRole === 'host' && roundState.hostRoll !== null) || (myRole === 'guest' && roundState.guestRoll !== null)) {
      return;
    }
    setBanner(null);
    setRollingAnim(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      const { values, normalized } = rollDice();
      const legalTruth = computeLegalTruth(claimToCheck ?? null, normalized);
      const nextRound: RoundState = {
        ...roundState,
        hostRoll: myRole === 'host' ? normalized : roundState.hostRoll,
        guestRoll: myRole === 'guest' ? normalized : roundState.guestRoll,
        hostMustBluff: myRole === 'host' ? !legalTruth : roundState.hostMustBluff,
        guestMustBluff: myRole === 'guest' ? !legalTruth : roundState.guestMustBluff,
      };
      await handleUpdate(
        {
          last_roll_1: values[0],
          last_roll_2: values[1],
        },
        nextRound
      );
    } catch (err: any) {
      Alert.alert('Roll failed', err.message ?? 'Could not save roll.');
    } finally {
      setTimeout(() => setRollingAnim(false), 400);
    }
  }, [game, myRole, isMyTurn, isRevealAnimating, roundState, claimToCheck, handleUpdate]);

  const appendHistory = useCallback(
    (entry: HistoryItem): HistoryItem[] => {
      const next = [...roundState.history, entry];
      return next.slice(-12);
    },
    [roundState.history]
  );

  const handleClaim = useCallback(
    async (claim: number) => {
      if (!game || !myRole || !opponentRole || !isMyTurn || isRevealAnimating) return;
      const prev = lastClaim;
      if (prev === 21 && claim !== 21 && claim !== 31 && claim !== 41) {
        Alert.alert('Invalid claim', 'After Mexican (21), only 21, 31, or 41 are legal.');
        return;
      }
      const baseline = roundState.baselineClaim ?? prev;
      if (!isLegalRaise(baseline ?? null, claim)) {
        Alert.alert('Invalid raise', baseline == null ? 'Choose a valid claim.' : `Claim ${claim} must beat ${baseline}.`);
        return;
      }
      if (claim === 41 && !claimMatchesRoll(41, myRoll)) {
        Alert.alert('41 must be shown', 'You can only show 41 if you actually rolled it.');
        return;
      }

      const timestamp = new Date().toISOString();
      const newHistory = appendHistory({
        id: uuid(),
        type: 'claim',
        who: myRole,
        claim,
        timestamp,
      });
      const isReverseClaim = prev != null && isReverseOf(prev, claim);
      const nextBaseline = claim === 41 ? null : isReverseClaim ? (roundState.baselineClaim ?? prev) : claim;
      const actionFlag: RoundState['lastAction'] = prev === 21 && claim === 31 ? 'reverseVsMexican' : 'normal';
      const opponentId = opponentRole === 'host' ? game.host_id : game.guest_id;
      if (!opponentId) {
        Alert.alert('Opponent missing', 'Waiting for an opponent to join.');
        return;
      }

      const myCurrentRoll =
        myRole === 'host' ? roundState.hostRoll : roundState.guestRoll;
      const socialDice = claim === 41 && myCurrentRoll != null ? facesFromRoll(myCurrentRoll) : null;
      const nextSocialNonce = claim === 41 ? (roundState.socialRevealNonce ?? 0) + 1 : roundState.socialRevealNonce;

      const nextRound: RoundState = {
        ...roundState,
        baselineClaim: nextBaseline,
        lastAction: actionFlag,
        lastClaimer: claim === 41 ? null : myRole,
        history: claim === 41 ? [...newHistory, { id: uuid(), type: 'event', text: `${myRole === 'host' ? hostName : guestName} showed Social (41).`, timestamp }] : newHistory,
        lastClaimRoll: claim === 41 ? null : myCurrentRoll,
        socialRevealDice: claim === 41 ? socialDice : roundState.socialRevealDice,
        socialRevealNonce: nextSocialNonce,
      };

      if (myRole === 'host') {
        nextRound.hostRoll = null;
        nextRound.hostMustBluff = false;
      } else if (myRole === 'guest') {
        nextRound.guestRoll = null;
        nextRound.guestMustBluff = false;
      }

      if (claim === 41) {
        nextRound.hostRoll = null;
        nextRound.guestRoll = null;
        nextRound.hostMustBluff = false;
        nextRound.guestMustBluff = false;
        nextRound.lastAction = 'normal';
        nextRound.lastClaimer = null;
        if (socialDice) {
          startSocialReveal(socialDice);
          socialRevealNonceRef.current = nextSocialNonce;
        }
      }

      const payload: Record<string, any> = {
        last_claim: claim === 41 ? null : claim,
        current_player_id: opponentId,
      };

      try {
        await handleUpdate(payload, nextRound);
        setClaimPickerOpen(false);
        if (claim === 41) {
          setBanner({ type: 'social', text: '🍻 SOCIAL!!! 🍻' });
        }
      } catch (err: any) {
        Alert.alert('Claim failed', err.message ?? 'Could not save claim.');
      }
    },
    [
      game,
      myRole,
      opponentRole,
      isMyTurn,
      isRevealAnimating,
      lastClaim,
      roundState,
      myRoll,
      appendHistory,
      handleUpdate,
      hostName,
      guestName,
      startSocialReveal,
    ]
  );

  const handleShowSocial = useCallback(() => {
    handleClaim(41);
  }, [handleClaim]);

  const handleCallBluff = useCallback(async () => {
    if (!game || !myRole || !opponentRole || !isMyTurn || lastClaim == null || isRevealAnimating) {
      return;
    }
    const defendingRole = roundState.lastClaimer;
    if (!defendingRole || defendingRole === myRole) {
      Alert.alert('Nothing to challenge', 'Waiting for opponent claim.');
      return;
    }
    const defenderRoll = roundState.lastClaimRoll;
    if (defenderRoll == null) {
      Alert.alert('Missing roll', 'Opponent has no recorded roll to challenge.');
      return;
    }

    const { outcome, penalty } = resolveBluff(lastClaim, defenderRoll, roundState.lastAction === 'reverseVsMexican');
    const liar = outcome === +1;
    const loserRole = liar ? defendingRole : myRole;
    const callerName = myRole === 'host' ? hostName : guestName;
    const defenderName = defendingRole === 'host' ? hostName : guestName;
    const [revealHi, revealLo] = splitClaim(defenderRoll);
    setRevealDiceValues([revealHi, revealLo]);
    setIsRevealingBluff(true);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => {
      setIsRevealingBluff(false);
      setRevealDiceValues(null);
    }, 1800);
    const eventText = liar
      ? `${callerName} caught ${defenderName} bluffing!`
      : `${callerName} was wrong — ${defenderName} told the truth.`;

    const nextHistory = appendHistory({ id: uuid(), type: 'event', text: eventText, timestamp: new Date().toISOString() });

    let nextHostScore = game.host_score;
    let nextGuestScore = game.guest_score;
    if (loserRole === 'host') {
      nextHostScore = clampScore(nextHostScore - penalty);
    } else {
      nextGuestScore = clampScore(nextGuestScore - penalty);
    }
    const finished = nextHostScore === 0 || nextGuestScore === 0;
    const nextRound: RoundState = {
      ...defaultRoundState,
      history: nextHistory,
      socialRevealNonce: roundState.socialRevealNonce ?? 0,
      socialRevealDice: null,
    };
    const payload: Record<string, any> = {
      host_score: nextHostScore,
      guest_score: nextGuestScore,
      last_claim: null,
      current_player_id: finished ? null : (myRole === 'host' ? game.host_id : game.guest_id),
      status: finished ? 'finished' : 'in_progress',
    };

    try {
      await handleUpdate(payload, nextRound);
      setBanner(liar ? { type: 'got-em', text: "GOT 'EM!!!" } : { type: 'womp-womp', text: 'WOMP WOMP' });
    } catch (err: any) {
      Alert.alert('Bluff call failed', err.message ?? 'Could not resolve bluff.');
    }
  }, [game, myRole, opponentRole, isMyTurn, lastClaim, isRevealAnimating, roundState, appendHistory, handleUpdate, hostName, guestName]);

  const handleQuitGame = useCallback(() => {
    console.log('[OnlineGameV2] Quit Game pressed');
    Alert.alert(
      'Quit Game',
      'Are you sure you want to leave the game?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave Game',
          style: 'destructive',
          onPress: () => router.replace('/online'),
        },
      ],
      { cancelable: true }
    );
  }, [router]);

  if (loading) {
    return (
      <View style={styles.root}>
        <FeltBackground>
          <SafeAreaView style={styles.safe}>
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#E0B50C" />
              <Text style={styles.loadingText}>Loading match...</Text>
            </View>
          </SafeAreaView>
        </FeltBackground>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.root}>
        <FeltBackground>
          <SafeAreaView style={styles.safe}>
            <View style={styles.centered}>
              <Text style={styles.errorText}>{error}</Text>
              <StyledButton
                label="Back to Menu"
                variant="primary"
                onPress={() => router.replace('/')}
                style={{ marginTop: 20, minWidth: 200 }}
              />
            </View>
          </SafeAreaView>
        </FeltBackground>
      </View>
    );
  }

  if (!game || !myRole) {
    return (
      <View style={styles.root}>
        <FeltBackground>
          <SafeAreaView style={styles.safe}>
            <View style={styles.centered}>
              <Text style={styles.errorText}>You are not part of this game.</Text>
              <StyledButton
                label="Back to Lobby"
                variant="primary"
                onPress={() => router.replace('/online')}
                style={{ marginTop: 20, minWidth: 200 }}
              />
            </View>
          </SafeAreaView>
        </FeltBackground>
      </View>
    );
  }

  const canRoll = isMyTurn && game.status === 'in_progress' && myRoll == null;
  const canClaim = isMyTurn && myRoll != null;
  const canShowSocial = canClaim && myRoll === 41;
  const canCallBluff = isMyTurn && lastClaim != null && roundState.lastClaimer && roundState.lastClaimer !== myRole;

  return (
    <View style={styles.root}>
      <FeltBackground>
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.headerCard}>
              <View style={styles.headerRow}>
                <View style={styles.playerColumn}>
                  <View style={styles.avatarCircle}>
                    <Image
                      source={require('../../../assets/images/User.png')}
                      style={styles.avatarImage}
                    />
                  </View>
                  <Text style={styles.playerLabel}>You</Text>
                  <ScoreDie points={myScore} style={styles.scoreDie} size={38} />
                </View>

                <View style={styles.titleColumn}>
                  <Text style={styles.claimText}>{claimSummary}</Text>
                </View>

                <View style={styles.playerColumn}>
                  <View style={styles.avatarCircle}>
                    <Image
                      source={require('../../../assets/images/Rival.png')}
                      style={styles.avatarImage}
                    />
                  </View>
                  <Text style={styles.playerLabel}>{opponentName}</Text>
                  <ScoreDie points={opponentScore} style={styles.scoreDie} size={38} />
                </View>
              </View>

              <Text style={styles.status} numberOfLines={2}>
                {myTurnText}
              </Text>
            </View>

            {banner && (
              <View
                style={[
                  styles.banner,
                  banner.type === 'got-em' && styles.bannerSuccess,
                  banner.type === 'womp-womp' && styles.bannerFail,
                  banner.type === 'social' && styles.bannerSocial,
                ]}
              >
                <Text style={styles.bannerText}>{banner.text}</Text>
              </View>
            )}

            <Pressable
              onPress={() => setHistoryModalOpen(true)}
              hitSlop={10}
              style={({ pressed }) => [styles.historyBox, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Animated.View style={{ opacity: fadeAnim }}>
                {collapsedHistory.length > 0 ? (
                  collapsedHistory.map((entry) => (
                    <Text key={entry.id} style={styles.historyText} numberOfLines={1}>
                      {formatHistoryEntry(entry)}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.historyText}>No recent events.</Text>
                )}
              </Animated.View>
            </Pressable>

            <View style={styles.diceArea}>
              <View style={styles.diceRow}>
                {showSocialReveal ? (
                  <AnimatedDiceReveal
                    hidden={socialRevealHidden}
                    diceValues={socialDiceValues}
                    onRevealComplete={handleSocialRevealComplete}
                  />
                ) : isRevealingBluff && revealDiceValues ? (
                  <AnimatedDiceReveal hidden={false} diceValues={revealDiceValues} size={110} />
                ) : isMyTurn ? (
                  <>
                    <Dice
                      value={dieHi}
                      displayMode={diceDisplayMode}
                      overlayText={overlayTextHi}
                      rolling={isMyTurn && rolling && myRoll == null}
                    />
                    <View style={{ width: 24 }} />
                    <Dice
                      value={dieLo}
                      displayMode={diceDisplayMode}
                      overlayText={overlayTextLo}
                      rolling={isMyTurn && rolling && myRoll == null}
                    />
                  </>
                ) : (
                  <>
                    <ThinkingIndicator size={110} position="left" />
                    <View style={{ width: 24 }} />
                    <ThinkingIndicator size={110} position="right" />
                  </>
                )}
              </View>
            </View>

            <View style={styles.controls}>
              <View style={styles.actionRow}>
                <StyledButton
                  label={canRoll ? 'Roll' : 'Claim'}
                  variant="success"
                  onPress={canRoll ? handleRoll : () => handleClaim(myRoll!)}
                  disabled={isRevealAnimating || (canRoll ? !canRoll : !canClaim)}
                  style={styles.btn}
                />
                <StyledButton
                  label="Call Bluff"
                  variant="primary"
                  onPress={handleCallBluff}
                  disabled={!canCallBluff || myRoll !== null || isRevealAnimating}
                  style={[styles.btn, styles.dangerButton]}
                />
              </View>
              <View style={styles.bottomRow}>
                <StyledButton
                  label="Bluff Options"
                  variant="outline"
                  onPress={() => setClaimPickerOpen(true)}
                  disabled={!canClaim || isRevealAnimating}
                  style={styles.btnWide}
                />
              </View>
              <View style={styles.bottomRow}>
                <StyledButton
                  label="Quit Game"
                  variant="ghost"
                  onPress={handleQuitGame}
                  style={styles.btn}
                />
                <StyledButton
                  label="View Rules"
                  variant="ghost"
                  onPress={() => setRulesOpen(true)}
                  style={styles.btn}
                />
              </View>
            </View>

            {game.status === 'finished' && (
              <View style={styles.finishedBox}>
                <Text style={styles.finishedText}>
                  Match over! {myScore === 0 ? 'You lost.' : opponentScore === 0 ? 'You won!' : ''}
                </Text>
                <StyledButton
                  label="Back to Lobby"
                  variant="outline"
                  onPress={() => router.replace('/online')}
                  style={{ marginTop: 12 }}
                />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </FeltBackground>

      <BluffModal
        visible={claimPickerOpen}
        options={claimOptions}
        onCancel={() => setClaimPickerOpen(false)}
        onSelect={handleClaim}
        canShowSocial={canShowSocial}
        onShowSocial={handleShowSocial}
      />

      <Modal
        visible={historyModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setHistoryModalOpen(false)} />
        <View style={styles.modalCenter}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Full History</Text>
              <Pressable
                onPress={() => setHistoryModalOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.modalHistoryList}>
              {modalHistory.length > 0 ? (
                <ScrollView>
                  {modalHistory.map((entry) => (
                    <View key={entry.id} style={styles.historyItem}>
                      <Text style={styles.historyItemText}>{formatHistoryEntry(entry)}</Text>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.noHistoryText}>No history yet.</Text>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={rulesOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRulesOpen(false)}
      >
        <Pressable style={styles.rulesBackdrop} onPress={() => setRulesOpen(false)} />
        <View style={styles.rulesCenter}>
          <View style={styles.rulesContent}>
            <View style={styles.rulesHeader}>
              <Text style={styles.rulesTitle}>Game Rules</Text>
              <Pressable onPress={() => setRulesOpen(false)} style={styles.rulesCloseButton}>
                <Text style={styles.rulesClose}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.rulesScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.rulesText}>{RULES_TEXT}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B3A26',
  },
  safe: {
    flex: 1,
  },
  content: {
    padding: 20,
    flexGrow: 1,
    paddingBottom: 60,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 16,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  headerCard: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerColumn: {
    alignItems: 'center',
    width: 96,
  },
  avatarCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarImage: {
    width: 58,
    height: 58,
    resizeMode: 'contain',
  },
  playerLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  titleColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  claimText: {
    color: '#E0B50C',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  status: {
    marginTop: 12,
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  scoreDie: {
    marginTop: 8,
  },
  scoreValue: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 4,
  },
  banner: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  bannerText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  bannerSuccess: {
    backgroundColor: '#0F5132',
    borderColor: '#0C4128',
  },
  bannerFail: {
    backgroundColor: '#661313',
    borderColor: '#520E0E',
  },
  bannerSocial: {
    backgroundColor: '#8C6B2F',
    borderColor: '#5E471F',
  },
  historyBox: {
    alignSelf: 'center',
    width: '70%',
    minHeight: 72,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderColor: '#000',
    borderWidth: 2,
    borderRadius: 6,
    padding: 10,
    marginTop: 12,
    marginBottom: 10,
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  historyText: {
    color: '#E6FFE6',
    textAlign: 'center',
    fontSize: 13,
    marginVertical: 2,
  },
  diceArea: {
    marginBottom: 24,
    alignItems: 'center',
  },
  diceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  btn: {
    flex: 1,
    marginHorizontal: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  btnWide: {
    flex: 1,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  menuButton: {
    flex: 1,
    marginHorizontal: 6,
  },
  dangerButton: {
    backgroundColor: '#6C1115',
  },
  finishedBox: {
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  finishedText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a4d2e',
    borderRadius: 12,
    padding: 20,
    maxHeight: '70%',
    width: '85%',
    borderColor: '#e0b50c',
    borderWidth: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#E6FFE6',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalHistoryList: {
    maxHeight: 400,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 8,
    paddingHorizontal: 8,
  },
  historyItemText: {
    color: '#E6FFE6',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  noHistoryText: {
    color: '#C9F0D6',
    textAlign: 'center',
    fontSize: 14,
    marginVertical: 20,
  },
  rulesBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  rulesCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rulesContent: {
    backgroundColor: '#1a4d2e',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxHeight: '75%',
    borderColor: '#e0b50c',
    borderWidth: 2,
  },
  rulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rulesTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
  },
  rulesCloseButton: {
    padding: 4,
  },
  rulesClose: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  rulesScroll: {
    maxHeight: '100%',
  },
  rulesText: {
    color: '#E6FFE6',
    fontSize: 15,
    lineHeight: 22,
  },
});
