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
  status: string;
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

export default function OnlineLobbyScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [friendUsername, setFriendUsername] = useState('');
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await ensureUserProfile();
        const user = await getCurrentUser();
        if (isMounted) {
          setUserId(user?.id ?? null);
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

  const getActiveGameCount = useCallback(async (id: string) => {
    const { count, error } = await supabase
      .from('games_v2')
      .select('id', { count: 'exact', head: true })
      .in('status', ['waiting', 'in_progress'])
      .or(`host_id.eq.${id},guest_id.eq.${id}`);
    if (error) {
      throw new Error(error.message);
    }
    return count ?? 0;
  }, []);

  const loadGames = useCallback(async () => {
    if (!userId) return;
    setLoadingGames(true);
    const { data, error } = await supabase
      .from('games_v2')
      .select(
        `
        *,
        host:host_id (username),
        guest:guest_id (username)
      `
      )
      .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[OnlineLobby] Failed to load matches', error);
      Alert.alert('Unable to load matches', error.message);
      setGames([]);
    } else {
      setGames((data ?? []) as LobbyGame[]);
    }
    setLoadingGames(false);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadGames();
    }
  }, [userId, loadGames]);

  useFocusEffect(
    useCallback(() => {
      loadGames();
    }, [loadGames])
  );

  const handleCreateMatch = useCallback(async () => {
    if (!userId) return;
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
      let friendlyName = '';
      if (friendUsername.trim()) {
        const { data: friend, error: friendError } = await supabase
          .from('users')
          .select('id, username')
          .eq('username', friendUsername.trim())
          .single();
        if (friendError || !friend) {
          Alert.alert('User not found', 'We could not find that username.');
          return;
        }
        if (friend.id === userId) {
          Alert.alert('Invalid opponent', 'You cannot start a match against yourself.');
          return;
        }
        guestId = friend.id;
        friendlyName = friend.username ?? friendUsername.trim();
      }

      const { data, error } = await supabase
        .from('games_v2')
        .insert({
          host_id: userId,
          guest_id: guestId,
          status: guestId ? 'in_progress' : 'waiting',
          current_player_id: userId,
          host_score: STARTING_SCORE,
          guest_score: STARTING_SCORE,
          round_state: INITIAL_ROUND_STATE,
        })
        .select('id')
        .single();

      if (error || !data) {
        throw error ?? new Error('Unable to create match');
      }

      if (guestId) {
        setCreateMessage(`Match started with ${friendlyName}.`);
      } else {
        setCreateMessage(`Match created! Share this code with a friend: ${data.id}`);
      }
      setFriendUsername('');
      await loadGames();
    } catch (err: any) {
      console.error('[OnlineLobby] Create match failed', err);
      Alert.alert('Could not start match', err?.message ?? 'Please try again.');
    } finally {
      setCreatingMatch(false);
    }
  }, [friendUsername, getActiveGameCount, loadGames, userId]);

  const handleJoinByCode = useCallback(async () => {
    if (!userId) return;
    if (!joinCode.trim()) {
      Alert.alert('Enter a code', 'Please enter the match code shared by your friend.');
      return;
    }
    setJoining(true);
    try {
      const { data: game, error } = await supabase
        .from('games_v2')
        .select('*')
        .eq('id', joinCode.trim())
        .single();
      if (error || !game) {
        throw new Error('Match not found. Double-check the code and try again.');
      }
      if (game.host_id === userId) {
        Alert.alert('Already your match', 'You created this match.');
        return;
      }
      if (game.guest_id && game.guest_id !== userId) {
        Alert.alert('Match full', 'Two players are already in this match.');
        return;
      }
      if (game.status !== 'waiting') {
        Alert.alert('Match already started', 'This match is no longer open for joining.');
        return;
      }

      const activeCount = await getActiveGameCount(userId);
      if (activeCount >= MAX_ACTIVE_GAMES) {
        Alert.alert(
          'Too many matches',
          'You already have 5 active matches. Finish or delete one before joining another.'
        );
        return;
      }

      const { error: updateError } = await supabase
        .from('games_v2')
        .update({
          guest_id: userId,
          status: 'in_progress',
          current_player_id: game.current_player_id ?? game.host_id ?? userId,
          guest_score: game.guest_score ?? STARTING_SCORE,
        })
        .eq('id', game.id)
        .is('guest_id', null);

      if (updateError) {
        throw updateError;
      }

      setJoinCode('');
      await loadGames();
      Alert.alert('Match joined', 'Good luck!');
    } catch (err: any) {
      console.error('[OnlineLobby] Join match failed', err);
      Alert.alert('Could not join match', err?.message ?? 'Please try again.');
    } finally {
      setJoining(false);
    }
  }, [getActiveGameCount, joinCode, loadGames, userId]);

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

  const handleResign = useCallback(
    (game: LobbyGame) => {
      if (!userId) return;
      Alert.alert(
        'Resign this match?',
        'Are you sure you want to resign this match? Your opponent will win this game.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Resign',
            style: 'destructive',
            onPress: async () => {
              try {
                const isHost = game.host_id === userId;
                const resignText = isHost ? 'Host resigned.' : 'Guest resigned.';
                const payload: Record<string, any> = {
                  status: 'finished',
                  current_player_id: null,
                  round_state: buildRoundState(game.round_state, resignText),
                };
                payload[isHost ? 'host_score' : 'guest_score'] = 0;
                const { error } = await supabase.from('games_v2').update(payload).eq('id', game.id);
                if (error) throw error;
                await loadGames();
              } catch (err: any) {
                console.error('[OnlineLobby] Resign failed', err);
                Alert.alert('Unable to resign', err?.message ?? 'Please try again.');
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
                console.error('[OnlineLobby] Delete waiting match failed', err);
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
      return { yourTurn: [], theirTurn: [], completed: [] };
    }
    const activeStatuses = ['waiting', 'in_progress'];
    const isUserInGame = (game: LobbyGame) =>
      game.host_id === userId || game.guest_id === userId;
    const yourTurn = games.filter(
      (game) =>
        activeStatuses.includes(game.status) &&
        isUserInGame(game) &&
        game.current_player_id === userId
    );
    const theirTurn = games.filter(
      (game) =>
        activeStatuses.includes(game.status) &&
        isUserInGame(game) &&
        game.current_player_id &&
        game.current_player_id !== userId
    );
    const completed = games
      .filter(
        (game) =>
          ['finished', 'cancelled'].includes(game.status) && isUserInGame(game)
      )
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
      .slice(0, 5);
    return { yourTurn, theirTurn, completed };
  }, [games, userId]);

  const renderGameCard = (game: LobbyGame) => {
    if (!userId) return null;
    const isHost = game.host_id === userId;
    const opponentName = isHost
      ? game.guest?.username ?? (game.guest_id ? 'Opponent' : 'Waiting for opponent')
      : game.host?.username ?? 'Opponent';
    const youScore = isHost
      ? game.host_score ?? STARTING_SCORE
      : game.guest_score ?? STARTING_SCORE;
    const opponentScore = isHost
      ? game.guest_score ?? STARTING_SCORE
      : game.host_score ?? STARTING_SCORE;
    let statusLabel = '';
    if (game.status === 'finished') {
      statusLabel = 'Game over';
    } else if (game.status === 'cancelled') {
      statusLabel = 'Cancelled';
    } else if (!game.guest_id) {
      statusLabel = 'Waiting for opponent';
    } else if (!game.current_player_id) {
      statusLabel = 'Paused';
    } else if (game.current_player_id === userId) {
      statusLabel = 'Your turn';
    } else {
      statusLabel = 'Waiting on friend';
    }

    const canResign =
      ['waiting', 'in_progress'].includes(game.status) &&
      game.guest_id &&
      (game.host_id === userId || game.guest_id === userId);
    const canDelete =
      game.status === 'waiting' && !game.guest_id && game.host_id === userId;

    return (
      <View key={game.id} style={styles.gameCard}>
        <View style={styles.gameCardHeader}>
          <Text style={styles.gameOpponent}>{opponentName}</Text>
          <Text style={styles.gameStatus}>{statusLabel}</Text>
        </View>
        <Text style={styles.gameScore}>{`You: ${youScore} • Opponent: ${opponentScore}`}</Text>
        <View style={styles.cardActions}>
          <StyledButton
            label="Open Match"
            variant="outline"
            onPress={() => router.push(`/online/game-v2/${game.id}` as const)}
            style={styles.openMatchButton}
          />
          <View style={styles.cardLinks}>
            {canResign && (
              <TouchableOpacity onPress={() => handleResign(game)}>
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

  const renderSection = (title: string, data: LobbyGame[]) => {
    if (!data.length) {
      return null;
    }
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {data.map(renderGameCard)}
      </View>
    );
  };

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
          <Text style={styles.hint}>{friendlyHint}</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Start a new match</Text>
            <Text style={styles.cardSubtitle}>
              Invite a friend by username or leave it blank to create a shareable code.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Friend username (optional)"
              placeholderTextColor="#9FBBA6"
              value={friendUsername}
              onChangeText={setFriendUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <StyledButton
              label={creatingMatch ? 'Creating…' : 'Start Match'}
              onPress={handleCreateMatch}
              disabled={creatingMatch || !userId}
              style={styles.primaryButton}
            />
            {createMessage && <Text style={styles.shareHint}>{createMessage}</Text>}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Join a match</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter match code"
              placeholderTextColor="#9FBBA6"
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <StyledButton
              label={joining ? 'Joining…' : 'Join Match'}
              onPress={handleJoinByCode}
              disabled={joining || !userId}
              style={styles.primaryButton}
            />
          </View>

          {loadingGames ? (
            <View style={styles.loadingMatches}>
              <ActivityIndicator size="small" color="#E0B50C" />
              <Text style={styles.loadingText}>Loading matches…</Text>
            </View>
          ) : (
            <>
              {renderSection('Your Turn', sections.yourTurn)}
              {renderSection('Their Turn', sections.theirTurn)}
              {renderSection('Completed games', sections.completed)}
              {!sections.yourTurn.length &&
                !sections.theirTurn.length &&
                !sections.completed.length && (
                  <Text style={styles.emptyText}>No matches yet.</Text>
                )}
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
  hint: {
    color: '#E6FFE6',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 15,
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
    marginBottom: 6,
  },
  cardSubtitle: {
    color: '#C9F0D6',
    fontSize: 13,
    marginBottom: 10,
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
    marginBottom: 8,
  },
  shareHint: {
    color: '#C9F0D6',
    fontSize: 13,
    marginTop: 6,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#E0B50C',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 10,
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
    justifyContent: 'space-between',
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
  emptyText: {
    color: '#C9F0D6',
    textAlign: 'center',
    marginTop: 30,
  },
});
