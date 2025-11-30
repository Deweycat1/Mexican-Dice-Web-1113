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

import { LinearGradient } from 'expo-linear-gradient';
import AnimatedDiceReveal from '../../../src/components/AnimatedDiceReveal';
import BluffModal from '../../../src/components/BluffModal';
import Dice from '../../../src/components/Dice';
import FeltBackground from '../../../src/components/FeltBackground';
import RulesContent from '../../../src/components/RulesContent';
import { ScoreDie } from '../../../src/components/ScoreDie';
import StyledButton from '../../../src/components/StyledButton';
import ThinkingIndicator from '../../../src/components/ThinkingIndicator';
import {
  claimMatchesRoll,
  isChallengeClaim,
  isLegalRaise,
  isReverseOf,
  resolveActiveChallenge,
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
  hostWinksUsed: number;
  guestWinksUsed: number;
  lastClaimHadWink: boolean;
  lastWinkBy: 'host' | 'guest' | null;
  lastWinkNonce: number;
  lastBluffCaller: 'host' | 'guest' | null;
  lastBluffDefenderTruth: boolean | null;
  bluffResultNonce: number;
};

type HistoryItem =
  | { id: string; type: 'claim'; who: 'host' | 'guest'; claim: number; timestamp: string; wink?: boolean }
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
  rematch_requested_by_host?: boolean;
  rematch_requested_by_guest?: boolean;
  rematch_game_id?: string | null;
  parent_game_id?: string | null;
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
  hostWinksUsed: 0,
  guestWinksUsed: 0,
  lastClaimHadWink: false,
  lastWinkBy: null,
  lastWinkNonce: 0,
  lastBluffCaller: null,
  lastBluffDefenderTruth: null,
  bluffResultNonce: 0,
};

const clampScore = (value: number) => Math.max(0, value);
const uuid = () => Math.random().toString(36).slice(2, 10);
const OUT_OF_TURN_ERROR = 'OUT_OF_TURN_ERROR';

export type OnlineGameRematchInfo = {
  parentGameId: string;
  newGameId: string;
};

const STARTING_SCORE = 5;

async function createRematchFromGame(game: OnlineGameV2): Promise<OnlineGameRematchInfo> {
  if (!game.host_id || !game.guest_id) {
    throw new Error('Both players must be present for a rematch.');
  }

  const parentGameId = game.parent_game_id ?? game.id;
  console.log('[rematch] creating new game from', game.id, 'parent:', parentGameId);

  const { data: newGame, error: insertError } = await supabase
    .from('games_v2')
    .insert({
      host_id: game.host_id,
      guest_id: game.guest_id,
      status: 'in_progress',
      current_player_id: game.host_id,
      host_score: STARTING_SCORE,
      guest_score: STARTING_SCORE,
      parent_game_id: parentGameId,
      round_state: defaultRoundState,
    })
    .select('*')
    .single();

  if (insertError || !newGame) {
    console.error('[rematch] insert error', insertError);
    throw new Error(insertError?.message ?? 'Failed to create rematch game');
  }

  const { error: linkError } = await supabase
    .from('games_v2')
    .update({
      rematch_game_id: newGame.id,
      rematch_requested_by_host: false,
      rematch_requested_by_guest: false,
    })
    .eq('id', game.id);

  if (linkError) {
    console.error('[rematch] link error', linkError);
    throw new Error(linkError.message);
  }

  console.log('[rematch] created new game', newGame.id, 'for parent', game.id);
  return { parentGameId: game.id, newGameId: newGame.id };
}

