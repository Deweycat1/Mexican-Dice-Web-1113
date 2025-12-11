import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BluffModal from '@/src/components/BluffModal';
import Dice from '@/src/components/Dice';
import FeltBackground from '@/src/components/FeltBackground';
import OnlineGameOverModal from '@/src/components/OnlineGameOverModal';
import { ScoreDie } from '@/src/components/ScoreDie';
import StyledButton from '@/src/components/StyledButton';
import { BASE_DIE_SIZE, DICE_SPACING_BASE } from '@/src/theme/dice';

import { applyClaim, CoreGameState } from '@/src/engine/coreGame';
import { rollDice } from '@/src/engine/onlineRoll';
import { buildClaimOptions } from '@/src/lib/claimOptions';
import {
  checkRateLimit,
  clearHiddenRolls,
  getMyCurrentRoll,
  resolveBluffSecure,
  saveHiddenRoll,
} from '@/src/legacy-multiplayer/hiddenRolls';
import { supabase } from '@/src/lib/supabase';

// ---------- types ----------
type OnlineGame = {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  current_player: 'player1' | 'player2';
  current_roll: string | null;
  current_claim: string | null;
  baseline_claim: string | null;
  last_action: string | null;
  status: string;
  winner: 'player1' | 'player2' | null;
  created_at: string;
  updated_at: string;
};

// ---------- helpers ----------
function splitClaim(value: number): [number, number] {
  const hi = Math.floor(value / 10);
  const lo = value % 10;
  return [hi, lo];
}
function formatClaim(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (value === 21) return '21 (Mexican)';
  if (value === 31) return '31 (Reverse)';
  if (value === 41) return '41 (Social)';
  const hi = Math.floor(value / 10);
  const lo = value % 10;
  return `${hi}${lo}`;
}

function formatRoll(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const [hi, lo] = splitClaim(value);
  return `${hi}${lo}`;
}

function facesFromRoll(value: number | null | undefined): readonly [number | null, number | null] {
  if (typeof value !== 'number' || Number.isNaN(value)) return [null, null] as const;
  const [hi, lo] = splitClaim(value);
  return [hi, lo] as const;
}

