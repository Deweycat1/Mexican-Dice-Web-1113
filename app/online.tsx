import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import FeltBackground from '../src/components/FeltBackground';
import StyledButton from '../src/components/StyledButton';
import { ensureUserProfile, getCurrentUser } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';

const STARTING_SCORE = 5;
const MAX_ACTIVE_GAMES = 5;
const INITIAL_ROUND_STATE = {
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

type LobbyGame = {
  id: string;
  status: 'waiting' | 'in_progress' | 'finished' | 'cancelled';
  host_id: string;
  guest_id: string | null;
  host_score: number | null;
  guest_score: number | null;
  current_player_id: string | null;
  updated_at: string;
  host?: { username: string | null };
  guest?: { username: string | null };
  round_state?: any;
};

const friendlyHint =
  'Play at your own pace: start a match with a friend and come back to it anytime.';

const makeId = () => Math.random().toString(36).slice(2, 10);

const normalizeColorAnimal = (value: string) => {
  if (!value) return '';
  return value
    .trim()
    .replace(/\s+/g, '-')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('-');
};

export default function OnlineLobbyScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [friendCode, setFriendCode] = useState('');
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [usernamesById, setUsernamesById] = useState<Record<string, string>>({});
  const [loadingGames, setLoadingGames] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
    try {
      await ensureUserProfile();
      const user = await getCurrentUser();
      if (isMounted) {
        setUserId(user?.id ?? null);
      }

      if (user?.id) {
        const { data, error } = await supabase
          .from('users')
          .select('username')
          .eq('id', user.id)
          .single();
        if (!error && isMounted) {
          setMyUsername(data?.username ?? null);
        }
      }
    } catch (err) {
      console.error('[OnlineLobby] Failed to load user', err);
      Alert.alert('Unable to load account', 'Please try again.');
    } finally {
      if (isMounted) {
        setLoadingUser(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const getActiveGameCount = useCallback(
    async (id: string) => {
      const { count, error } = await supabase
        .from('games_v2')
        .select('id', { count: 'exact', head: true })
        .in('status', ['waiting', 'in_progress'])
        .or(`host_id.eq.${id},guest_id.eq.${id}`);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    []
  );

  const loadGames = useCallback(async () => {
    if (!userId) return;
    setLoadingGames(true);
    const { data, error } = await supabase
      .from('games_v2')
      .select('*')
      .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[OnlineLobby] Failed to load matches', error);
      Alert.alert('Unable to load matches', error.message);
      setGames([]);
    } else {
      const rows = (data ?? []) as LobbyGame[];
      setGames(rows);

      console.log(
        '[OnlineLobby] Loaded games for',
        userId,
        rows.map((g: any) => ({
          id: g.id,
          status: g.status,
          host_id: g.host_id,
          guest_id: g.guest_id,
          current_player_id: g.current_player_id,
          host_score: g.host_score,
          guest_score: g.guest_score,
        }))
      );

      // Build a unique list of player IDs for these games
      const ids = Array.from(
        new Set(
          rows
            .flatMap((g) => [g.host_id, g.guest_id])
            .filter((id): id is string => !!id)
        )
      );

      if (ids.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, username')
          .in('id', ids);

        if (!usersError && usersData) {
          const map: Record<string, string> = {};
          for (const u of usersData) {
            if (u.id && u.username) {
              map[u.id] = u.username;
            }
          }
          setUsernamesById(map);
        } else if (usersError) {
          console.warn('[OnlineLobby] Failed to load usernames', usersError);
        }
      }
    }
    setLoadingGames(false);
  }, [userId]);

  useEffect(() => {
    if (userId) loadGames();
  }, [userId, loadGames]);

  useFocusEffect(
    useCallback(() => {
      loadGames();
    }, [loadGames])
  );

  const buildRoundState = useCallback((roundState: any, text: string) => {
    const base =
      roundState && typeof roundState === 'object'
        ? { ...INITIAL_ROUND_STATE, ...roundState }
        : { ...INITIAL_ROUND_STATE };
    const history = Array.isArray(base.history) ? [...base.history] : [];
    history.push({
      id: makeId(),
      type: 'event',
      text,
      timestamp: new Date().toISOString(),
    });
    base.history = history.slice(-12);
    return base;
  }, []);

  const handleCreateMatch = useCallback(async () => {
    if (!userId) {
      Alert.alert('Account missing', 'Please wait for your account to load.');
      return;
    }
    setCreateMessage(null);
    setCreatingMatch(true);
    try {
      const activeCount = await getActiveGameCount(userId);
      if (activeCount >= MAX_ACTIVE_GAMES) {
        Alert.alert(
          'Too many matches',
          'You already have 5 active matches. Finish or delete one before starting a new one.'
        );
        return;
      }

      let guestId: string | null = null;
      let friendlyName: string | null = null;
      const trimmed = friendCode.trim();
      if (trimmed) {
        const normalized = normalizeColorAnimal(trimmed);
        if (!normalized) {
          Alert.alert(
            'Invalid code',
            'Could not parse that color-animal code. Double-check and try again.'
          );
          return;
        }
        const { data: friend, error: friendError } = await supabase
          .from('users')
          .select('id, username')
          .eq('username', normalized)
          .single();
        if (friendError || !friend) {
          Alert.alert(
            'User not found',
            'Could not find a player with that color-animal code. Double-check the spelling and try again.'
          );
          return;
        }
        if (friend.id === userId) {
          Alert.alert('Invalid opponent', 'You cannot start a match against yourself.');
          return;
        }
        guestId = friend.id;
        friendlyName = friend.username ?? normalized;
      }

      const payload: Record<string, any> = {
        host_id: userId,
        guest_id: guestId,
        status: guestId ? 'in_progress' : 'waiting',
        current_player_id: userId,
        host_score: STARTING_SCORE,
        guest_score: STARTING_SCORE,
        last_roll_1: null,
        last_roll_2: null,
        last_claim: null,
        round_state: INITIAL_ROUND_STATE,
      };

      const { data, error } = await supabase.from('games_v2').insert(payload).select('id').single();
      if (error || !data) {
        throw error ?? new Error('Unable to create match');
      }

      setFriendCode('');
      setCreateMessage(
        guestId
          ? `Match started with ${friendlyName ?? 'your friend'}.`
          : 'Match created! Invite a friend to join whenever they are ready.'
      );
      await loadGames();

      if (guestId) {
        router.push(`/online/game-v2/${data.id}` as const);
      }
    } catch (err: any) {
      console.error('[OnlineLobby] Create match failed', err);
      Alert.alert('Could not start match', err?.message ?? 'Please try again.');
    } finally {
      setCreatingMatch(false);
    }
  }, [friendCode, getActiveGameCount, loadGames, router, userId]);

  const handleResign = useCallback(
    (game: LobbyGame) => {
      if (!userId) return;

      console.log('[OnlineLobby] Resign pressed', {
        gameId: game.id,
        userId,
        host_id: game.host_id,
        guest_id: game.guest_id,
        status: game.status,
        current_player_id: game.current_player_id,
      });

      Alert.alert(
        'Resign this match?',
        'Are you sure you want to resign this match? Your opponent will win this game.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Resign',
            style: 'destructive',
            onPress: async () => {
              console.log('[OnlineLobby] Resign confirmed', { gameId: game.id, userId });
              try {
                const isHost = game.host_id === userId;
                const resignText = isHost
                  ? 'Host resigned the match.'
                  : 'Guest resigned the match.';

                const nextRound = buildRoundState(game.round_state, resignText);

                const payload: Record<string, any> = {
                  status: 'finished',
                  current_player_id: null,
                  round_state: nextRound,
                };
                payload[isHost ? 'host_score' : 'guest_score'] = 0;

                const { data, error } = await supabase
                  .from('games_v2')
                  .update(payload)
                  .eq('id', game.id)
                  .select('id, status, host_score, guest_score')
                  .single();

                console.log('[OnlineLobby] Resign Supabase response', { data, error });

                if (error) {
                  console.error('[OnlineLobby] Resign Supabase error', error);
                  throw error;
                }

                console.log('[OnlineLobby] Resign success', data);
                await loadGames();
                console.log(`[OnlineLobby] Resign completed for game ${game.id}`);
              } catch (err: any) {
                console.error('[OnlineLobby] Resign failed', err);
                const errorMessage =
                  typeof err?.message === 'string'
                    ? `Unable to resign: ${err.message}`
                    : 'Please check the console for details and try again.';
                Alert.alert('Unable to resign', errorMessage);
              }
            },
          },
        ]
      );
    },
    [buildRoundState, loadGames, userId]
  );

  const handleDeleteWaiting = useCallback(
    (game: LobbyGame) => {
      Alert.alert(
        'Delete this match?',
        'Remove this waiting match? You can always create another one.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from('games_v2')
                  .update({ status: 'cancelled' })
                  .eq('id', game.id);
                if (error) throw error;
                await loadGames();
              } catch (err: any) {
                console.error('[OnlineLobby] Delete match failed', err);
                Alert.alert('Unable to delete match', err?.message ?? 'Please try again.');
              }
            },
          },
        ]
      );
    },
    [loadGames]
  );

  const sections = useMemo(() => {
    if (!userId) {
      return {
        challenges: [] as LobbyGame[],
        yourTurn: [] as LobbyGame[],
        theirTurn: [] as LobbyGame[],
        completed: [] as LobbyGame[],
      };
    }

    const challenges = games.filter((game) => {
      if (!game.guest_id || game.guest_id !== userId) return false;
      if (game.status !== 'in_progress') return false;
      if (game.current_player_id !== game.host_id) return false;
      const hostScore = game.host_score ?? STARTING_SCORE;
      const guestScore = game.guest_score ?? STARTING_SCORE;
      return hostScore === STARTING_SCORE && guestScore === STARTING_SCORE;
    });

    const yourTurn = games.filter(
      (game) =>
        (game.status === 'in_progress' && game.current_player_id === userId) ||
        (game.status === 'waiting' && game.host_id === userId && !game.guest_id)
    );

    const theirTurn = games.filter((game) => {
      const isInProgress = game.status === 'in_progress';
      const someoneToMove = !!game.current_player_id;
      const notYou = game.current_player_id !== userId;
      return isInProgress && someoneToMove && notYou;
    });

    const completed = games.filter((game) => game.status === 'finished').slice(0, 5);

    return { challenges, yourTurn, theirTurn, completed };
  }, [games, userId]);

  const renderGameCard = (game: LobbyGame) => {
    if (!userId) return null;
    const isHost = game.host_id === userId;
    const hostName = usernamesById[game.host_id];
    const guestName = game.guest_id ? usernamesById[game.guest_id] : undefined;

    const opponentName = isHost
      ? game.guest_id
        ? guestName || 'Opponent'
        : 'Waiting for opponent'
      : hostName || 'Opponent';
    const youScore = isHost ? game.host_score ?? STARTING_SCORE : game.guest_score ?? STARTING_SCORE;
    const themScore = isHost
      ? game.guest_score ?? STARTING_SCORE
      : game.host_score ?? STARTING_SCORE;

    let statusLabel = '';

    const isChallengeForYou =
      game.guest_id === userId &&
      game.status === 'in_progress' &&
      game.current_player_id === game.host_id &&
      (game.host_score ?? STARTING_SCORE) === STARTING_SCORE &&
      (game.guest_score ?? STARTING_SCORE) === STARTING_SCORE;

    if (game.status === 'finished') {
      statusLabel = 'Game over';
    } else if (isChallengeForYou) {
      statusLabel = 'New challenge';
    } else if (game.status === 'waiting' && !game.guest_id) {
      statusLabel = 'Waiting for opponent';
    } else if (game.current_player_id === userId) {
      statusLabel = 'Your turn';
    } else if (game.current_player_id) {
      statusLabel = 'Waiting on friend';
    } else {
      statusLabel = 'Paused';
    }

    const canResign =
      game.status === 'in_progress' &&
      !!game.guest_id &&
      (game.host_id === userId || game.guest_id === userId);
    const canDelete =
      game.status === 'waiting' && !game.guest_id && game.host_id === userId;

    return (
      <View key={game.id} style={styles.gameCard}>
        <View style={styles.gameCardHeader}>
          <Text style={styles.gameOpponent}>{opponentName}</Text>
          <Text style={styles.gameStatus}>{statusLabel}</Text>
        </View>
        <Text style={styles.gameScore}>{`Your Score: ${youScore} • Their Score: ${themScore}`}</Text>
        <View style={styles.cardActions}>
          <StyledButton
            label="Open Match"
            variant="outline"
            onPress={() => router.push(`/online/game-v2/${game.id}` as const)}
            style={styles.openMatchButton}
          />
          <View style={styles.cardLinks}>
            {canResign && (
              <TouchableOpacity
                onPress={() => {
                  console.log(`[OnlineLobby] Resign tapped for game ${game.id}`);
                  handleResign(game);
                }}
              >
                <Text style={styles.secondaryAction}>Resign</Text>
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity onPress={() => handleDeleteWaiting(game)}>
                <Text style={styles.secondaryAction}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderSection = (title: string, data: LobbyGame[], emptyText: string) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {data.length === 0 ? (
        <Text style={styles.emptyTextSmall}>{emptyText}</Text>
      ) : (
        data.map(renderGameCard)
      )}
    </View>
  );

  if (loadingUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E0B50C" />
        <Text style={styles.loadingText}>Loading online play…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FeltBackground>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{friendlyHint}</Text>
          </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Start a new match</Text>
        <Text style={styles.cardSubtitle}>
          Invite a friend using their color-animal code (for example: "Blue Llama").
        </Text>
        {myUsername && (
          <Text style={styles.yourCode}>
            Your Username:{' '}
            <Text style={styles.yourCodeValue}>{myUsername}</Text>
          </Text>
        )}
        <TextInput
          style={styles.input}
          placeholder="Friend’s color-animal code (optional)"
              placeholderTextColor="#9FBBA6"
              value={friendCode}
              onChangeText={setFriendCode}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <StyledButton
              label={creatingMatch ? 'Starting…' : 'Start Match'}
              onPress={handleCreateMatch}
              disabled={creatingMatch || !userId}
              style={styles.primaryButton}
            />
            {createMessage && <Text style={styles.shareHint}>{createMessage}</Text>}
          </View>

          {loadingGames ? (
            <View style={styles.loadingMatches}>
              <ActivityIndicator size="small" color="#E0B50C" />
              <Text style={styles.loadingText}>Loading matches…</Text>
            </View>
          ) : (
            <>
              {renderSection('Challenges', sections.challenges, 'No new challenges yet.')}
              {renderSection('Your Turn', sections.yourTurn, 'No games where it’s your turn yet.')}
              {renderSection('Their Turn', sections.theirTurn, 'No games waiting on your friends.')}
              {renderSection('Completed games', sections.completed, 'No completed games yet.')}
            </>
          )}
        </ScrollView>
      </FeltBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B3A26',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B3A26',
  },
  loadingText: {
    marginTop: 12,
    color: '#fff',
    fontSize: 16,
  },
  banner: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bannerText: {
    color: '#E6FFE6',
    textAlign: 'center',
    fontSize: 13,
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: {
    color: '#E0B50C',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#C9F0D6',
    fontSize: 13,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#2F6B4A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    marginBottom: 12,
  },
  primaryButton: {
    marginBottom: 6,
  },
  shareHint: {
    color: '#C9F0D6',
    fontSize: 13,
    marginTop: 6,
  },
  yourCode: {
    color: '#C9F0D6',
    fontSize: 13,
    marginBottom: 8,
  },
  yourCodeValue: {
    color: '#E0B50C',
    fontWeight: '800',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#E0B50C',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 10,
  },
  emptyTextSmall: {
    color: '#C9F0D6',
    textAlign: 'center',
    fontSize: 13,
  },
  gameCard: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  gameCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  gameOpponent: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  gameStatus: {
    color: '#9FBBA6',
    fontSize: 13,
  },
  gameScore: {
    color: '#E6FFE6',
    marginBottom: 10,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  openMatchButton: {
    flex: 1,
    marginRight: 12,
  },
  cardLinks: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryAction: {
    color: '#F4C430',
    fontWeight: '700',
  },
  loadingMatches: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
});