async function requestRematchForGame(game: OnlineGameV2, myPlayerId: string): Promise<string | null> {
  const isHost = myPlayerId === game.host_id;
  const isGuest = myPlayerId === game.guest_id;
  if (!isHost && !isGuest) {
    throw new Error('Only players in the match can request a rematch.');
  }

  const column = isHost ? 'rematch_requested_by_host' : 'rematch_requested_by_guest';
  console.log('[rematch] requesting rematch for game', game.id, 'as', isHost ? 'host' : 'guest');

  const { data, error } = await supabase
    .from('games_v2')
    .update({ [column]: true })
    .eq('id', game.id)
    .select('*')
    .single();

  if (error || !data) {
    console.error('[rematch] update error', error);
    throw new Error(error?.message ?? 'Failed to request rematch');
  }

  const updated = data as OnlineGameV2;
  console.log('[rematch] updated flags', {
    host: updated.rematch_requested_by_host,
    guest: updated.rematch_requested_by_guest,
    rematch_game_id: updated.rematch_game_id,
  });

  if (
    updated.rematch_requested_by_host &&
    updated.rematch_requested_by_guest
  ) {
    if (updated.rematch_game_id) {
      return updated.rematch_game_id;
    }
    const info = await createRematchFromGame(updated);
    return info.newGameId;
  }

  return updated.rematch_game_id ?? null;
}


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
  const [banner, setBanner] = useState<{ type: 'got-em' | 'womp-womp' | 'social' | 'wink'; text: string } | null>(null);
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
  const [winkArmed, setWinkArmed] = useState(false);
  const [isRequestingRematch, setIsRequestingRematch] = useState(false);

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
    if (!game || game.status !== 'finished') return;
    if (!game.rematch_game_id) return;
    if (game.rematch_game_id === game.id) return;

    console.log('[rematch] navigating to rematch game', game.rematch_game_id, 'from', game.id);
    router.replace(`/online/game-v2/${game.rematch_game_id}`);
  }, [game?.rematch_game_id, game?.status, router]);

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
        hostWinksUsed:
          typeof (raw as any).hostWinksUsed === 'number' ? (raw as any).hostWinksUsed : 0,
        guestWinksUsed:
          typeof (raw as any).guestWinksUsed === 'number' ? (raw as any).guestWinksUsed : 0,
        lastClaimHadWink:
          typeof (raw as any).lastClaimHadWink === 'boolean'
            ? (raw as any).lastClaimHadWink
            : false,
        lastWinkBy:
          (raw as any).lastWinkBy === 'host' || (raw as any).lastWinkBy === 'guest'
            ? (raw as any).lastWinkBy
            : null,
        lastWinkNonce:
          typeof (raw as any).lastWinkNonce === 'number' ? (raw as any).lastWinkNonce : 0,
        lastBluffCaller:
          (raw as any).lastBluffCaller === 'host' || (raw as any).lastBluffCaller === 'guest'
            ? (raw as any).lastBluffCaller
            : null,
        lastBluffDefenderTruth:
          typeof (raw as any).lastBluffDefenderTruth === 'boolean'
            ? (raw as any).lastBluffDefenderTruth
            : null,
        bluffResultNonce:
          typeof (raw as any).bluffResultNonce === 'number' ? (raw as any).bluffResultNonce : 0,
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
  const claimToCheck = resolveActiveChallenge(roundState.baselineClaim, lastClaim);
  const [dieHi, dieLo] = facesFromRoll(myRoll);
  const claimSummary = useMemo(() => {
    const winkSuffix = roundState.lastClaimHadWink ? ' 😉' : '';
    return `Current claim: ${formatClaim(lastClaim)}${winkSuffix}     Your roll: ${formatRoll(myRoll)}`;
  }, [lastClaim, myRoll, roundState.lastClaimHadWink]);
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
  const myWinksUsed =
    myRole === 'host'
      ? roundState.hostWinksUsed ?? 0
      : myRole === 'guest'
      ? roundState.guestWinksUsed ?? 0
      : 0;
  const WINK_LIMIT = 3;
  const winkUsesRemaining = Math.max(0, WINK_LIMIT - myWinksUsed);
  const canToggleWink =
    !!myRole &&
    isMyTurn &&
    game?.status === 'in_progress' &&
    myRoll != null &&
    winkUsesRemaining > 0 &&
    !isRevealAnimating;
  useEffect(() => {
    if (!isMyTurn || myRoll == null) {
      setWinkArmed(false);
    }
  }, [isMyTurn, myRoll]);
  const winkLabelBase =
    winkUsesRemaining > 0 ? `Send with 😉 (${winkUsesRemaining})` : 'No winks left';
  const winkLabel =
    winkArmed && winkUsesRemaining > 0 ? `${winkLabelBase} (Active)` : winkLabelBase;
  const isGameFinished = game?.status === 'finished';
  const hostRequestedRematch = game?.rematch_requested_by_host ?? false;
  const guestRequestedRematch = game?.rematch_requested_by_guest ?? false;
  const hasRequestedRematch =
    myRole === 'host' ? hostRequestedRematch : myRole === 'guest' ? guestRequestedRematch : false;
  const opponentRequestedRematch =
    myRole === 'host' ? guestRequestedRematch : myRole === 'guest' ? hostRequestedRematch : false;
  const waitingForRematch = isGameFinished && hasRequestedRematch && !opponentRequestedRematch;
  const opponentWantsRematch = isGameFinished && opponentRequestedRematch && !hasRequestedRematch;
  const rematchButtonLabel = isRequestingRematch
    ? 'Requesting…'
    : waitingForRematch
      ? 'Waiting…'
      : opponentWantsRematch
        ? 'Accept Rematch'
        : 'Rematch?';
  const showRematchButton = isGameFinished && !!myRole;
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
  const lastWinkNonceRef = useRef(roundState.lastWinkNonce ?? 0);
  const winkGlowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const winkNonce = roundState.lastWinkNonce ?? 0;
    const winkBy = roundState.lastWinkBy ?? null;
    if (!game || !myRole) return;
    if (!winkNonce || !winkBy) return;
    if (winkNonce <= lastWinkNonceRef.current) return;
    lastWinkNonceRef.current = winkNonce;
    if (winkBy === myRole) return;
    if (game.status !== 'in_progress') return;
    setBanner({ type: 'wink', text: '😉 WINK WINK 😉' });
    winkGlowAnim.setValue(0);
    Animated.sequence([
      Animated.timing(winkGlowAnim, { toValue: 1, duration: 250, useNativeDriver: false }),
      Animated.timing(winkGlowAnim, { toValue: 0, duration: 250, useNativeDriver: false }),
    ]).start();
  }, [roundState.lastWinkNonce, roundState.lastWinkBy, game?.status, myRole, winkGlowAnim]);
  const glowStyle = {
    borderWidth: 2,
    borderColor: winkGlowAnim.interpolate({ inputRange: [0, 1], outputRange: ['transparent', '#F9E28F'] }),
    shadowColor: '#F9E28F',
    shadowOpacity: winkGlowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
    shadowRadius: winkGlowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }),
  };
  const bluffResultNonceRef = useRef(roundState.bluffResultNonce ?? 0);
  useEffect(() => {
    const bluffNonce = roundState.bluffResultNonce ?? 0;
    const caller = roundState.lastBluffCaller ?? null;
    const defenderTruth = typeof (roundState.lastBluffDefenderTruth) === 'boolean' ? roundState.lastBluffDefenderTruth : null;
    if (!caller || defenderTruth === null) return;
    if (bluffNonce <= bluffResultNonceRef.current) return;
    bluffResultNonceRef.current = bluffNonce;
    const defenderRole = caller === 'host' ? 'guest' : 'host';
    if (defenderRole !== myRole) return;
    if (game?.status !== 'in_progress') return;
    setBanner(defenderTruth ? { type: 'got-em', text: "GOT 'EM!!!" } : { type: 'womp-womp', text: 'WOMP WOMP' });
  }, [roundState.bluffResultNonce, roundState.lastBluffCaller, roundState.lastBluffDefenderTruth, myRole, game?.status]);

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
      const winkSuffix = entry.wink ? ' 😉' : '';
      return `${whoLabel} ${verb} ${formatClaim(entry.claim)}${winkSuffix}`;
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
    async (
      payload: Record<string, any>,
      nextRound?: RoundState,
      options?: { requireCurrentPlayerId?: string | null }
    ) => {
      if (!normalizedGameId) throw new Error('Missing game id');
      const updatePayload = { ...payload };
      if (nextRound) updatePayload.round_state = nextRound;
      let query = supabase.from('games_v2').update(updatePayload).eq('id', normalizedGameId);
      if (options?.requireCurrentPlayerId) {
        query = query.eq('current_player_id', options.requireCurrentPlayerId);
      }
      const { data, error: updateError } = await query.select('id');
      if (updateError) throw new Error(updateError.message);
      if (!data || data.length === 0) {
        throw new Error(OUT_OF_TURN_ERROR);
      }
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
        nextRound,
        { requireCurrentPlayerId: userId }
      );
    } catch (err: any) {
      if (err?.message === OUT_OF_TURN_ERROR) {
        Alert.alert('Move expired', 'This move is no longer valid. Please reload the match.');
      } else {
        Alert.alert('Roll failed', err.message ?? 'Could not save roll.');
      }
    } finally {
      setTimeout(() => setRollingAnim(false), 400);
    }
  }, [game, myRole, isMyTurn, isRevealAnimating, roundState, claimToCheck, handleUpdate, userId]);

  const appendHistory = useCallback(
    (entry: HistoryItem): HistoryItem[] => {
      const next = [...roundState.history, entry];
      return next.slice(-12);
    },
    [roundState.history]
  );

  const handleClaim = useCallback(
    async (claim: number, useWink?: boolean) => {
      if (!game || !myRole || !opponentRole || !isMyTurn || isRevealAnimating) return;
      const prev = lastClaim;
      const activeChallenge = resolveActiveChallenge(roundState.baselineClaim, prev);
      if (activeChallenge === 21 && claim !== 21 && claim !== 31 && claim !== 41) {
        Alert.alert('Invalid claim', 'After Mexican (21), only 21, 31, or 41 are legal.');
        return;
      }
      const baseline = activeChallenge;
      if (!isLegalRaise(baseline ?? null, claim)) {
        Alert.alert('Invalid raise', baseline == null ? 'Choose a valid claim.' : `Claim ${claim} must beat ${baseline}.`);
        return;
      }
      if (claim === 41 && !claimMatchesRoll(41, myRoll)) {
        Alert.alert('41 must be shown', 'You can only show 41 if you actually rolled it.');
        return;
      }

      const effectiveUseWink = !!useWink && myRole != null && winkUsesRemaining > 0;
      const prevWinkNonce = roundState.lastWinkNonce ?? 0;
      const nextWinkNonce = effectiveUseWink ? prevWinkNonce + 1 : prevWinkNonce;
      const timestamp = new Date().toISOString();
      const newHistory = appendHistory({
        id: uuid(),
        type: 'claim',
        who: myRole,
        claim,
        timestamp,
        wink: effectiveUseWink,
      });
      const nextBaseline =
        claim === 41
          ? null
          : claim === 31
            ? roundState.baselineClaim ?? (isChallengeClaim(prev) ? prev : null)
            : claim;
      const actionFlag: RoundState['lastAction'] =
        activeChallenge === 21 && claim === 31 ? 'reverseVsMexican' : 'normal';
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
        hostWinksUsed:
          myRole === 'host'
            ? roundState.hostWinksUsed + (effectiveUseWink ? 1 : 0)
            : roundState.hostWinksUsed,
        guestWinksUsed:
          myRole === 'guest'
            ? roundState.guestWinksUsed + (effectiveUseWink ? 1 : 0)
            : roundState.guestWinksUsed,
        lastClaimHadWink: !!effectiveUseWink && claim !== 41,
        lastWinkBy: effectiveUseWink ? myRole : roundState.lastWinkBy ?? null,
        lastWinkNonce: nextWinkNonce,
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
        nextRound.lastClaimHadWink = false;
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
        await handleUpdate(payload, nextRound, { requireCurrentPlayerId: userId });
        setClaimPickerOpen(false);
        setWinkArmed(false);
        if (claim === 41) {
          setBanner({ type: 'social', text: '🍻 SOCIAL!!! 🍻' });
        }
      } catch (err: any) {
        if (err?.message === OUT_OF_TURN_ERROR) {
          Alert.alert('Move expired', 'This move is no longer valid. Please reload the match.');
        } else {
          Alert.alert('Claim failed', err.message ?? 'Could not save claim.');
        }
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
      winkUsesRemaining,
      userId,
    ]
  );

  const handleShowSocial = useCallback(() => {
    handleClaim(41, winkArmed);
  }, [handleClaim, winkArmed]);

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
      : `${callerName} was wrong, ${defenderName} told the truth.`;

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
      hostWinksUsed: roundState.hostWinksUsed,
      guestWinksUsed: roundState.guestWinksUsed,
      lastClaimHadWink: false,
      lastWinkBy: roundState.lastWinkBy ?? null,
      lastWinkNonce: roundState.lastWinkNonce ?? 0,
      lastBluffCaller: myRole,
      lastBluffDefenderTruth: !liar,
      bluffResultNonce: (roundState.bluffResultNonce ?? 0) + 1,
    };
    const payload: Record<string, any> = {
      host_score: nextHostScore,
      guest_score: nextGuestScore,
      last_claim: null,
      current_player_id: finished ? null : (myRole === 'host' ? game.host_id : game.guest_id),
      status: finished ? 'finished' : 'in_progress',
    };

    try {
      await handleUpdate(payload, nextRound, { requireCurrentPlayerId: userId });
      setBanner(liar ? { type: 'got-em', text: "GOT 'EM!!!" } : { type: 'womp-womp', text: 'WOMP WOMP' });
    } catch (err: any) {
      if (err?.message === OUT_OF_TURN_ERROR) {
        Alert.alert('Move expired', 'This move is no longer valid. Please reload the match.');
      } else {
        Alert.alert('Bluff call failed', err.message ?? 'Could not resolve bluff.');
      }
    }
  }, [game, myRole, opponentRole, isMyTurn, lastClaim, isRevealAnimating, roundState, appendHistory, handleUpdate, hostName, guestName, userId]);

  const handleQuitGame = useCallback(() => {
    console.log('[OnlineGameV2] Leave Game pressed (no confirm)');
    router.push('/online' as const);
  }, [router]);

  const handleRematchPress = useCallback(async () => {
    if (!game || !userId) return;
    setIsRequestingRematch(true);
    try {
      const newGameId = await requestRematchForGame(game, userId);
      if (newGameId) {
        router.replace(`/online/game-v2/${newGameId}`);
      }
    } catch (err) {
      console.error('[OnlineGameV2] Rematch request failed', err);
      Alert.alert(
        'Rematch failed',
        err instanceof Error ? err.message : 'Could not request rematch.'
      );
    } finally {
      setIsRequestingRematch(false);
    }
  }, [game, userId, router]);

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
          <View style={styles.content}>
            <View style={styles.headerCard}>
              <View style={styles.headerRow}>
                <View style={styles.playerColumn}>
                  <View style={styles.avatarCircle}>
                    <Image
                      source={require('../../../assets/images/User.png')}
                      style={styles.avatarImage}
                    />
                  </View>
                  <Text style={styles.playerLabel}>
                    Your{'\n'}Score
                  </Text>
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
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.bannerContainer,
                  styles.banner,
                  banner.type === 'got-em' && styles.bannerSuccess,
                  banner.type === 'womp-womp' && styles.bannerFail,
                  banner.type === 'social' && styles.bannerSocial,
                  banner.type === 'wink' && glowStyle,
                ]}
              >
                {banner.type === 'wink' ? (
                  <LinearGradient
                    colors={['#E0B50C', '#F1D96B']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.winkBanner}
                  >
                    <Text style={styles.winkText}>{banner.text}</Text>
                  </LinearGradient>
                ) : (
                  <Text style={styles.bannerText}>{banner.text}</Text>
                )}
              </Animated.View>
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

            <View style={styles.diceSpacer} />

            <View style={styles.diceArea}>
              <View style={styles.diceRow}>
                {showSocialReveal ? (
                  <AnimatedDiceReveal
                    hidden={socialRevealHidden}
                    diceValues={socialDiceValues}
                    onRevealComplete={handleSocialRevealComplete}
                  />
                ) : isRevealingBluff && revealDiceValues ? (
                  <AnimatedDiceReveal hidden={false} diceValues={revealDiceValues} size={100} />
                ) : isMyTurn ? (
                  <>
                    <Dice
                      value={dieHi}
                      rolling={isMyTurn && rolling && myRoll == null}
                      displayMode={diceDisplayMode}
                      overlayText={diceDisplayMode === 'prompt' ? 'Your' : undefined}
                      size={100}
                    />
                    <View style={{ width: 24 }} />
                    <Dice
                      value={dieLo}
                      rolling={isMyTurn && rolling && myRoll == null}
                      displayMode={diceDisplayMode}
                      overlayText={diceDisplayMode === 'prompt' ? 'Roll' : undefined}
                      size={100}
                    />
                  </>
                ) : (
                  <>
                    <ThinkingIndicator size={100} position="left" />
                    <View style={{ width: 24 }} />
                    <ThinkingIndicator size={100} position="right" />
                  </>
                )}
              </View>
            </View>

            <View style={styles.controls}>
              <View style={styles.actionRow}>
                <StyledButton
                  label={canRoll ? 'Roll' : 'Claim'}
                  variant="success"
                  onPress={
                    canRoll
                      ? handleRoll
                      : () => {
                          if (!canClaim || myRoll == null) return;
                          handleClaim(myRoll, winkArmed);
                        }
                  }
                  disabled={isRevealAnimating || (canRoll ? !canRoll : !canClaim)}
                  style={[styles.btn, styles.menuActionButtonSuccess]}
                />
                <StyledButton
                  label="Call Bluff"
                  variant="primary"
                  onPress={handleCallBluff}
                  disabled={!canCallBluff || myRoll !== null || isRevealAnimating}
                  style={[styles.btn, styles.menuActionButton]}
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
                  label="Leave Game"
                  variant="ghost"
                  onPress={handleQuitGame}
                  style={[styles.btn, styles.goldOutlineButton]}
                />

                {showRematchButton ? (
                  <View style={[styles.btn, styles.rematchWrapper]}>
                    <StyledButton
                      label={rematchButtonLabel}
                      variant="ghost"
                      onPress={handleRematchPress}
                      disabled={!myRole || hasRequestedRematch || isRequestingRematch}
                      style={[styles.winkButton, styles.rematchButton]}
                    />
                    {(waitingForRematch || opponentWantsRematch) && (
                      <Text style={styles.rematchStatusText}>
                        {waitingForRematch
                          ? 'Waiting for rival to accept…'
                          : 'Rival wants a rematch!'}
                      </Text>
                    )}
                  </View>
                ) : (
                  <StyledButton
                    label={winkLabel}
                    variant="ghost"
                    onPress={() => {
                      if (!canToggleWink) return;
                      setWinkArmed((prev) => !prev);
                    }}
                    disabled={!canToggleWink}
                    style={[
                      styles.btn,
                      styles.winkButton,
                      winkArmed && styles.winkButtonActive,
                    ]}
                  />
                )}

                <StyledButton
                  label="View Rules"
                  variant="ghost"
                  onPress={() => setRulesOpen(true)}
                  style={[styles.btn, styles.goldOutlineButton]}
                />
              </View>
            </View>

            {game.status === 'finished' && !showRematchButton && (
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
          </View>
        </SafeAreaView>
      </FeltBackground>

      <BluffModal
        visible={claimPickerOpen}
        options={claimOptions}
        onCancel={() => setClaimPickerOpen(false)}
        onSelect={(value) => handleClaim(value, winkArmed)}
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
              <RulesContent />
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const BAR_BG = '#115E38';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B3A26',
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 20,
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
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 22,
    padding: 14,
    marginTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  playerColumn: {
    alignItems: 'center',
    width: 96,
  },
  avatarCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'transparent',
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
    alignItems: 'center',
    borderWidth: 1,
  },
  bannerText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  bannerContainer: {
    position: 'absolute',
    top: 270,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
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
  bannerWink: {
    borderColor: '#D9A307',
  },
  winkBanner: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  winkText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
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
  diceSpacer: {
    height: 15,
  },
  diceArea: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    marginTop: -94,
    marginBottom: 0,
  },
  diceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    backgroundColor: BAR_BG,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: -65,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  btn: {
    flex: 1,
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
  menuActionButton: {
    backgroundColor: '#C21807',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8B0000',
  },
  menuActionButtonSuccess: {
    backgroundColor: '#2ECC71',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1E8E4E',
  },
  goldOutlineButton: {
    borderWidth: 2,
    borderColor: '#E0B50C',
  },
  winkButton: {
    borderWidth: 2,
    borderColor: '#E0B50C',
    backgroundColor: 'transparent',
  },
  winkButtonActive: {
    backgroundColor: '#0B8A42',
  },
  rematchButton: {
    backgroundColor: '#E0B50C',
    borderColor: '#000',
    borderWidth: 2,
    paddingVertical: 8,
  },
  rematchWrapper: {
    flex: 1,
    alignItems: 'stretch',
  },
  rematchStatusText: {
    marginTop: 4,
    fontSize: 11,
    color: '#E6FFE6',
    textAlign: 'center',
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
});
