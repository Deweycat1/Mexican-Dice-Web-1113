import {
  playBluffCallFailHaptic,
  playBluffCallSuccessHaptic,
  playBluffDeclaredHaptic,
  playClaimHaptic,
  playLosePointHaptic,
  playRollHaptic,
  playSpecialClaimHaptic,
  playWinRoundHaptic,
} from '../../../src/lib/haptics';
import { useSettingsStore } from '../../../src/state/useSettingsStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedDiceReveal from '../../../src/components/AnimatedDiceReveal';
import BluffModal from '../../../src/components/BluffModal';
import Dice from '../../../src/components/Dice';
import FeltBackground from '../../../src/components/FeltBackground';
import OnlineMatchSummaryOverlay from '../../../src/components/OnlineMatchSummaryOverlay';
import RulesContent from '../../../src/components/RulesContent';
import { ScoreDie } from '../../../src/components/ScoreDie';
import StyledButton from '../../../src/components/StyledButton';
import { playDiceRollSound } from '../../../src/lib/diceRollSound';
import {
  claimMatchesRoll,
  compareClaims,
  isAlwaysClaimable,
  isChallengeClaim,
  isLegalRaise,
  isReverseOf,
  rankValue,
  resolveActiveChallenge,
  resolveBluff,
  splitClaim,
} from '../../../src/engine/mexican';
import { computeLegalTruth, rollDice } from '../../../src/engine/onlineRoll';
import { ensureUserProfile, getCurrentUser } from '../../../src/lib/auth';
import { getOnlineClaimOptions } from '../../../src/lib/claimOptionSources';
import { getClaimActionLabel } from '../../../src/lib/claimActionLabel';
import { supabase } from '../../../src/lib/supabase';
import { logEvent } from '../../../src/analytics/logEvent';
import { updatePersonalStatsOnGamePlayed } from '../../../src/stats/personalStats';
import { awardBadge } from '../../../src/stats/badges';
import { updateRankFromGameResult } from '../../../src/stats/rank';
import {
  finalizeOnlineMatchResult,
  type OnlineOpponentRecord,
  recordPlayerBluffCall,
  recordPlayerClaim,
  recordPlayerMatchResult,
  recordPlayerRoll,
} from '../../../src/stats/supabasePlayerStats';
import { initPushNotifications } from '../../../src/lib/pushNotifications';
import { getNextWompWompMessage } from '../../../src/lib/constants';

const formatClaim = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return ' - ';
  if (value === 21) return '21 (Inferno)';
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
  const [hi, lo] = splitClaim(value);
  return [hi, lo];
};

type PlayerRole = 'host' | 'guest';

export type ClaimSelfie = {
  id: string;
  from: PlayerRole;
  claim: number;
  timestamp: string;
};

type PendingSelfie = {
  uri: string;
  timestamp: string;
};

const oppositeRole = (role: PlayerRole): PlayerRole => (role === 'host' ? 'guest' : 'host');
const SELFIE_LIMIT = 3;
const MAX_SELFIE_ARCHIVE = SELFIE_LIMIT * 2;
const SELFIE_MAX_BASE64_LENGTH = 140_000;

const parseClaimSelfie = (value: unknown): ClaimSelfie | null => {
  if (!value || typeof value !== 'object') return null;
  const selfie = value as Partial<ClaimSelfie>;
  if (
    typeof selfie.id !== 'string' ||
    (selfie.from !== 'host' && selfie.from !== 'guest') ||
    typeof selfie.claim !== 'number' ||
    typeof selfie.timestamp !== 'string'
  ) {
    return null;
  }
  return selfie as ClaimSelfie;
};

const parseSelfieArchive = (value: unknown): ClaimSelfie[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseClaimSelfie)
    .filter((selfie): selfie is ClaimSelfie => selfie !== null)
    .slice(-MAX_SELFIE_ARCHIVE);
};

async function compressSelfie(uri: string): Promise<string> {
  const firstContext = ImageManipulator.manipulate(uri);
  firstContext.resize({ width: 480 });
  const firstImage = await firstContext.renderAsync();
  let result = await firstImage.saveAsync({
    base64: true,
    compress: 0.42,
    format: SaveFormat.JPEG,
  });

  if (!result.base64) {
    throw new Error('The camera did not return image data.');
  }

  if (result.base64.length > SELFIE_MAX_BASE64_LENGTH) {
    const smallerContext = ImageManipulator.manipulate(result.uri);
    smallerContext.resize({ width: 360 });
    const smallerImage = await smallerContext.renderAsync();
    result = await smallerImage.saveAsync({
      base64: true,
      compress: 0.3,
      format: SaveFormat.JPEG,
    });
  }

  if (!result.base64 || result.base64.length > SELFIE_MAX_BASE64_LENGTH) {
    throw new Error('The selfie is too large to send. Please retake it.');
  }

  return `data:image/jpeg;base64,${result.base64}`;
}

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
  hostSelfiesUsed: number;
  guestSelfiesUsed: number;
  activeClaimSelfie: ClaimSelfie | null;
  selfieArchive: ClaimSelfie[];
  lastSelfieBy: PlayerRole | null;
  lastSelfieNonce: number;
  lastBluffCaller: PlayerRole | null;
  lastBluffDefenderTruth: boolean | null;
  bluffResultNonce: number;
};