export default function OnlineMatchScreen() {
  const router = useRouter();
  const { gameId, matchId } = useLocalSearchParams<{
    gameId?: string | string[];
    matchId?: string | string[];
  }>();

  // normalize id across possible params + array shapes
  const rawId = (gameId ?? matchId) as string | string[] | undefined;
  const normalizedId = Array.isArray(rawId) ? rawId[0] : rawId;

  // ----- STATE -----
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myRoll, setMyRoll] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [claimPickerOpen, setClaimPickerOpen] = useState(false);
  const [gameOverModalVisible, setGameOverModalVisible] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // ----- HISTORY (derived) -----
  const wovenHistory = useMemo(() => {
    const anyGame = game as any;
    if (!anyGame || !anyGame.history) return [];
    return anyGame.history as any[];
  }, [game]);

  // Animated fade for history box
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.15, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [wovenHistory, fadeAnim]);

  // Derive info
  const anyGame = game as any;
  const isPlayer1 = myUserId === game?.player1_id;
  const myScore = game ? (isPlayer1 ? game.player1_score : game.player2_score) : 0;
  const friendName = game
    ? isPlayer1
      ? anyGame.player2_username || 'Friend'
      : anyGame.player1_username
    : 'Friend';
  const friendScore = game ? (isPlayer1 ? game.player2_score : game.player1_score) : 0;

  const isMyTurn =
    !!myUserId &&
    !!game &&
    ((isPlayer1 && game.current_player === 'player1') ||
      (!isPlayer1 && game.current_player === 'player2'));

  const claimOptions = useMemo(
    () => buildClaimOptions(anyGame?.current_claim, myRoll),
    [anyGame?.current_claim, myRoll]
  );

  const [dieHi, dieLo] = facesFromRoll(myRoll);

  const diceDisplayMode = useMemo(() => {
    if (!isMyTurn) return 'values';
    return myRoll === null ? 'prompt' : 'values';
  }, [isMyTurn, myRoll]);

  const hasRolled = isMyTurn && myRoll !== null;
  const controlsDisabled = anyGame?.status !== 'active' || !isMyTurn || isRolling;

  const statusLine = (() => {
    if (!game) return 'Ready';
    if (anyGame.status === 'waiting') {
      return 'Waiting for players...';
    }
    if (anyGame.status === 'active') {
      return isMyTurn ? 'Your turn' : `${friendName}'s turn`;
    }
    if (anyGame.status === 'finished') {
      return 'Match finished';
    }
    return 'Ready';
  })();

  const claimText = useMemo(() => {
    return `Claim: ${formatClaim(anyGame?.current_claim)} | Your roll: ${formatRoll(myRoll)}`;
  }, [anyGame?.current_claim, myRoll]);

  const renderHistoryLine = (item: any) => {
    if (!item) return '—';
    if (typeof item === 'string') return item;
    if (item.type === 'event' && item.text) return item.text;
    if (item.claim) {
      const who = item.who === 'player1'
        ? (isPlayer1 ? 'You' : friendName)
        : (isPlayer1 ? friendName : 'You');
      return `${who} claimed ${formatClaim(item.claim)}`;
    }
    return JSON.stringify(item);
  };

  // Helper: Map database game to CoreGameState
  const mapGameToCoreState = (game: OnlineGame): CoreGameState => ({
    player1Score: game.player1_score,
    player2Score: game.player2_score,
    currentPlayer: game.current_player,
    currentRoll: game.current_roll,
    currentClaim: game.current_claim,
    baselineClaim: game.baseline_claim,
    lastAction: (game.last_action as 'normal' | 'reverseVsMexican') || 'normal',
    status: game.status === 'finished' ? 'finished' : 'active',
    winner: game.winner,
  });

  // Helper: Map CoreGameState back to database update object
  const mapCoreStateToGameUpdate = (core: CoreGameState) => ({
    player1_score: core.player1Score,
    player2_score: core.player2Score,
    current_player: core.currentPlayer,
    current_roll: core.currentRoll,
    current_claim: core.currentClaim,
    baseline_claim: core.baselineClaim,
    last_action: core.lastAction,
    status: core.status,
    winner: core.winner,
    last_action_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // =========================================================================
  // LIFECYCLE: Load user, game, realtime, mark joined, activate game
  // =========================================================================

  useEffect(() => {
    if (!normalizedId) {
      setError('No match id provided');
      setLoading(false);
    }
  }, [normalizedId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id ?? null;
      setMyUserId(userId);
    })();
  }, []);

  useEffect(() => {
    if (!normalizedId) return;

    let channel: any = null;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data, error: gameErr } = await supabase
          .from('games')
          .select('*')
          .eq('id', normalizedId)
          .single();

        if (gameErr || !data) {
          setError('Match not found');
          setLoading(false);
          return;
        }

        setGame(data as OnlineGame);
        setLoading(false);
        console.log('🎮 [INIT] Game loaded:', {
          gameId: data.id,
          current_player: data.current_player,
          current_claim: data.current_claim,
        });

        channel = supabase
          .channel(`game-${normalizedId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'games',
              filter: `id=eq.${normalizedId}`,
            },
            (payload) => {
              console.log('📡 [REALTIME] Raw payload received:', payload);
              if (!payload.new) {
                console.log('📡 [REALTIME] No new data in payload');
                return;
              }

              const newGame = payload.new as OnlineGame;
              console.log('📡 [REALTIME] Game update received:', {
                event: payload.eventType,
                gameId: newGame.id,
                current_player: newGame.current_player,
                current_claim: newGame.current_claim,
              });

              setGame(newGame);
            }
          )
          .subscribe((status) => {
            console.log('📡 [REALTIME] Subscription status:', status);
            if (status === 'SUBSCRIBED') {
              console.log('📡 [REALTIME] Successfully subscribed to game:', normalizedId);
            }
          });
      } catch (err) {
        console.error('Failed to load game:', err);
        setError('Failed to connect to match');
        setLoading(false);
      }
    })();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [normalizedId]);

  useEffect(() => {
    if (!game || !myUserId) return;

    const isP1 = myUserId === game.player1_id;
    const field = isP1 ? 'player1_joined' : 'player2_joined';
    const alreadyJoined = isP1 ? (game as any).player1_joined : (game as any).player2_joined;

    if (alreadyJoined) return;

    (async () => {
      await supabase
        .from('games')
        .update({ [field]: true })
        .eq('id', game.id);
    })();
  }, [game?.id, myUserId]);

  useEffect(() => {
    if (!game || !myUserId) return;
    if ((game as any).status !== 'waiting') return;

    const joined1 = (game as any).player1_joined;
    const joined2 = (game as any).player2_joined;

    if (joined1 && joined2) {
      (async () => {
        await supabase
          .from('games')
          .update({
            status: 'active',
            current_player: 'player1',
          })
          .eq('id', game.id);
      })();
    }
  }, [game, myUserId]);

  useEffect(() => {
    if (anyGame?.status === 'finished' && !gameOverModalVisible) {
      setTimeout(() => setGameOverModalVisible(true), 800);
    }
  }, [anyGame?.status, gameOverModalVisible]);

  // Debug: Log whenever game state changes
  useEffect(() => {
    console.log('🎮 [GAME-STATE] Game state changed:', {
      hasGame: !!game,
      gameId: game?.id,
      current_player: game?.current_player,
      current_claim: game?.current_claim,
    });
  }, [game]);

  // Restore or clear myRoll based on turn changes
  // CRITICAL: This effect must run whenever game.current_player changes
  // to restore the local player's hidden roll from the DB when it becomes their turn
  useEffect(() => {
    console.log('🔄 [TURN-EFFECT] Running turn restoration effect:', {
      hasGame: !!game,
      hasUserId: !!myUserId,
      normalizedId,
      gameId: game?.id,
      current_player: game?.current_player,
      myUserId,
    });

    // Early exit if missing required values
    if (!game || !myUserId || !normalizedId) {
      console.log('⚠️ [TURN-EFFECT] Missing requirements, skipping');
      return;
    }

    // Determine if it's my turn by comparing myUserId to player IDs
    const isPlayer1 = myUserId === game.player1_id;
    const isMyTurnNow =
      (isPlayer1 && game.current_player === 'player1') ||
      (!isPlayer1 && game.current_player === 'player2');

    console.log('🎯 [TURN-EFFECT] Turn status:', {
      isPlayer1,
      current_player: game.current_player,
      isMyTurnNow,
      myRoll_before: myRoll,
    });

    if (!isMyTurnNow) {
      // Not my turn → clear local roll so opponent doesn't see my dice
      console.log('🚫 [TURN-EFFECT] Not my turn, clearing myRoll');
      setMyRoll(null);
      return;
    }

    // It IS my turn now → restore my hidden roll from Supabase
    // This allows me to see my own roll even after the opponent claimed
    console.log('[TURN EFFECT] My turn now for game', normalizedId, 'user', myUserId);
    (async () => {
      try {
        // getMyCurrentRoll uses RLS to only fetch MY rolls (roller_id = auth.uid())
        // Using normalizedId to ensure we're querying the same gameId that saveHiddenRoll used
        const roll = await getMyCurrentRoll(normalizedId);
        console.log('[TURN EFFECT] getMyCurrentRoll returned', roll);

        if (roll !== null) {
          console.log('✅ [TURN-EFFECT] Restoring roll:', roll);
          setMyRoll(roll);
        } else {
          // No existing roll for this turn → user needs to roll
          console.log('➡️ [TURN-EFFECT] No existing roll, setting to null');
          setMyRoll(null);
        }
      } catch (err) {
        console.error('❌ [TURN-EFFECT] Failed to restore hidden roll:', err);
        setMyRoll(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.current_player, myUserId, normalizedId]);

  // =========================================================================
  // ACTIONS
  // =========================================================================

  async function handleRoll() {
    console.log('🎲 [ROLL] Starting roll:', {
      controlsDisabled,
      hasRolled,
      normalizedId,
      myUserId,
      currentMyRoll: myRoll,
    });

    if (controlsDisabled || hasRolled) {
      console.log('⚠️ [ROLL] Roll blocked:', { controlsDisabled, hasRolled });
      return;
    }

    const canRoll = await checkRateLimit(normalizedId || '', 500);
    if (!canRoll) {
      console.log('⚠️ [ROLL] Rate limit hit');
      Alert.alert('Slow down', 'Please wait before rolling again.');
      return;
    }

    setIsRolling(true);
    const { normalized } = rollDice();
    console.log('🎲 [ROLL] Generated roll:', normalized);
    setMyRoll(normalized);

    // CRITICAL: saveHiddenRoll uses normalizedId (same ID that getMyCurrentRoll will query)
    // This writes to game_rolls_hidden with game_id=normalizedId, roller_id=current user
    console.log('💾 [ROLL] Saving to DB:', { normalizedId, normalized });
    await saveHiddenRoll(normalizedId || '', normalized);
    console.log('✅ [ROLL] Saved to game_rolls_hidden');

    setTimeout(() => setIsRolling(false), 400);
  }

  async function handleClaim(claim: number) {
    console.log('📢 [CLAIM] Starting claim:', {
      claim,
      myRoll,
      gameId: game?.id,
      current_player: game?.current_player,
      myUserId,
    });

    if (controlsDisabled || !game || !myUserId) {
      console.log('⚠️ [CLAIM] Claim blocked:', { controlsDisabled, hasGame: !!game, hasUserId: !!myUserId });
      return;
    }

    const isP1 = myUserId === game.player1_id;
    const nextPlayer = isP1 ? 'player2' : 'player1';

    const coreState = mapGameToCoreState(game);
    const claimResult = applyClaim(coreState, claim, myRoll || 0);

    if (!claimResult.success || !claimResult.newState) {
      console.log('❌ [CLAIM] applyClaim failed:', claimResult.error);
      Alert.alert('Error', claimResult.error || 'Invalid claim');
      return;
    }

    const updates: any = {
      ...mapCoreStateToGameUpdate(claimResult.newState),
      current_player: nextPlayer,
      current_claim: claim,
      history: [
        ...(anyGame.history || []),
        {
          type: 'claim',
          who: isP1 ? 'player1' : 'player2',
          claim,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    if (claimResult.newState.status === 'finished') {
      updates.winner = claimResult.newState.winner || null;
    }

    console.log('💾 [CLAIM] Updating games table:', {
      gameId: game.id,
      current_player_before: game.current_player,
      current_player_after: nextPlayer,
      claim,
    });

    await supabase.from('games').update(updates).eq('id', game.id);
    console.log('✅ [CLAIM] Database updated. NOT clearing myRoll (let useEffect handle it)');

    // CRITICAL: Do NOT call clearHiddenRolls here - rolls must persist across claims
    // Hidden rolls are only cleared after bluff resolution (see handleCallBluff)
    // Do NOT clear myRoll here either - the turn-change useEffect will handle it
    // when game.current_player changes via Realtime
    setClaimPickerOpen(false);
  }

  async function handleCallBluff() {
    console.log('🚨 [BLUFF] Starting bluff call:', {
      normalizedId,
      current_claim: anyGame?.current_claim,
      myUserId,
    });

    if (controlsDisabled || !game || !myUserId) {
      console.log('⚠️ [BLUFF] Bluff call blocked');
      return;
    }

    let result;
    try {
      console.log('🔍 [BLUFF] Calling resolveBluffSecure...');
      result = await resolveBluffSecure(normalizedId || '', anyGame?.current_claim || 0);
      console.log('✅ [BLUFF] resolveBluffSecure returned:', result);
    } catch (err) {
      console.error('❌ [BLUFF] resolveBluffSecure error:', err);
      Alert.alert('Error', 'Could not resolve bluff');
      return;
    }

    if (!result) {
      console.log('❌ [BLUFF] No result from resolveBluffSecure');
      Alert.alert('Error', 'Could not resolve bluff');
      return;
    }

    const isP1 = myUserId === game.player1_id;
    const penalty = result.penalty || 1;

    let p1Score = game.player1_score;
    let p2Score = game.player2_score;

    // outcome: +1 if defender (claimer) lied, -1 if defender told truth
    // If outcome is -1, the caller (me) was wrong
    const callerWrong = result.outcome === -1;

    if (callerWrong) {
      // I (the caller) was wrong, so I lose points
      if (isP1) p1Score = Math.max(0, p1Score - penalty);
      else p2Score = Math.max(0, p2Score - penalty);
    } else {
      // Opponent (claimer) was bluffing, so they lose points
      if (isP1) p2Score = Math.max(0, p2Score - penalty);
      else p1Score = Math.max(0, p1Score - penalty);
    }

    const finished = p1Score === 0 || p2Score === 0;
    const updates: any = {
      player1_score: p1Score,
      player2_score: p2Score,
      current_player: isP1 ? 'player1' : 'player2',
      current_claim: null,
      status: finished ? 'finished' : 'active',
      history: [
        ...(anyGame.history || []),
        {
          type: 'event',
          text: callerWrong ? 'You were wrong!' : `${friendName} was bluffing!`,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    if (finished) {
      updates.winner = p1Score === 0 ? 'player2' : 'player1';
    }

    console.log('💾 [BLUFF] Updating games table after bluff resolution');
    await supabase.from('games').update(updates).eq('id', game.id);

    console.log('🧹 [BLUFF] Clearing hidden rolls from DB');
    await clearHiddenRolls(normalizedId || '');

    console.log('🧹 [BLUFF] Clearing myRoll state');
    setMyRoll(null);
    console.log('✅ [BLUFF] Bluff resolution complete');
  }

  async function handleLeaveMatch() {
    try {
      if (!game) return;

      const confirmed = window.confirm('Are you sure you want to leave this match?');
      if (!confirmed) return;

      await supabase
        .from('games')
        .update({ status: 'finished' })
        .eq('id', game.id);

      router.replace('/');
    } catch (err) {
      console.error('Unexpected error leaving match:', err);
      Alert.alert('Error', 'An error occurred while leaving the match');
    }
  }

  // =========================================================================
  // EARLY RETURNS
  // =========================================================================

  if (loading) {
    return (
      <View style={styles.root}>
        <FeltBackground>
          <SafeAreaView style={styles.safe}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FE9902" />
              <Text style={styles.loadingText}>Connecting to your match...</Text>
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
            <View style={styles.loadingContainer}>
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

  if (!game) {
    return (
      <View style={styles.root}>
        <FeltBackground>
          <SafeAreaView style={styles.safe}>
            <View style={styles.loadingContainer}>
              <Text style={styles.errorText}>Match not found</Text>
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

  // =========================================================================
  // MAIN UI (Copied from game.tsx structure)
  // =========================================================================

  // Render-time diagnostic log
  console.log('[RENDER] gameId:', normalizedId, 'current_player:', game.current_player, 'myUserId:', myUserId, 'myRoll:', myRoll);

  return (
    <View style={styles.root}>
      <FeltBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.content}>
            {/* HEADER */}
            <View style={styles.headerCard}>
              <View style={styles.headerRow}>
                {/* Player Column */}
                <View style={styles.playerColumn}>
                  <View style={styles.avatarCircle}>
                    <Image
                      source={require('../../assets/images/User.png')}
                      style={styles.userAvatarImage}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.playerScoreLabel}>
                    You: {myScore}
                  </Text>
                  <ScoreDie points={myScore} style={styles.scoreDie} />
                </View>

                {/* Title Column */}
                <View style={styles.titleColumn}>
                  <Text style={styles.subtle}>{claimText}</Text>
                </View>

                {/* Friend Column */}
                <View style={styles.playerColumn}>
                  <View style={styles.avatarCircle}>
                    <Image
                      source={require('../../assets/images/Rival.png')}
                      style={styles.rivalAvatarImage}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.playerScoreLabel}>
                    {friendName}: {friendScore}
                  </Text>
                  <ScoreDie points={friendScore} style={styles.scoreDie} />
                </View>
              </View>

              {/* Status text */}
              <Text style={styles.status} numberOfLines={2}>
                {statusLine}
              </Text>
              <Text style={styles.subtleSmall}>
                {isMyTurn
                  ? 'Roll, then claim or bluff wisely.'
                  : 'Waiting on your friend...'}
              </Text>
            </View>

            {/* HISTORY BOX */}
            <Pressable
              onPress={() => setHistoryModalOpen(true)}
              hitSlop={10}
              style={({ pressed }) => [
                styles.historyBox,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Animated.View style={{ opacity: fadeAnim }}>
                {wovenHistory.length ? (
                  wovenHistory
                    .slice(-2)
                    .reverse()
                    .map((item, idx) => (
                      <Text key={idx} style={styles.historyText} numberOfLines={1}>
                        {renderHistoryLine(item)}
                      </Text>
                    ))
                ) : (
                  <Text style={styles.historyText}>No recent events.</Text>
                )}
              </Animated.View>
            </Pressable>

            {/* DICE BLOCK */}
            <View style={styles.diceArea}>
              <View style={styles.diceRow}>
                <Dice
                  value={dieHi}
                  rolling={isRolling}
                  displayMode={diceDisplayMode}
                  overlayText={diceDisplayMode === 'prompt' ? 'Your' : undefined}
                  size={BASE_DIE_SIZE}
                />
                <View style={{ width: DICE_SPACING_BASE }} />
                <Dice
                  value={dieLo}
                  rolling={isRolling}
                  displayMode={diceDisplayMode}
                  overlayText={diceDisplayMode === 'prompt' ? 'Roll' : undefined}
                  size={BASE_DIE_SIZE}
                />
              </View>
            </View>

            {/* ACTION BAR */}
            <View style={styles.controls}>
              <View style={styles.actionRow}>
                <StyledButton
                  label={hasRolled ? 'Claim Roll' : 'Roll'}
                  variant="success"
                  onPress={() => {
                    if (hasRolled && myRoll !== null) handleClaim(myRoll);
                    else handleRoll();
                  }}
                  style={styles.btn}
                  disabled={controlsDisabled}
                />
                <StyledButton
                  label="Call Bluff"
                  variant="primary"
                  onPress={handleCallBluff}
                  style={styles.btn}
                  disabled={controlsDisabled || hasRolled || !anyGame.current_claim}
                />
              </View>

              <View style={styles.bottomRow}>
                <StyledButton
                  label="Bluff Options"
                  variant="outline"
                  onPress={() => setClaimPickerOpen(true)}
                  style={styles.btnWide}
                  disabled={controlsDisabled || !hasRolled}
                />
              </View>

              <View style={styles.bottomRow}>
                <StyledButton
                  label="Leave Match"
                  variant="ghost"
                  onPress={handleLeaveMatch}
                  style={[styles.btn, styles.ghostBtn]}
                />
                <StyledButton
                  label="Menu"
                  variant="ghost"
                  onPress={() => router.replace('/')}
                  style={[styles.btn, styles.ghostBtn]}
                />
              </View>
            </View>
          </View>

          {/* CLAIM PICKER */}
          <BluffModal
            visible={claimPickerOpen}
            options={claimOptions}
            onCancel={() => setClaimPickerOpen(false)}
            onSelect={handleClaim}
          />

          {/* EXPANDABLE HISTORY MODAL */}
          <Modal
            visible={historyModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setHistoryModalOpen(false)}
          >
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setHistoryModalOpen(false)}
            />
            <View style={styles.modalCenter}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Last 10 events</Text>
                  <Pressable
                    onPress={() => setHistoryModalOpen(false)}
                    style={({ pressed }) => [
                      styles.closeButton,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </Pressable>
                </View>
                <View style={styles.modalHistoryList}>
                  {wovenHistory.length ? (
                    [...wovenHistory].reverse().map((item, idx) => (
                      <View key={idx} style={styles.historyItem}>
                        <Text style={styles.historyItemText}>{renderHistoryLine(item)}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noHistoryText}>No history yet.</Text>
                  )}
                </View>
              </View>
            </View>
          </Modal>

          <OnlineGameOverModal
            visible={gameOverModalVisible}
            didIWin={(game as any).winner === (isPlayer1 ? 'player1' : 'player2')}
            myScore={myScore}
            opponentScore={friendScore}
            opponentName={friendName || 'Friend'}
            onClose={() => setGameOverModalVisible(false)}
          />
        </SafeAreaView>
      </FeltBackground>
    </View>
  );
}

const BAR_BG = '#115E38';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B3A26' },
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 12,
  },
  headerCard: {
    backgroundColor: '#115E38',
    borderRadius: 14,
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
    justifyContent: 'center',
    minWidth: 70,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#B26B01',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  userAvatarImage: {
    width: 50.2,
    height: 50.2,
    resizeMode: 'contain',
  },
  rivalAvatarImage: {
    width: 56,
    height: 56,
  },
  playerScoreLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  scoreDie: {
    marginTop: 6,
  },
  titleColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginTop: 75,
  },
  subtle: {
    color: '#FE9902',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtleSmall: {
    color: '#C9F0D6',
    opacity: 0.8,
    textAlign: 'center',
    fontSize: 13,
  },
  status: {
    color: '#fff',
    opacity: 0.95,
    textAlign: 'center',
  },
  diceArea: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: BASE_DIE_SIZE * 2.6,
    marginTop: -BASE_DIE_SIZE * 1.34,
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
    marginTop: -BASE_DIE_SIZE * 1.5,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  btn: { flex: 1 },
  ghostBtn: {
    borderWidth: 2,
    borderColor: '#063a25',
  },
  btnWide: { flex: 1 },
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
  },
  historyText: {
    color: '#E6FFE6',
    textAlign: 'center',
    fontSize: 13,
    marginVertical: 2,
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
});
