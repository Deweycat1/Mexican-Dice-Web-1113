import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export type Challenge = {
  id: string;
  challenger_id: string;
  recipient_id: string;
  game_id: string | null;
  status: string;
  created_at: string;
  challenger_username?: string;
};

type IncomingChallengesListProps = {
  myUserId: string;
  onJoinGame: (gameId: string) => void;
};

export default function IncomingChallengesList({ myUserId, onJoinGame }: IncomingChallengesListProps) {
  console.log('[IncomingChallengesList] Render with myUserId:', myUserId);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let interval: any = null;
    console.log('[Challenges] useEffect mounted for myUserId:', myUserId);

    async function fetchChallenges() {
      setLoading(true);
      console.log('[FetchChallenges] BEGIN. myUserId =', myUserId);

      const { data, error } = await supabase
        .from('challenges')
        .select('*, challenger:challenger_id(username)')
        .eq('recipient_id', myUserId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      console.log('[FetchChallenges] Supabase select result:', { data, error });

      if (!isMounted) return;

      if (error) {
        console.error('[Challenges] Supabase error (query)', error);
        setChallenges([]);
      } else {
        const incoming = (data ?? []).filter(
          (c: any) => c?.status === 'pending' && c?.recipient_id === myUserId
        );
        console.log('[IncomingChallengesList] incoming after filter:', incoming);
        setChallenges(incoming.map((c: any) => ({
          ...c,
          challenger_username: c.challenger?.username || 'Unknown',
        })));
      }
      setLoading(false);
    }

    fetchChallenges();
    interval = setInterval(fetchChallenges, 5000);

    // Subscribe to real-time changes with proper filtering
    console.log('[Challenges] Setting up real-time subscription for recipient_id:', myUserId);

    const channel = supabase
      .channel(`challenges-realtime-${myUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'challenges',
          filter: `recipient_id=eq.${myUserId}`,
        },
        (payload) => {
          console.log('[Realtime INSERT] Raw Payload:', payload);
          console.log('[Realtime INSERT] newChallenge:', payload.new);
          console.log('[Realtime INSERT] newChallenge.recipient_id:', payload.new?.recipient_id);
          console.log('[Realtime INSERT] myUserId:', myUserId);
          console.log('[Realtime INSERT] Match?', payload.new?.recipient_id === myUserId);

          const newChallenge = payload.new as any;

          if (
            newChallenge &&
            newChallenge.recipient_id === myUserId &&
            newChallenge.status === 'pending'
          ) {
            console.log('[Realtime INSERT] ✅ Adding challenge to list:', newChallenge.id);

            // Fetch the challenger's username
            supabase
              .from('users')
              .select('username')
              .eq('id', newChallenge.challenger_id)
              .single()
              .then(({ data: userData, error: userError }) => {
                const challengerUsername = userData?.username || 'Unknown';
                console.log('[Realtime INSERT] Fetched challenger username:', challengerUsername);

                setChallenges((prev) => {
                  if (prev.some((c) => c.id === newChallenge.id)) {
                    console.log('[Realtime INSERT] Challenge already exists, skipping');
                    return prev;
                  }

                  const challengeObj: Challenge = {
                    id: newChallenge.id,
                    challenger_id: newChallenge.challenger_id,
                    recipient_id: newChallenge.recipient_id,
                    game_id: newChallenge.game_id,
                    status: newChallenge.status,
                    created_at: newChallenge.created_at,
                    challenger_username: challengerUsername,
                  };

                  console.log('[Realtime INSERT] Adding challenge:', challengeObj);
                  return [challengeObj, ...prev];
                });
              })
              .catch((err) => {
                console.error('[Realtime INSERT] Error fetching challenger username:', err);
              });
          } else {
            console.log('[Realtime INSERT] ❌ Challenge does not match criteria, ignoring');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'challenges',
        },
        (payload) => {
          console.log('[Realtime UPDATE] Raw Payload:', payload);
          console.log('[Realtime UPDATE] updatedChallenge:', payload.new);
          console.log('[Realtime UPDATE] updated recipient_id / challenger_id check:', payload.new?.recipient_id, payload.new?.challenger_id, myUserId);

          const updatedChallenge = payload.new as any;

          if (
            updatedChallenge &&
            (updatedChallenge.recipient_id === myUserId || updatedChallenge.challenger_id === myUserId)
          ) {
            console.log('[Realtime UPDATE] ✅ Updating challenge in list:', updatedChallenge.id);

            setChallenges((prev) =>
              prev.map((c) =>
                c.id === updatedChallenge.id
                  ? {
                      ...c,
                      ...updatedChallenge,
                      challenger_username: updatedChallenge.challenger_username || c.challenger_username || 'Unknown',
                    }
                  : c
              )
            );
          } else {
            console.log('[Realtime UPDATE] ❌ Challenge does not match criteria, ignoring');
          }
        }
      )
      .subscribe((status) => {
        console.log('[Challenges] Subscription status:', status);
      });

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
      console.log('[Challenges] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [myUserId]);

  const acceptChallenge = async (challenge: Challenge) => {
    try {
      console.log('[AcceptChallenge] Starting for challenge:', challenge.id);

      // 1. Fetch authenticated user
      const {
        data: { user: myUser },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !myUser) {
        console.error('[Challenges] Supabase auth error:', userError);
        alert('Could not get current user.');
        return;
      }

      console.log('[AcceptChallenge] Current user:', myUser.id);

      if (myUser.id !== challenge.recipient_id) {
        console.error('[Challenges] Only recipient can accept challenge.', { myUserId: myUser.id, challenge });
        alert('Only the recipient can accept this challenge.');
        return;
      }

      // 2. Fetch recipient's username from public.users
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('username')
        .eq('id', myUser.id)
        .single();

      if (profileError || !userProfile) {
        console.error('[Challenges] Profile fetch error:', profileError, { myUserId: myUser.id });
        alert('Could not fetch recipient profile.');
        return;
      }

      const recipientUsername = userProfile.username || '';
      console.log('[AcceptChallenge] Recipient username:', recipientUsername);

      // 3. Create new game row in public.games_v2
      console.log('[AcceptChallenge] Creating V2 game with:', {
        host_id: challenge.challenger_id,
        guest_id: challenge.recipient_id,
        host_username: challenge.challenger_username,
        guest_username: recipientUsername,
      });

      const { data: newGame, error: gameError } = await supabase
        .from('games_v2')
        .insert({
          host_id: challenge.challenger_id,
          guest_id: challenge.recipient_id,
          status: 'in_progress',
          current_player_id: challenge.challenger_id,
        })
        .select('*')
        .single();

      if (gameError || !newGame) {
        console.error('[Challenges] Game creation error:', gameError, { challenge });
        alert('Could not create game. Please try again.');
        return;
      }

      console.log('[AcceptChallenge] Game created:', newGame.id);

      // 4. Update challenge row
      console.log('[AcceptChallenge] Updating challenge status to accepted');

      const { error: updateError } = await supabase
        .from('challenges')
        .update({ status: 'accepted', game_id: newGame.id })
        .eq('id', challenge.id)
        .eq('recipient_id', myUser.id);

      if (updateError) {
        console.error('Challenge update failed:', updateError);
        alert('Could not update challenge.');
        return;
      }

      console.log('[AcceptChallenge] Challenge updated successfully');

      // 5. Navigate to game for both players
      console.log('[AcceptChallenge] Navigating to game:', newGame.id);
      onJoinGame(newGame.id);
    } catch (err) {
      console.error('[Challenges] Unexpected error in acceptChallenge:', err);
      alert('Unexpected error. Please try again.');
    }
  };

  if (loading) {
    console.log('[IncomingChallengesList] Rendering loading state');
    return <ActivityIndicator size="small" color="#E0B50C" />;
  }

  if (!challenges.length) {
    console.log('[IncomingChallengesList] Rendering no challenges state');
    return <Text style={{ color: '#fff', marginTop: 12 }}>No incoming challenges.</Text>;
  }

  console.log('[IncomingChallengesList] Rendering', challenges.length, 'challenges');

  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ color: '#E0B50C', fontWeight: '700', fontSize: 16, marginBottom: 8 }}>Incoming Challenges</Text>
      {challenges.map(challenge => (
        <TouchableOpacity
          key={challenge.id}
          style={{ backgroundColor: '#115E38', borderRadius: 8, padding: 12, marginBottom: 10 }}
          onPress={() => !challenge.game_id ? acceptChallenge(challenge) : onJoinGame(challenge.game_id!)}
        >
          <Text style={{ color: '#fff', fontSize: 15 }}>
            Join game with {challenge.challenger_username}
          </Text>
          {!challenge.game_id && (
            <Text style={{ color: '#E0B50C', fontSize: 13, marginTop: 4 }}>
              Tap to accept and create game
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}