type HistoryItem =
  | { id: string; type: 'claim'; who: PlayerRole; claim: number; timestamp: string }
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
  matchmaking_type?: 'friend' | 'random' | null;
  selfie_summary_seen_by_host?: boolean;
  selfie_summary_seen_by_guest?: boolean;
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
  hostSelfiesUsed: 0,
  guestSelfiesUsed: 0,
  activeClaimSelfie: null,
  selfieArchive: [],
  lastSelfieBy: null,
  lastSelfieNonce: 0,
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
      matchmaking_type: game.matchmaking_type ?? null,
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
  const [banner, setBanner] = useState<{
    type: 'got-em' | 'womp-womp' | 'social' | 'selfie';
    text: string;
  } | null>(null);
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
  const [pendingSelfie, setPendingSelfie] = useState<PendingSelfie | null>(null);
  const [selfieCameraOpen, setSelfieCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [selfieCaptureBusy, setSelfieCaptureBusy] = useState(false);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [selfieViewerUri, setSelfieViewerUri] = useState<string | null>(null);
  const [summarySelfies, setSummarySelfies] = useState<ClaimSelfie[]>([]);
  const [selfieImagesById, setSelfieImagesById] = useState<Record<string, string>>({});
  const [isRequestingRematch, setIsRequestingRematch] = useState(false);
  const [onlineOpponentRecord, setOnlineOpponentRecord] = useState<OnlineOpponentRecord | null>(null);
  const [onlineOpponentRecordLoading, setOnlineOpponentRecordLoading] = useState(false);
  const prevStatusRef = useRef<GameStatus | null>(null);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const sfxEnabled = useSettingsStore((state) => state.sfxEnabled);
  const prevScoresRef = useRef<{ host: number; guest: number } | null>(null);
  const prevHistoryLengthRef = useRef<number>(0);
  const historyInitializedRef = useRef(false);
  const localHandledBluffBannerRef = useRef(false);
  const lastWompWompIndexRef = useRef(-1);
  const matchStartLoggedRef = useRef<string | null>(null);
  const matchEndLoggedRef = useRef<string | null>(null);
  const onlineMatchFinalizedRef = useRef<string | null>(null);
  const summarySeenMarkedRef = useRef<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const showBluffResultBanner = useCallback(
    (liar: boolean, iAmCaller: boolean) => {
      if (liar) {
        if (iAmCaller) {
          setBanner({ type: 'got-em', text: 'You caught their bluff.' });
        } else {
          const { text } = getNextWompWompMessage(lastWompWompIndexRef);
          setBanner({ type: 'womp-womp', text });
        }
      } else {
        if (iAmCaller) {
          const { text } = getNextWompWompMessage(lastWompWompIndexRef);
          setBanner({ type: 'womp-womp', text });
        } else {
          setBanner({ type: 'got-em', text: "GOT 'EM!!!" });
        }
      }
    },
    [setBanner]
  );

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const profile = await ensureUserProfile();
        if (isMounted) {
          setUserId(profile.id);
        }
      } catch (error) {
        console.error('[OnlineGame] Failed to ensure profile', error);
        const fallback = await getCurrentUser();
        if (isMounted) {
          setUserId(fallback?.id ?? null);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    console.log('[ONLINE GAME] initializing push notifications', { userId });
    void initPushNotifications({ userId, router });
  }, [userId, router]);

  useEffect(() => {
    onlineMatchFinalizedRef.current = null;
    setOnlineOpponentRecord(null);
    setOnlineOpponentRecordLoading(false);
    setPendingSelfie(null);
    setSelfieCameraOpen(false);
    setCameraPermissionDenied(false);
    setSelfieViewerUri(null);
    setSummarySelfies([]);
    setSelfieImagesById({});
    summarySeenMarkedRef.current = null;
  }, [normalizedGameId]);

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
      console.log('[ONLINE GAME] initial load', { gameId: normalizedGameId, payload: data });
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
            console.log('[ONLINE GAME] realtime update', {
              gameId: normalizedGameId,
              payload: payload.new,
            });
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
      const parsed = raw as Partial<RoundState>;
      const socialRevealDice = parsed.socialRevealDice;
      return {
        ...defaultRoundState,
        ...raw,
        history: Array.isArray(raw.history) ? raw.history : [],
        lastClaimRoll:
          typeof parsed.lastClaimRoll === 'number' || parsed.lastClaimRoll === null
            ? parsed.lastClaimRoll ?? null
            : null,
        socialRevealNonce:
          typeof parsed.socialRevealNonce === 'number'
            ? parsed.socialRevealNonce
            : 0,
        socialRevealDice:
          Array.isArray(socialRevealDice) &&
          socialRevealDice.length === 2
            ? [
                typeof socialRevealDice[0] === 'number' || socialRevealDice[0] === null
                  ? socialRevealDice[0] ?? null
                  : null,
                typeof socialRevealDice[1] === 'number' || socialRevealDice[1] === null
                  ? socialRevealDice[1] ?? null
                  : null,
              ]
            : null,
        hostSelfiesUsed:
          typeof (raw as any).hostSelfiesUsed === 'number' ? (raw as any).hostSelfiesUsed : 0,
        guestSelfiesUsed:
          typeof (raw as any).guestSelfiesUsed === 'number' ? (raw as any).guestSelfiesUsed : 0,
        activeClaimSelfie: parseClaimSelfie((raw as any).activeClaimSelfie),
        selfieArchive: parseSelfieArchive((raw as any).selfieArchive),
        lastSelfieBy:
          (raw as any).lastSelfieBy === 'host' || (raw as any).lastSelfieBy === 'guest'
            ? (raw as any).lastSelfieBy
            : null,
        lastSelfieNonce:
          typeof (raw as any).lastSelfieNonce === 'number' ? (raw as any).lastSelfieNonce : 0,
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
  const socialRevealNonceRef = useRef<number | null>(null);
  const rankUpdatedRef = useRef(false);

  const lastClaim = useMemo(() => {
    if (game?.last_claim == null) return null;
    if (typeof game.last_claim === 'number') return game.last_claim;
    const parsed = parseInt(game.last_claim, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [game?.last_claim]);

  const myRole: PlayerRole | null = useMemo(() => {
    if (!game || !userId) return null;
    if (userId === game.host_id) return 'host';
    if (userId === game.guest_id) return 'guest';
    return null;
  }, [game?.host_id, game?.guest_id, userId]);

  const isMyTurn = !!game && !!userId && game.current_player_id === userId;
  const opponentRole: PlayerRole | null = myRole === 'host' ? 'guest' : myRole === 'guest' ? 'host' : null;
  const myRoll = myRole === 'host' ? roundState.hostRoll : myRole === 'guest' ? roundState.guestRoll : null;
  const mustBluff = myRole === 'host' ? roundState.hostMustBluff : myRole === 'guest' ? roundState.guestMustBluff : false;
  const opponentName = myRole === 'host' ? guestName : hostName;
  const myScore = myRole === 'host' ? game?.host_score ?? 0 : game?.guest_score ?? 0;
  const opponentScore = myRole === 'host' ? game?.guest_score ?? 0 : game?.host_score ?? 0;
  const claimToCheck = resolveActiveChallenge(roundState.baselineClaim, lastClaim);
  const [dieHi, dieLo] = facesFromRoll(myRoll);
  const canClaimTruthfully =
    !!myRoll &&
    (claimToCheck == null
      ? true
      : isAlwaysClaimable(myRoll) ||
        isReverseOf(claimToCheck, myRoll) ||
        compareClaims(myRoll, claimToCheck) >= 0);

  useEffect(() => {
    console.log('[ONLINE GAME] current claim derived', {
      gameId: normalizedGameId,
      uiClaim: lastClaim,
      roundState,
    });
  }, [normalizedGameId, lastClaim, roundState]);

  useEffect(() => {
    if (!normalizedGameId || !userId) return;
    console.log('[ONLINE GAME] turn state', {
      gameId: normalizedGameId,
      currentPlayerId: game?.current_player_id ?? null,
      myPlayerId: userId,
      isMyTurn,
    });
  }, [normalizedGameId, userId, game?.current_player_id, isMyTurn]);

  useEffect(() => {
    if (!normalizedGameId || !game || !myRole) return;
    if (game.status === 'in_progress' && matchStartLoggedRef.current !== normalizedGameId) {
      matchStartLoggedRef.current = normalizedGameId;
      logEvent({ eventType: 'match_started', mode: 'online', onlineGameId: normalizedGameId });
    }
  }, [normalizedGameId, game, myRole]);

  useEffect(() => {
    if (!game || !myRole) return;
    const prev = prevStatusRef.current;
    if (prev !== 'finished' && game.status === 'finished') {
      if (normalizedGameId && matchEndLoggedRef.current !== normalizedGameId) {
        matchEndLoggedRef.current = normalizedGameId;
        logEvent({
          eventType: 'match_ended',
          mode: 'online',
          onlineGameId: normalizedGameId,
          metadata: { reason: 'game_over' },
        });
      }
      // Online games also count toward personal stats and day-based badges
      void (async () => {
        try {
          const stats = await updatePersonalStatsOnGamePlayed();
          if (stats.totalDaysPlayed >= 7) {
            void awardBadge('welcome_back_7_days');
          }
          if (stats.currentDailyStreak >= 7) {
            void awardBadge('inferno_week_7_day_streak');
          }
        } catch (err) {
          console.error('Failed to update personal stats after online game end', err);
        }
      })();

      // Update global rank based on online match outcome (non-blocking).
      if (!rankUpdatedRef.current) {
        rankUpdatedRef.current = true;
        void (async () => {
          try {
            const currentUser = await getCurrentUser();
            if (!currentUser || !game) {
              return;
            }

            let didCurrentUserWin: boolean | null = null;
            const isHost = currentUser.id === game.host_id;
            const isGuest = currentUser.id === game.guest_id;

            if (isHost) {
              if (game.host_score !== game.guest_score) {
                didCurrentUserWin = game.host_score > game.guest_score;
              }
            } else if (isGuest) {
              if (game.host_score !== game.guest_score) {
                didCurrentUserWin = game.guest_score > game.host_score;
              }
            }

            if (didCurrentUserWin !== null) {
              void recordPlayerMatchResult({
                mode: 'online',
                won: didCurrentUserWin,
              });
              void updateRankFromGameResult({
                mode: 'online',
                won: didCurrentUserWin,
              });
            }
          } catch (err) {
            console.error('Failed to update rank after online game end', err);
          }
        })();
      }
    }
    prevStatusRef.current = game.status;
  }, [game?.status, myRole]);
  useEffect(() => {
    if (!game || !myRole) return;
    const prev = prevScoresRef.current;
    const current = { host: game.host_score, guest: game.guest_score };
    if (!prev) {
      prevScoresRef.current = current;
      return;
    }
    if (current.host !== prev.host) {
      if (myRole === 'host' && current.host < prev.host) {
        void playLosePointHaptic(hapticsEnabled);
      } else if (myRole === 'guest' && current.host < prev.host) {
        void playWinRoundHaptic(hapticsEnabled);
      }
    }
    if (current.guest !== prev.guest) {
      if (myRole === 'guest' && current.guest < prev.guest) {
        void playLosePointHaptic(hapticsEnabled);
      } else if (myRole === 'host' && current.guest < prev.guest) {
        void playWinRoundHaptic(hapticsEnabled);
      }
    }
    prevScoresRef.current = current;
  }, [game?.host_score, game?.guest_score, myRole, hapticsEnabled]);
  const claimSummary = useMemo(() => {
    const selfie = roundState.activeClaimSelfie;
    const hasActiveSelfie =
      !!selfie &&
      selfie.claim === lastClaim &&
      selfie.from === roundState.lastClaimer;
    return `Claim: ${formatClaim(lastClaim)}${hasActiveSelfie ? ' + selfie' : ''}`;
  }, [lastClaim, roundState.activeClaimSelfie, roundState.lastClaimer]);
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
  const angryRivalThinking = useMemo(() => {
    if (isMyTurn) return false;
    if (!myRole) return false;
    if (roundState.lastClaimer !== myRole) return false;
    return lastClaim === 21;
  }, [isMyTurn, myRole, roundState.lastClaimer, lastClaim]);
  const mySelfiesUsed =
    myRole === 'host'
      ? roundState.hostSelfiesUsed ?? 0
      : myRole === 'guest'
      ? roundState.guestSelfiesUsed ?? 0
      : 0;
  const selfieUsesRemaining = Math.max(0, SELFIE_LIMIT - mySelfiesUsed);
  const isMobileCameraPlatform = Platform.OS === 'ios' || Platform.OS === 'android';
  const isFriendMatch = game?.matchmaking_type !== 'random';
  const canPrepareSelfie =
    !!myRole &&
    isFriendMatch &&
    isMobileCameraPlatform &&
    isMyTurn &&
    game?.status === 'in_progress' &&
    myRoll != null &&
    selfieUsesRemaining > 0 &&
    !cameraPermissionDenied &&
    !isRevealAnimating;
  const showSelfiePrompt =
    isFriendMatch &&
    isMobileCameraPlatform &&
    isMyTurn &&
    game?.status === 'in_progress' &&
    myRoll != null &&
    !isRevealAnimating;
  const activeOpponentSelfie =
    isOpponentClaimPhase &&
    roundState.activeClaimSelfie?.from !== myRole
      ? roundState.activeClaimSelfie
      : null;
  const activeOpponentSelfieUri = activeOpponentSelfie
    ? selfieImagesById[activeOpponentSelfie.id] || null
    : null;
  const activeOpponentSelfieLoadComplete = activeOpponentSelfie
    ? typeof selfieImagesById[activeOpponentSelfie.id] === 'string'
    : false;
  useEffect(() => {
    if (!isMyTurn || myRoll == null || game?.status !== 'in_progress') {
      setPendingSelfie(null);
      setSelfieCameraOpen(false);
    }
  }, [game?.status, isMyTurn, myRoll]);
  useEffect(() => {
    const history = roundState.history ?? [];
    const prevLen = prevHistoryLengthRef.current ?? 0;
    if (!myRole) {
      prevHistoryLengthRef.current = history.length;
      historyInitializedRef.current = false;
      return;
    }
    if (!historyInitializedRef.current) {
      prevHistoryLengthRef.current = history.length;
      historyInitializedRef.current = true;
      return;
    }
    if (history.length < prevLen) {
      prevHistoryLengthRef.current = history.length;
      return;
    }
    if (history.length > prevLen) {
      const newItems = history.slice(prevLen);
      newItems.forEach((item) => {
        if (item.type === 'claim' && item.who !== myRole) {
          if (item.claim === 21 || item.claim === 31 || item.claim === 41) {
            void playSpecialClaimHaptic(item.claim, hapticsEnabled);
          }
        }
      });
    }
    prevHistoryLengthRef.current = history.length;
  }, [roundState.history, myRole, hapticsEnabled]);
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
        : 'Rematch';
  const showRematchButton = isGameFinished && !!myRole;
  const myOpponentRecordName = onlineOpponentRecord?.opponentUsername || opponentName;
  const didPlayerWin = isGameFinished ? myScore > opponentScore : false;
  const opponentSelfiesUsed =
    myRole === 'host'
      ? roundState.guestSelfiesUsed ?? 0
      : myRole === 'guest'
      ? roundState.hostSelfiesUsed ?? 0
      : 0;
  useEffect(() => {
    if (roundState.selfieArchive.length > 0) {
      setSummarySelfies(roundState.selfieArchive);
    }
  }, [roundState.selfieArchive]);
  const selfieIds = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...roundState.selfieArchive.map((selfie) => selfie.id),
            roundState.activeClaimSelfie?.id,
          ].filter((id): id is string => typeof id === 'string')
        )
      ),
    [roundState.activeClaimSelfie?.id, roundState.selfieArchive]
  );
  const selfieIdsKey = selfieIds.join(',');
  useEffect(() => {
    if (!game?.id || selfieIds.length === 0) return;
    const missingIds = selfieIds.filter(
      (id) => typeof selfieImagesById[id] !== 'string'
    );
    if (missingIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      const { data, error: selfieError } = await supabase
        .from('online_match_selfies')
        .select('id, image_data')
        .eq('game_id', game.id)
        .in('id', missingIds);

      if (cancelled) return;
      if (selfieError) {
        console.warn('[ONLINE GAME] failed to load match selfies', selfieError);
        setSelfieImagesById((current) => {
          const next = { ...current };
          for (const id of missingIds) next[id] = '';
          return next;
        });
        return;
      }

      setSelfieImagesById((current) => {
        const next = { ...current };
        let changed = false;
        const loadedIds = new Set<string>();
        for (const row of data ?? []) {
          if (typeof row.id === 'string' && typeof row.image_data === 'string') {
            loadedIds.add(row.id);
            if (next[row.id] !== row.image_data) {
              next[row.id] = row.image_data;
              changed = true;
            }
          }
        }
        for (const id of missingIds) {
          if (!loadedIds.has(id) && typeof next[id] !== 'string') {
            next[id] = '';
            changed = true;
          }
        }
        return changed ? next : current;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [game?.id, selfieIds, selfieIdsKey, selfieImagesById]);
  const summarySelfieMetadata =
    summarySelfies.length > 0 ? summarySelfies : roundState.selfieArchive;
  const summarySelfieItems = useMemo(
    () =>
      summarySelfieMetadata.flatMap((selfie) => {
        const uri = selfieImagesById[selfie.id];
        return uri
          ? [{
              id: selfie.id,
              uri,
              claim: selfie.claim,
              ownerLabel: selfie.from === myRole ? 'You' : opponentName,
            }]
          : [];
      }),
    [myRole, opponentName, selfieImagesById, summarySelfieMetadata]
  );
  const allSummarySelfiesLoaded = summarySelfieMetadata.every(
    (selfie) => typeof selfieImagesById[selfie.id] === 'string'
  );
  const showMatchSummary =
    isGameFinished &&
    !!myRole &&
    !game?.rematch_game_id &&
    !isRevealAnimating &&
    !isRevealingBluff &&
    !revealDiceValues;
  const finalBlowText = useMemo(() => {
    const caller = roundState.lastBluffCaller ?? null;
    const defenderTruth =
      typeof roundState.lastBluffDefenderTruth === 'boolean'
        ? roundState.lastBluffDefenderTruth
        : null;

    if (!caller || defenderTruth === null || !myRole) {
      const lastEvent = [...(roundState.history ?? [])].reverse().find((entry) => entry.type === 'event');
      return lastEvent?.type === 'event'
        ? lastEvent.text
        : 'The final challenge ended the match.';
    }

    const defender = oppositeRole(caller);
    const callerLabel = caller === myRole ? 'You' : opponentName;
    const defenderLabel = defender === myRole ? 'you' : opponentName;

    if (defenderTruth) {
      if (caller === myRole) {
        return `${opponentName} told the truth and your call ended the match.`;
      }
      return `Your truth held up and ${opponentName}'s call ended the match.`;
    }

    if (caller === myRole) {
      return `You caught ${opponentName} bluffing to end the match.`;
    }

    return `${callerLabel} caught ${defenderLabel} bluffing to end the match.`;
  }, [
    myRole,
    opponentName,
    roundState.history,
    roundState.lastBluffCaller,
    roundState.lastBluffDefenderTruth,
  ]);
  useEffect(() => {
    if (!showMatchSummary || !normalizedGameId) return;
    if (onlineMatchFinalizedRef.current === normalizedGameId) return;

    onlineMatchFinalizedRef.current = normalizedGameId;
    setOnlineOpponentRecordLoading(true);
    void (async () => {
      const record = await finalizeOnlineMatchResult(normalizedGameId);
      setOnlineOpponentRecord(record);
      setOnlineOpponentRecordLoading(false);
    })();
  }, [normalizedGameId, showMatchSummary]);
  useEffect(() => {
    if (!showMatchSummary || !allSummarySelfiesLoaded || !game || !myRole) return;
    const alreadySeen =
      myRole === 'host'
        ? game.selfie_summary_seen_by_host
        : game.selfie_summary_seen_by_guest;
    if (alreadySeen || summarySeenMarkedRef.current === game.id) return;

    summarySeenMarkedRef.current = game.id;
    const column =
      myRole === 'host'
        ? 'selfie_summary_seen_by_host'
        : 'selfie_summary_seen_by_guest';
    setGame((current) => current ? { ...current, [column]: true } : current);
    void supabase
      .from('games_v2')
      .update({ [column]: true })
      .eq('id', game.id)
      .then(({ error: seenError }) => {
        if (seenError) {
          console.warn('[ONLINE GAME] failed to mark selfie summary seen', seenError);
          summarySeenMarkedRef.current = null;
        }
      });
  }, [
    allSummarySelfiesLoaded,
    game,
    myRole,
    showMatchSummary,
  ]);

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
    const nonce = roundState.socialRevealNonce ?? null;
    const dice = roundState.socialRevealDice ?? null;

    console.log('[SOCIAL REVEAL] effect', {
      source: 'online/[gameId]',
      nonce,
      refNonce: socialRevealNonceRef.current,
      dice,
      lastAction: roundState.lastAction,
      lastClaim: lastClaim,
    });

    // On first mount, just sync the ref to whatever nonce exists
    if (socialRevealNonceRef.current == null) {
      socialRevealNonceRef.current = nonce ?? 0;
      return;
    }

    // If nonce reset (e.g., new game), sync down without triggering
    if (nonce != null && nonce < socialRevealNonceRef.current) {
      socialRevealNonceRef.current = nonce;
      return;
    }

    if (nonce != null && dice && nonce > socialRevealNonceRef.current) {
      console.log('[SOCIAL REVEAL] starting reveal due to nonce bump');
      socialRevealNonceRef.current = nonce;
      startSocialReveal(dice);
    }
  }, [roundState.socialRevealNonce, roundState.socialRevealDice, roundState.lastAction, lastClaim, startSocialReveal]);
  const lastSelfieNonceRef = useRef(roundState.lastSelfieNonce ?? 0);
  const selfieGlowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const selfieNonce = roundState.lastSelfieNonce ?? 0;
    const selfieBy = roundState.lastSelfieBy ?? null;
    if (!game || !myRole) return;
    if (selfieNonce < lastSelfieNonceRef.current) {
      lastSelfieNonceRef.current = selfieNonce;
      return;
    }
    if (!selfieNonce || !selfieBy) return;
    if (selfieNonce <= lastSelfieNonceRef.current) return;
    lastSelfieNonceRef.current = selfieNonce;
    if (selfieBy === myRole) return;
    if (game.status !== 'in_progress') return;
    setBanner({ type: 'selfie', text: 'Live selfie received' });
    selfieGlowAnim.setValue(0);
    Animated.sequence([
      Animated.timing(selfieGlowAnim, { toValue: 1, duration: 250, useNativeDriver: false }),
      Animated.timing(selfieGlowAnim, { toValue: 0, duration: 250, useNativeDriver: false }),
    ]).start();
  }, [roundState.lastSelfieNonce, roundState.lastSelfieBy, game?.status, myRole, selfieGlowAnim]);
  const selfieGlowStyle = {
    borderWidth: 2,
    borderColor: selfieGlowAnim.interpolate({ inputRange: [0, 1], outputRange: ['#30363D', '#FE9902'] }),
    shadowColor: '#FE9902',
    shadowOpacity: selfieGlowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
    shadowRadius: selfieGlowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }),
  };
  const bluffResultNonceRef = useRef(roundState.bluffResultNonce ?? 0);
  useEffect(() => {
    const bluffNonce = roundState.bluffResultNonce ?? 0;
    const caller = roundState.lastBluffCaller ?? null;
    const defenderTruth =
      typeof roundState.lastBluffDefenderTruth === 'boolean'
        ? roundState.lastBluffDefenderTruth
        : null;
    if (!caller || defenderTruth === null) return;
    if (!myRole) return;
    if (bluffNonce <= bluffResultNonceRef.current) return;
    bluffResultNonceRef.current = bluffNonce;

    const liar = !defenderTruth;
    const iAmCaller = myRole === caller;

    if (isRevealingBluff || revealDiceValues) return;
    if (iAmCaller && localHandledBluffBannerRef.current) return;

    showBluffResultBanner(liar, iAmCaller);
  }, [
    roundState.bluffResultNonce,
    roundState.lastBluffCaller,
    roundState.lastBluffDefenderTruth,
    myRole,
    isRevealingBluff,
    revealDiceValues,
    showBluffResultBanner,
  ]);

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
    if (!game.guest_id) return 'Waiting for an opponent to join.';
    if (isMyTurn) {
      if (myRoll == null) return 'Roll to see your dice.';
      if (mustBluff) return `You rolled ${formatRoll(myRoll)}. You must bluff with a higher claim.`;
      return `You rolled ${formatRoll(myRoll)}. Choose a claim or bluff.`;
    }
    return 'Waiting for opponent...';
  })();

  const claimOptions = useMemo(() => {
    const baseline = claimToCheck ?? null;
    return getOnlineClaimOptions(baseline, myRoll);
  }, [claimToCheck, myRoll]);
  const shouldHighlightBluff =
    isMyTurn && myRoll != null && claimToCheck != null && !canClaimTruthfully;

  const handleUpdate = useCallback(
    async (
      payload: Record<string, any>,
      nextRound?: RoundState,
      options?: { requireCurrentPlayerId?: string | null }
    ) => {
      if (!normalizedGameId) throw new Error('Missing game id');
      const updatePayload = { ...payload };
      if (nextRound) updatePayload.round_state = nextRound;

      console.log('[ONLINE GAME] submitting move', {
        gameId: normalizedGameId,
        payload: updatePayload,
        hasRoundState: !!nextRound,
      });

      if (nextRound) {
        setGame((prev) =>
          prev && prev.id === normalizedGameId
            ? ({ ...(prev as OnlineGameV2), ...updatePayload, round_state: nextRound } as OnlineGameV2)
            : prev
        );
      }

      let query = supabase.from('games_v2').update(updatePayload).eq('id', normalizedGameId);
      if (options?.requireCurrentPlayerId) {
        query = query.eq('current_player_id', options.requireCurrentPlayerId);
      }
      const { data, error: updateError } = await query.select('id');
      if (updateError) throw new Error(updateError.message);
      if (!data || data.length === 0) {
        throw new Error(OUT_OF_TURN_ERROR);
      }

      console.log('[ONLINE GAME] move persisted', {
        gameId: normalizedGameId,
        rows: data.length,
      });
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
    void playRollHaptic(hapticsEnabled);
    void playDiceRollSound(sfxEnabled);
    try {
      const { values, normalized } = rollDice();
      const legalTruth = computeLegalTruth(claimToCheck ?? null, normalized);
      const nextRound: RoundState = {
        ...roundState,
        hostRoll: myRole === 'host' ? normalized : roundState.hostRoll,
        guestRoll: myRole === 'guest' ? normalized : roundState.guestRoll,
        hostMustBluff: myRole === 'host' ? !legalTruth : roundState.hostMustBluff,
        guestMustBluff: myRole === 'guest' ? !legalTruth : roundState.guestMustBluff,
        activeClaimSelfie: null,
      };
      await handleUpdate(
        {
          last_roll_1: values[0],
          last_roll_2: values[1],
        },
        nextRound,
        { requireCurrentPlayerId: userId }
      );
      void recordPlayerRoll({ roll: normalized });
    } catch (err: any) {
      if (err?.message === OUT_OF_TURN_ERROR) {
        Alert.alert('Move expired', 'This move is no longer valid. Please reload the match.');
      } else {
        Alert.alert('Roll failed', err.message ?? 'Could not save roll.');
      }
    } finally {
      setTimeout(() => setRollingAnim(false), 400);
    }
  }, [game, myRole, isMyTurn, isRevealAnimating, roundState, claimToCheck, handleUpdate, userId, hapticsEnabled, sfxEnabled]);

  const appendHistory = useCallback(
    (entry: HistoryItem): HistoryItem[] => {
      const next = [...roundState.history, entry];
      return next.slice(-12);
    },
    [roundState.history]
  );

  const handleOpenSelfieCamera = useCallback(async () => {
    if (!canPrepareSelfie) return;
    if (pendingSelfie) {
      setSelfieCameraOpen(true);
      return;
    }

    try {
      const permission = cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();
      if (!permission.granted) {
        setCameraPermissionDenied(true);
        Alert.alert(
          'Camera unavailable',
          'Camera access was denied. Selfies are disabled for this match.'
        );
        return;
      }
      setCameraReady(false);
      setSelfieCameraOpen(true);
    } catch (err) {
      console.error('[ONLINE GAME] camera permission failed', err);
      setCameraPermissionDenied(true);
      Alert.alert('Camera unavailable', 'Selfies are disabled for this match.');
    }
  }, [cameraPermission, canPrepareSelfie, pendingSelfie, requestCameraPermission]);

  const handleCaptureSelfie = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || selfieCaptureBusy) return;
    setSelfieCaptureBusy(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.55,
        exif: false,
        skipProcessing: false,
      });
      const dataUri = await compressSelfie(picture.uri);
      setPendingSelfie({
        uri: dataUri,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[ONLINE GAME] selfie capture failed', err);
      Alert.alert(
        'Selfie failed',
        err instanceof Error ? err.message : 'Could not capture the selfie.'
      );
    } finally {
      setSelfieCaptureBusy(false);
    }
  }, [cameraReady, selfieCaptureBusy]);

  const handleRetakeSelfie = useCallback(() => {
    setPendingSelfie(null);
    setCameraReady(false);
  }, []);

  const handleRemoveSelfie = useCallback(() => {
    setPendingSelfie(null);
    setSelfieCameraOpen(false);
    setCameraReady(false);
  }, []);

  const handleClaim = useCallback(
    async (claim: number) => {
      if (!game || !userId || !myRole || !opponentRole || !isMyTurn || isRevealAnimating) return;
      void playClaimHaptic(hapticsEnabled);
      const prev = lastClaim;
      const activeChallenge = resolveActiveChallenge(roundState.baselineClaim, prev);
      if (activeChallenge === 21 && claim !== 21 && claim !== 31 && claim !== 41) {
        Alert.alert('Invalid claim', 'After an Inferno roll (21), only 21, 31, or 41 are legal.');
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

      const timestamp = new Date().toISOString();
      const effectiveSelfie =
        claim !== 41 &&
        isFriendMatch &&
        pendingSelfie !== null &&
        selfieUsesRemaining > 0;
      const newHistory = appendHistory({
        id: uuid(),
        type: 'claim',
        who: myRole,
        claim,
        timestamp,
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
      if (myCurrentRoll != null && claim !== myCurrentRoll) {
        void playBluffDeclaredHaptic(hapticsEnabled);
      }

      let insertedSelfieId: string | null = null;
      let claimSelfie: ClaimSelfie | null = null;
      if (effectiveSelfie && pendingSelfie) {
        const { data: selfieRow, error: selfieError } = await supabase
          .from('online_match_selfies')
          .insert({
            game_id: game.id,
            sender_id: userId,
            sender_role: myRole,
            claim,
            image_data: pendingSelfie.uri,
          })
          .select('id')
          .single();

        if (selfieError || !selfieRow?.id) {
          console.error('[ONLINE GAME] selfie upload failed', selfieError);
          Alert.alert('Selfie failed', 'Your claim was not sent. Please try the selfie again.');
          return;
        }

        insertedSelfieId = selfieRow.id;
        claimSelfie = {
          id: selfieRow.id,
          from: myRole,
          claim,
          timestamp: pendingSelfie.timestamp,
        };
        setSelfieImagesById((current) => ({
          ...current,
          [selfieRow.id]: pendingSelfie.uri,
        }));
      }

      const nextSelfieNonce = claimSelfie
        ? (roundState.lastSelfieNonce ?? 0) + 1
        : roundState.lastSelfieNonce;
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
        hostSelfiesUsed:
          myRole === 'host'
            ? roundState.hostSelfiesUsed + (claimSelfie ? 1 : 0)
            : roundState.hostSelfiesUsed,
        guestSelfiesUsed:
          myRole === 'guest'
            ? roundState.guestSelfiesUsed + (claimSelfie ? 1 : 0)
            : roundState.guestSelfiesUsed,
        activeClaimSelfie: claimSelfie,
        selfieArchive: claimSelfie
          ? [...roundState.selfieArchive, claimSelfie].slice(-MAX_SELFIE_ARCHIVE)
          : roundState.selfieArchive,
        lastSelfieBy: claimSelfie ? myRole : roundState.lastSelfieBy ?? null,
        lastSelfieNonce: nextSelfieNonce,
      };

      if (myRole === 'host') {
        nextRound.hostRoll = null;
        nextRound.hostMustBluff = false;
      } else if (myRole === 'guest') {
        nextRound.guestRoll = null;
        nextRound.guestMustBluff = false;
      }

      if (claim === 41) {
        void playSpecialClaimHaptic(41, hapticsEnabled);
        nextRound.hostRoll = null;
        nextRound.guestRoll = null;
        nextRound.hostMustBluff = false;
        nextRound.guestMustBluff = false;
        nextRound.lastAction = 'normal';
        nextRound.lastClaimer = null;
        nextRound.activeClaimSelfie = null;
      } else if (claim === 21 || claim === 31) {
        void playSpecialClaimHaptic(claim, hapticsEnabled);
      }

      const payload: Record<string, any> = {
        last_claim: claim === 41 ? null : claim,
        current_player_id: opponentId,
      };

      try {
        await handleUpdate(payload, nextRound, { requireCurrentPlayerId: userId });
        void recordPlayerClaim({
          claim,
          actualRoll: myCurrentRoll,
          truthful:
            myCurrentRoll != null
              ? claimMatchesRoll(claim, myCurrentRoll)
              : null,
        });
        setClaimPickerOpen(false);
        setPendingSelfie(null);
        setSelfieCameraOpen(false);
        setCameraReady(false);
        if (claim === 41) {
          setBanner({ type: 'social', text: '🍻 SOCIAL!!! 🍻' });
        }
      } catch (err: any) {
        if (insertedSelfieId) {
          const failedSelfieId = insertedSelfieId;
          void supabase
            .from('online_match_selfies')
            .delete()
            .eq('id', failedSelfieId)
            .eq('game_id', game.id);
          setSelfieImagesById((current) => {
            const next = { ...current };
            delete next[failedSelfieId];
            return next;
          });
        }
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
      isFriendMatch,
      pendingSelfie,
      selfieUsesRemaining,
      userId,
      hapticsEnabled,
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

    const { outcome, penalty } = resolveBluff(
      lastClaim,
      defenderRoll,
      roundState.lastAction === 'reverseVsMexican'
    );
    const liar = outcome === +1;
    const iAmCaller = true;
    logEvent({
      eventType: 'bluff_called',
      mode: 'online',
      onlineGameId: normalizedGameId ?? null,
      metadata: {
        caller: myRole,
        successful: liar,
        defenderRole: defendingRole,
        liarRole: liar ? defendingRole : null,
      },
    });
    const loserRole = liar ? defendingRole : myRole;
    if (liar) {
      void playBluffCallSuccessHaptic(hapticsEnabled);
    } else {
      void playBluffCallFailHaptic(hapticsEnabled);
    }
    if (loserRole === myRole) {
      void playLosePointHaptic(hapticsEnabled);
    } else {
      void playWinRoundHaptic(hapticsEnabled);
    }
    const callerName = myRole === 'host' ? hostName : guestName;
    const defenderName = defendingRole === 'host' ? hostName : guestName;
    const [revealHi, revealLo] = splitClaim(defenderRoll);
    setRevealDiceValues([revealHi, revealLo]);
    setIsRevealingBluff(true);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => {
      setIsRevealingBluff(false);
      setRevealDiceValues(null);
      localHandledBluffBannerRef.current = true;
      showBluffResultBanner(liar, iAmCaller);
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
      hostSelfiesUsed: roundState.hostSelfiesUsed,
      guestSelfiesUsed: roundState.guestSelfiesUsed,
      activeClaimSelfie: null,
      selfieArchive: roundState.selfieArchive,
      lastSelfieBy: roundState.lastSelfieBy ?? null,
      lastSelfieNonce: roundState.lastSelfieNonce ?? 0,
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
    prevScoresRef.current = { host: nextHostScore, guest: nextGuestScore };

    try {
      await handleUpdate(payload, nextRound, { requireCurrentPlayerId: userId });
      void recordPlayerBluffCall({ correct: liar });
    } catch (err: any) {
      if (err?.message === OUT_OF_TURN_ERROR) {
        Alert.alert('Move expired', 'This move is no longer valid. Please reload the match.');
      } else {
        Alert.alert('Bluff call failed', err.message ?? 'Could not resolve bluff.');
      }
    }
  }, [
    game,
    myRole,
    opponentRole,
    isMyTurn,
    lastClaim,
    isRevealAnimating,
    roundState,
    appendHistory,
    handleUpdate,
    hostName,
    guestName,
    normalizedGameId,
    userId,
    hapticsEnabled,
    showBluffResultBanner,
  ]);

  const clearFinishedMatchSelfies = useCallback(async (force = false) => {
    if (!game || !myRole || game.status !== 'finished') return;
    try {
      if (!force) {
        if (!allSummarySelfiesLoaded) return;
        const seenColumn =
          myRole === 'host'
            ? 'selfie_summary_seen_by_host'
            : 'selfie_summary_seen_by_guest';
        const { error: seenError } = await supabase
          .from('games_v2')
          .update({ [seenColumn]: true })
          .eq('id', game.id);
        if (seenError) {
          console.warn('[ONLINE GAME] failed to mark selfie summary seen', seenError);
        }

        const { data: seenState, error: seenStateError } = await supabase
          .from('games_v2')
          .select('selfie_summary_seen_by_host, selfie_summary_seen_by_guest')
          .eq('id', game.id)
          .single();
        if (seenStateError) {
          console.warn('[ONLINE GAME] failed to read selfie summary state', seenStateError);
          return;
        }
        if (
          !seenState?.selfie_summary_seen_by_host ||
          !seenState?.selfie_summary_seen_by_guest
        ) {
          return;
        }
      }

      const { error: deleteError } = await supabase
        .from('online_match_selfies')
        .delete()
        .eq('game_id', game.id);
      if (deleteError) {
        console.warn('[ONLINE GAME] selfie image cleanup failed', deleteError);
      }

      if (!roundState.activeClaimSelfie && roundState.selfieArchive.length === 0) return;
      const nextRound: RoundState = {
        ...roundState,
        activeClaimSelfie: null,
        selfieArchive: [],
      };
      const { error: cleanupError } = await supabase
        .from('games_v2')
        .update({ round_state: nextRound })
        .eq('id', game.id);
      if (cleanupError) {
        console.warn('[ONLINE GAME] selfie cleanup failed', cleanupError);
      }
    } catch (err) {
      console.warn('[ONLINE GAME] selfie cleanup failed', err);
    }
  }, [allSummarySelfiesLoaded, game, myRole, roundState]);

  const handleQuitGame = useCallback(() => {
    console.log('[OnlineGameV2] Leave Game pressed (no confirm)');
    void clearFinishedMatchSelfies(false);
    router.push('/online' as const);
  }, [clearFinishedMatchSelfies, router]);

  const handleMainMenuPress = useCallback(async () => {
    await clearFinishedMatchSelfies(false);
    router.replace('/');
  }, [clearFinishedMatchSelfies, router]);

  const handleRematchPress = useCallback(async () => {
    if (!game || !userId) return;
    setIsRequestingRematch(true);
    try {
      const newGameId = await requestRematchForGame(game, userId);
      if (newGameId) {
        await clearFinishedMatchSelfies(true);
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
  }, [clearFinishedMatchSelfies, game, userId, router]);

  if (loading) {
    return (
      <View style={styles.root}>
        <FeltBackground>
          <SafeAreaView style={styles.safe}>
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#FE9902" />
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
  const hasClaim = lastClaim != null;
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
                      style={styles.userAvatarImage}
                    />
                  </View>
                  <ScoreDie points={myScore} style={styles.scoreDie} size={38} animated={false} />
                  <Text style={styles.playerLabel}>You</Text>
                </View>

                <View style={styles.titleColumn}>
                  <Text style={styles.claimText}>{claimSummary}</Text>
                </View>

                <View style={styles.playerColumn}>
                  <View style={styles.avatarCircle}>
                    <Image
                      source={require('../../../assets/images/Rival.png')}
                      style={styles.rivalAvatarImage}
                    />
                  </View>
                  <ScoreDie points={opponentScore} style={styles.scoreDie} size={38} animated={false} />
                  <Text
                    style={styles.playerLabel}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {opponentName}
                  </Text>
                </View>
              </View>

              <Text style={styles.status} numberOfLines={2}>
                {myTurnText}
              </Text>
            </View>

            {banner && (
              <Animated.View pointerEvents="none" style={styles.bannerContainer}>
                {banner.type === 'selfie' ? (
                  <Animated.View>
                    <LinearGradient
                      colors={['#FE9902', '#D97706']}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.selfieBanner}
                    >
                      <MaterialIcons name="photo-camera" size={18} color="#161B22" />
                      <Text style={styles.selfieBannerText}>{banner.text}</Text>
                    </LinearGradient>
                  </Animated.View>
                ) : (
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

            {activeOpponentSelfie ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${opponentName}'s claim selfie`}
                disabled={!activeOpponentSelfieUri}
                onPress={() => {
                  if (activeOpponentSelfieUri) setSelfieViewerUri(activeOpponentSelfieUri);
                }}
                style={({ pressed }) => [
                  styles.opponentSelfieNotice,
                  pressed && styles.opponentSelfieNoticePressed,
                ]}
              >
                <Animated.View style={[styles.opponentSelfieThumbFrame, selfieGlowStyle]}>
                  {activeOpponentSelfieUri ? (
                    <Image
                      source={{ uri: activeOpponentSelfieUri }}
                      style={styles.opponentSelfieThumb}
                    />
                  ) : activeOpponentSelfieLoadComplete ? (
                    <MaterialIcons name="broken-image" size={24} color="#8B949E" />
                  ) : (
                    <ActivityIndicator color="#FE9902" />
                  )}
                </Animated.View>
                <View style={styles.opponentSelfieCopy}>
                  <Text style={styles.opponentSelfieTitle} numberOfLines={1}>
                    {opponentName}&apos;s claim selfie
                  </Text>
                  <Text style={styles.opponentSelfieMeta}>
                    Claim {formatClaim(lastClaim)}
                  </Text>
                </View>
                <MaterialIcons name="open-in-full" size={20} color="#FE9902" />
              </Pressable>
            ) : null}

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
                  rolling={isMyTurn && rolling}
                  displayMode={diceDisplayMode}
                  overlayText={diceDisplayMode === 'prompt' ? 'Your' : undefined}
                  size={100}
                />
                <View style={{ width: 24 }} />
                <Dice
                  value={dieLo}
                  rolling={isMyTurn && rolling}
                  displayMode={diceDisplayMode}
                  overlayText={diceDisplayMode === 'prompt' ? 'Roll' : undefined}
                  size={100}
                />
              </>
            ) : (
              <>
                <Dice
                  value={null}
                  size={100}
                  thinkingOverlay="rival"
                  angryThinking={angryRivalThinking}
                />
                <View style={{ width: 24 }} />
                <Dice
                  value={null}
                  size={100}
                  thinkingOverlay="thought"
                  angryThinking={angryRivalThinking}
                />
              </>
            )}
          </View>
        </View>

              <View style={styles.controls}>
              {showSelfiePrompt ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    pendingSelfie
                      ? 'Review attached selfie'
                      : `Add live selfie, ${selfieUsesRemaining} remaining`
                  }
                  disabled={!canPrepareSelfie}
                  onPress={handleOpenSelfieCamera}
                  style={({ pressed }) => [
                    styles.selfiePrompt,
                    pendingSelfie && styles.selfiePromptReady,
                    !canPrepareSelfie && styles.selfiePromptDisabled,
                    pressed && canPrepareSelfie && styles.selfiePromptPressed,
                  ]}
                >
                  {pendingSelfie ? (
                    <Image source={{ uri: pendingSelfie.uri }} style={styles.selfiePromptThumb} />
                  ) : (
                    <View style={styles.selfiePromptIcon}>
                      <MaterialIcons name="photo-camera" size={24} color="#FFFFFF" />
                    </View>
                  )}
                  <View style={styles.selfiePromptCopy}>
                    <Text style={styles.selfiePromptTitle}>
                      {pendingSelfie
                        ? 'Selfie attached'
                        : cameraPermissionDenied
                          ? 'Camera denied'
                          : selfieUsesRemaining === 0
                            ? 'Selfies used'
                            : 'Add live selfie'}
                    </Text>
                    <Text style={styles.selfiePromptMeta}>
                      {pendingSelfie
                        ? `Sends with claim · ${selfieUsesRemaining} left`
                        : `${selfieUsesRemaining} of ${SELFIE_LIMIT} left`}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={pendingSelfie ? 'edit' : 'chevron-right'}
                    size={24}
                    color={canPrepareSelfie ? '#FFFFFF' : '#8B949E'}
                  />
                </Pressable>
              ) : null}
              <View style={styles.actionRow}>
                <StyledButton
                  label={canRoll ? 'Roll' : getClaimActionLabel(myRoll)}
                  variant="success"
                  onPress={
                    canRoll
                      ? handleRoll
                      : () => {
                          if (!canClaim || myRoll == null) return;
                          handleClaim(myRoll);
                        }
                  }
                  disabled={isRevealAnimating || (canRoll ? !canRoll : !canClaim || !canClaimTruthfully)}
                  style={[styles.btn, styles.menuActionButtonSuccess]}
                />
                <StyledButton
                  label="Call Bluff"
                  variant="primary"
                  onPress={hasClaim ? handleCallBluff : undefined}
                  disabled={!hasClaim || !canCallBluff || myRoll !== null || isRevealAnimating}
                  style={[
                    styles.btn,
                    styles.menuActionButton,
                    !hasClaim && { opacity: 0.4 },
                  ]}
                />
              </View>
              <View style={styles.bottomRow}>
                <StyledButton
                  label="Bluff Options"
                  variant="outline"
                  onPress={() => setClaimPickerOpen(true)}
                  disabled={!canClaim || isRevealAnimating}
                  style={[styles.btnWide, shouldHighlightBluff && styles.bluffOptionsHighlightButton]}
                />
              </View>
              <View style={styles.bottomRow}>
                <StyledButton
                  label="Leave"
                  variant="ghost"
                  onPress={handleQuitGame}
                  style={[styles.btn, styles.bottomRowButton, styles.goldOutlineButton]}
                />

                {showRematchButton ? (
                  <View style={styles.rematchWrapper}>
                    <StyledButton
                      label={
                        waitingForRematch || isRequestingRematch
                          ? 'Waiting…'
                          : 'Rematch'
                      }
                      variant="ghost"
                      onPress={handleRematchPress}
                      disabled={!myRole || hasRequestedRematch || isRequestingRematch}
                      style={[
                        styles.btn,
                        styles.bottomRowButton,
                        styles.compactActionButton,
                        !myRole || hasRequestedRematch || isRequestingRematch
                          ? styles.compactActionButtonDisabled
                          : styles.compactActionButtonActive,
                      ]}
                      textStyle={styles.rematchLabel}
                    >
                      {opponentWantsRematch && !hasRequestedRematch ? (
                        <View style={styles.rematchLinesContainer}>
                          <Text style={[styles.rematchLabel, styles.rematchLabelAccept]}>
                            Accept
                          </Text>
                          <Text style={[styles.rematchLabel, styles.rematchLabelAccept]}>
                            Rematch
                          </Text>
                        </View>
                      ) : undefined}
                    </StyledButton>
                  </View>
                ) : null}

                <StyledButton
                  label="Rules"
                  variant="ghost"
                  onPress={() => setRulesOpen(true)}
                  style={[styles.btn, styles.bottomRowButton, styles.goldOutlineButton]}
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
        onSelect={(value) => handleClaim(value)}
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
              <Text style={styles.modalTitle}>Last 10 events</Text>
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

      <Modal
        visible={selfieCameraOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSelfieCameraOpen(false)}
      >
        <SafeAreaView style={styles.cameraModal}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraTitle}>
              {pendingSelfie ? 'Selfie preview' : 'Live claim selfie'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close camera"
              onPress={() => setSelfieCameraOpen(false)}
              style={({ pressed }) => [styles.cameraCloseButton, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="close" size={28} color="#FFFFFF" />
            </Pressable>
          </View>

          {pendingSelfie ? (
            <View style={styles.selfiePreviewContainer}>
              <Image source={{ uri: pendingSelfie.uri }} style={styles.selfiePreviewImage} />
              <View style={styles.selfiePreviewActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove selfie"
                  onPress={handleRemoveSelfie}
                  style={({ pressed }) => [
                    styles.selfiePreviewAction,
                    styles.selfiePreviewActionRemove,
                    pressed && styles.selfiePreviewActionPressed,
                  ]}
                >
                  <MaterialIcons name="delete-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.selfiePreviewActionText}>Remove</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retake selfie"
                  onPress={handleRetakeSelfie}
                  style={({ pressed }) => [
                    styles.selfiePreviewAction,
                    styles.selfiePreviewActionRetake,
                    pressed && styles.selfiePreviewActionPressed,
                  ]}
                >
                  <MaterialIcons name="replay" size={22} color="#FFFFFF" />
                  <Text style={styles.selfiePreviewActionText}>Retake</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Attach selfie"
                  onPress={() => setSelfieCameraOpen(false)}
                  style={({ pressed }) => [
                    styles.selfiePreviewAction,
                    styles.selfiePreviewActionDone,
                    pressed && styles.selfiePreviewActionPressed,
                  ]}
                >
                  <MaterialIcons name="check" size={22} color="#FFFFFF" />
                  <Text style={styles.selfiePreviewActionText}>Attach</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.cameraBody}>
              <CameraView
                ref={cameraRef}
                style={styles.cameraPreview}
                facing="front"
                mode="picture"
                mirror
                onCameraReady={() => setCameraReady(true)}
                onMountError={(event) => {
                  console.error('[ONLINE GAME] camera mount failed', event);
                  setCameraPermissionDenied(true);
                  setSelfieCameraOpen(false);
                  Alert.alert('Camera unavailable', 'Selfies are disabled for this match.');
                }}
              />
              {!cameraReady ? (
                <View style={styles.cameraLoading}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
              ) : null}
              <View style={styles.cameraControls}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Take selfie"
                  disabled={!cameraReady || selfieCaptureBusy}
                  onPress={handleCaptureSelfie}
                  style={({ pressed }) => [
                    styles.shutterButton,
                    (!cameraReady || selfieCaptureBusy) && styles.shutterButtonDisabled,
                    pressed && cameraReady && !selfieCaptureBusy && styles.shutterButtonPressed,
                  ]}
                >
                  {selfieCaptureBusy ? (
                    <ActivityIndicator color="#161B22" />
                  ) : (
                    <View style={styles.shutterButtonInner} />
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={!!selfieViewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setSelfieViewerUri(null)}
      >
        <View style={styles.selfieViewer}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelfieViewerUri(null)}
          />
          {selfieViewerUri ? (
            <Image source={{ uri: selfieViewerUri }} style={styles.selfieViewerImage} />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close selfie"
            onPress={() => setSelfieViewerUri(null)}
            style={({ pressed }) => [styles.selfieViewerClose, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>

      <OnlineMatchSummaryOverlay
        visible={showMatchSummary}
        didPlayerWin={didPlayerWin}
        playerScore={myScore}
        opponentScore={opponentScore}
        opponentName={myOpponentRecordName}
        finalBlowText={finalBlowText}
        mySelfiesUsed={mySelfiesUsed}
        opponentSelfiesUsed={opponentSelfiesUsed}
        selfies={summarySelfieItems}
        selfiesLoading={!allSummarySelfiesLoaded}
        recordWins={onlineOpponentRecord?.wins ?? null}
        recordLosses={onlineOpponentRecord?.losses ?? null}
        recordGamesPlayed={onlineOpponentRecord?.gamesPlayed ?? null}
        recordLoading={onlineOpponentRecordLoading}
        rematchLabel={rematchButtonLabel}
        rematchDisabled={!myRole || hasRequestedRematch || isRequestingRematch}
        onRematch={handleRematchPress}
        onMainMenu={handleMainMenuPress}
      />

    </View>
  );
}

const BAR_BG = '#161B22';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: Platform.select({
      ios: 10,
      android: 18, // extra bottom padding on Android to help keep controls visible
      default: 10,
    }),
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 16,
    color: '#F0F6FC',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#F0F6FC',
    fontSize: 18,
    textAlign: 'center',
  },
  headerCard: {
    position: 'relative',
    backgroundColor: '#161B22',
    borderRadius: 22,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: Platform.select({
      android: 'center',
      default: 'flex-start',
    }),
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  playerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  userAvatarImage: {
    width: 35,
    height: 35,
    resizeMode: 'contain',
  },
  rivalAvatarImage: {
    width: 42,
    height: 42,
    resizeMode: 'contain',
  },
  playerLabel: {
    color: '#F0F6FC',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  titleColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  claimText: {
    color: '#FE9902',
    fontSize: Platform.select({
      ios: 18,
      web: 18,
      android: 14,
      default: 18,
    }),
    fontWeight: '800',
    alignSelf: 'center',
    textAlign: 'center',
    marginBottom: 6,
    marginTop: Platform.select({
      android: 25,
      default: 0,
    }),
  },
  status: {
    marginTop: 12,
    color: '#F0F6FC',
    fontSize: 16,
    textAlign: 'center',
  },
  scoreDie: {
    marginTop: 8,
  },
  scoreValue: {
    color: '#8B949E',
    fontSize: 13,
    marginTop: 4,
  },
  banner: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    maxWidth: '80%',
  },
  bannerText: {
    color: '#F0F6FC',
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
    backgroundColor: '#53A7F3',
    borderColor: '#1C75BC',
  },
  bannerFail: {
    backgroundColor: '#661313',
    borderColor: '#520E0E',
  },
  bannerSocial: {
    backgroundColor: '#8C6B2F',
    borderColor: '#5E471F',
  },
  selfieBanner: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieBannerText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#161B22',
  },
  historyBox: {
    alignSelf: 'center',
    width: '70%',
    minHeight: 72,
    backgroundColor: '#3C4045',
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
  opponentSelfieNotice: {
    alignSelf: 'center',
    width: '88%',
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#FE9902',
    borderRadius: 8,
    backgroundColor: '#161B22',
    padding: 10,
    marginBottom: 10,
    zIndex: 4,
  },
  opponentSelfieNoticePressed: {
    opacity: 0.82,
  },
  opponentSelfieThumbFrame: {
    width: 54,
    height: 54,
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1117',
  },
  opponentSelfieThumb: {
    width: '100%',
    height: '100%',
  },
  opponentSelfieCopy: {
    flex: 1,
    minWidth: 0,
  },
  opponentSelfieTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  opponentSelfieMeta: {
    color: '#FE9902',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  diceArea: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Platform.select({
      ios: 260,
      android: 240,
      default: 260,
    }),
    marginTop: Platform.select({
      ios: -134,
      android: 0,
      default: -134,
    }),
    marginBottom: Platform.select({
      ios: 20,
      android: 20,
      default: 20,
    }),
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
    marginTop: Platform.select({
      ios: -150,
      android: 0,
      default: -150,
    }),
    position: 'relative',
    zIndex: 10,
    marginBottom: Platform.select({
      ios: -10,
      android: 20,
      default: -10,
    }),
  },
  selfiePrompt: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C87400',
    backgroundColor: '#2B3440',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  selfiePromptReady: {
    borderColor: '#53A7F3',
    backgroundColor: '#1C3145',
  },
  selfiePromptDisabled: {
    borderColor: '#30363D',
    backgroundColor: 'rgba(255,255,255,0.05)',
    opacity: 0.65,
  },
  selfiePromptPressed: {
    opacity: 0.82,
  },
  selfiePromptIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C21807',
  },
  selfiePromptThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#0D1117',
  },
  selfiePromptCopy: {
    flex: 1,
    minWidth: 0,
  },
  selfiePromptTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  selfiePromptMeta: {
    color: '#B7C0C9',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
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
  bluffOptionsHighlightButton: {
    backgroundColor: '#FE9902',
    borderColor: '#C87400',
    borderWidth: 2,
    borderRadius: 12,
  },
  menuActionButton: {
    backgroundColor: '#C21807',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8B0000',
  },
  menuActionButtonSuccess: {
    backgroundColor: '#53A7F3',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1C75BC',
  },
  goldOutlineButton: {
    borderWidth: 2,
    borderColor: '#B26B01',
  },
  compactActionButton: {
    borderWidth: 2,
    borderRadius: 12,
  },
  compactActionButtonActive: {
    backgroundColor: '#FE9902',
    borderColor: '#C87400',
  },
  compactActionButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: '#30363D',
  },
  rematchWrapper: {
    flex: 1,
    alignItems: 'stretch',
  },
  bottomRowButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  rematchLabel: {
    fontSize: Platform.select({
      ios: 8.5,
      android: 6,
      default: 8.5,
    }),
    textAlign: 'center',
    fontWeight: '800',
  },
  rematchLabelAccept: {
    fontSize: Platform.select({
      ios: 8.5,
      android: 7.5,
      default: 8.5,
    }),
  },
  rematchLinesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#3C4045',
    borderRadius: 12,
    padding: 20,
    maxHeight: '70%',
    width: '85%',
    borderColor: '#B26B01',
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
    backgroundColor: '#3C4045',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxHeight: '75%',
    borderColor: '#B26B01',
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
  cameraModal: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  cameraHeader: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  cameraTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  cameraCloseButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBody: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cameraControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: 'center',
  },
  shutterButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  shutterButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  shutterButtonDisabled: {
    opacity: 0.55,
  },
  shutterButtonPressed: {
    transform: [{ scale: 0.94 }],
  },
  selfiePreviewContainer: {
    flex: 1,
    padding: 16,
  },
  selfiePreviewImage: {
    flex: 1,
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#000000',
  },
  selfiePreviewActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 16,
  },
  selfiePreviewAction: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  selfiePreviewActionRemove: {
    backgroundColor: '#661313',
    borderColor: '#8B0000',
  },
  selfiePreviewActionRetake: {
    backgroundColor: '#2B3440',
    borderColor: '#55606D',
  },
  selfiePreviewActionDone: {
    backgroundColor: '#0F7A43',
    borderColor: '#0FA958',
  },
  selfiePreviewActionPressed: {
    opacity: 0.8,
  },
  selfiePreviewActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  selfieViewer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  selfieViewerImage: {
    width: '100%',
    maxWidth: 520,
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#0D1117',
  },
  selfieViewerClose: {
    position: 'absolute',
    top: 44,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,17,23,0.8)',
  },
});
