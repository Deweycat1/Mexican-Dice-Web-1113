import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import IncomingChallengesList from '../src/components/IncomingChallengesList';
import WaitingForAcceptance from '../src/components/WaitingForAcceptance';
import { ensureUserProfile, getCurrentUser, type UserProfile } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';

export default function OnlineScreen() {
	const router = useRouter();

	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [profileError, setProfileError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const [friendUsername, setFriendUsername] = useState('');
	const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
	const [isCreatingGame, setIsCreatingGame] = useState(false);

	const [myUserId, setMyUserId] = useState<string | null>(null);
	const [pendingChallengeId, setPendingChallengeId] = useState<string | null>(null);
	const hasNavigatedRef = useRef(false);

	useEffect(() => {
		let isMounted = true;


		const loadProfile = async () => {
			try {
				console.log('🚀 Loading user profile...');
				const userProfile = await ensureUserProfile();
				if (isMounted) {
					setProfile(userProfile);
					setProfileError(null);
					console.log('✅ Profile loaded:', userProfile.username);
				}
			} catch (error: any) {
				console.error('❌ Failed to load user profile:', error);
				if (isMounted) {
					setProfileError(error.message ?? 'Could not load user profile');
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		};

		loadProfile();
		getCurrentUser().then((user) => {
			if (user && isMounted) {
				console.log('[OnlineScreen] Auth user:', user);
				console.log('[OnlineScreen] Setting myUserId:', user.id);
				setMyUserId(user.id);
			}
		});

		return () => {
			isMounted = false;
		};
	}, []);
	useEffect(() => {
		if (!pendingChallengeId) {
			hasNavigatedRef.current = false;
			return;
		}

		console.log('[Online] Subscribing for updates on challenge:', pendingChallengeId);
		const channel = supabase
			.channel(`challenge-update-${pendingChallengeId}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
		  schema: 'public',
		  table: 'challenges',
		  filter: `id=eq.${pendingChallengeId}`,
				},
				(payload) => {
					console.log('[Online] Challenge update payload (inviter):', payload);
		  const updated: any = payload.new;

		  if (
			updated &&
			updated.status === 'accepted' &&
			updated.game_id &&
						!hasNavigatedRef.current
					) {
						hasNavigatedRef.current = true;
						console.log(
							'[Online] Challenge accepted via Realtime, navigating to game:',
							updated.game_id
						);
						setPendingChallengeId(null);
						router.push(`/online/game-v2/${updated.game_id}` as any);
					}
				}
			)
			.subscribe();

		return () => {
			console.log('[Online] Cleaning up challenge subscription for', pendingChallengeId);
			supabase.removeChannel(channel);
		};
	}, [pendingChallengeId, router]);

	useEffect(() => {
		if (!pendingChallengeId) return;

		console.log('[Online] Starting polling loop for challenge:', pendingChallengeId);

		const interval = setInterval(async () => {
			if (hasNavigatedRef.current) return;

			const { data, error } = await supabase
				.from('challenges')
				.select('id, status, game_id')
				.eq('id', pendingChallengeId)
				.single();

			if (error) {
				console.error('[Online] Polling error for challenge', pendingChallengeId, error);
				return;
			}

			console.log('[Online] Polling result for challenge:', data);

			if (data && data.status === 'accepted' && data.game_id && !hasNavigatedRef.current) {
				hasNavigatedRef.current = true;
				console.log(
					'[Online] Challenge accepted via polling, navigating to game:',
					data.game_id
				);
				setPendingChallengeId(null);
				router.push(`/online/game-v2/${data.game_id}` as any);
			}
		}, 2000);

		return () => {
			console.log('[Online] Clearing polling loop for challenge:', pendingChallengeId);
			clearInterval(interval);
		};
	}, [pendingChallengeId, router]);

	const handleStartChallenge = async () => {
		setMessage(null);

		if (!profile) {
			setMessage({ type: 'error', text: 'Please wait for your profile to load' });
			return;
		}

		if (!friendUsername.trim()) {
			setMessage({ type: 'error', text: "Please enter a friend's username" });
			return;
		}

		setIsCreatingGame(true);

		try {
			console.log('[StartChallenge] Auth user (myUserId):', myUserId);
			console.log('[StartChallenge] Profile row:', { id: profile.id, username: profile.username });
			console.log('[StartChallenge] Looking up friend:', friendUsername.trim());

			const { data: friend, error: friendError } = await supabase
				.from('users')
				.select('*')
				.eq('username', friendUsername.trim())
				.single();

			console.log('[StartChallenge] Friend lookup result:', { friend, friendError });

			if (friendError || !friend) {
				console.error('[Challenges] Supabase error (friend lookup)', friendError);
				setMessage({ type: 'error', text: 'User not found' });
				return;
			}

			console.log('[StartChallenge] Creating challenge with:', {
				challenger_id: profile.id,
				recipient_id: friend.id,
				status: 'pending',
			});

			const { data: challenge, error: challengeError } = await supabase
				.from('challenges')
				.insert({
					challenger_id: profile.id,
					recipient_id: friend.id,
					status: 'pending',
				})
				.select()
				.single();

			console.log('[StartChallenge] Challenge insert result:', { challenge, challengeError });

			if (challengeError || !challenge) {
				console.error('[Challenges] Supabase error (insert)', challengeError);
				console.error('[Challenges] Insert failed with details:', {
					message: challengeError?.message,
					details: challengeError?.details,
					hint: challengeError?.hint,
					code: challengeError?.code,
				});
				setMessage({ type: 'error', text: 'Could not create challenge' });
				return;
			}

			console.log('[StartChallenge] ✅ Challenge created successfully:', {
				id: challenge.id,
				challenger_id: challenge.challenger_id,
				recipient_id: challenge.recipient_id,
				status: challenge.status,
			});
			console.log('[Online] Setting pendingChallengeId after insert:', challenge.id);
			setPendingChallengeId(challenge.id);

			setMessage({
				type: 'success',
				text: 'Challenge sent! Your friend will see it on their Online screen.',
			});
			setFriendUsername('');
		} catch (error) {
			console.error('[StartChallenge] Unexpected error:', error);
			setMessage({ type: 'error', text: 'An unexpected error occurred' });
		} finally {
			setIsCreatingGame(false);
		}
	};

	if (pendingChallengeId) {
		return <WaitingForAcceptance />;
	}

	return (
		<View style={styles.container}>
			<TouchableOpacity
				style={{ position: 'absolute', top: 32, left: 24, zIndex: 10 }}
				onPress={() => router.push('/')}
			>
				<Text style={{ color: '#E0B50C', fontWeight: '700', fontSize: 18 }}>← Menu</Text>
			</TouchableOpacity>

			<Text style={styles.title}>Online Play</Text>

			{isLoading ? (
				<View style={styles.usernameContainer}>
					<ActivityIndicator size="small" color="#E0B50C" />
					<Text style={styles.loadingText}>Loading profile...</Text>
				</View>
			) : profileError ? (
				<View style={styles.errorBox}>
					<Text style={styles.errorText}>⚠️ {profileError}</Text>
					<Text style={styles.errorHint}>
						You can still try to play, but features may be limited.
					</Text>
				</View>
			) : (
				<Text style={styles.username}>
					Signed in as: {profile?.username ?? 'Unknown'}
				</Text>
			)}

			{!isLoading && (
				<View style={styles.gameCreationContainer}>
					<Text style={styles.label}>Friend&apos;s Username</Text>
					<TextInput
						style={styles.input}
						value={friendUsername}
						onChangeText={setFriendUsername}
						placeholder="Enter username"
						placeholderTextColor="rgba(255, 255, 255, 0.4)"
						autoCapitalize="none"
						editable={!isCreatingGame}
					/>

					<TouchableOpacity
						style={[styles.button, isCreatingGame && styles.buttonDisabled]}
						onPress={handleStartChallenge}
						disabled={isCreatingGame}
					>
						{isCreatingGame ? (
							<ActivityIndicator size="small" color="#FFFFFF" />
						) : (
							<Text style={styles.buttonText}>Send Challenge</Text>
						)}
					</TouchableOpacity>

					{message && (
						<View
							style={[
								styles.messageContainer,
								message.type === 'error' ? styles.errorContainer : styles.successContainer,
							]}
						>
							<Text style={styles.messageText}>{message.text}</Text>
						</View>
					)}
				</View>
			)}

			{!isLoading && myUserId && (
				<IncomingChallengesList
					myUserId={myUserId}
					onJoinGame={(gameId) => router.push(`/online/game-v2/${gameId}` as any)}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#0B3A26',
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 32,
	},
	title: {
		fontSize: 32,
		fontWeight: '800',
		color: '#FFFFFF',
		marginBottom: 24,
		textAlign: 'center',
	},
	usernameContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	loadingText: {
		fontSize: 16,
		color: 'rgba(255, 255, 255, 0.7)',
	},
	username: {
		fontSize: 18,
		color: '#E0B50C',
		fontWeight: '600',
		textAlign: 'center',
		marginBottom: 32,
	},
	errorBox: {
		backgroundColor: 'rgba(220, 38, 38, 0.1)',
		borderWidth: 1,
		borderColor: 'rgba(220, 38, 38, 0.4)',
		borderRadius: 8,
		padding: 16,
		marginBottom: 24,
		maxWidth: 400,
	},
	errorText: {
		fontSize: 16,
		color: '#FF6B6B',
		fontWeight: '600',
		textAlign: 'center',
		marginBottom: 8,
	},
	errorHint: {
		fontSize: 14,
		color: 'rgba(255, 255, 255, 0.7)',
		textAlign: 'center',
	},
	gameCreationContainer: {
		width: '100%',
		maxWidth: 400,
		alignItems: 'stretch',
	},
	label: {
		fontSize: 16,
		color: '#FFFFFF',
		fontWeight: '600',
		marginBottom: 8,
	},
	input: {
		backgroundColor: 'rgba(255, 255, 255, 0.1)',
		borderWidth: 2,
		borderColor: 'rgba(255, 255, 255, 0.2)',
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingVertical: 12,
		fontSize: 16,
		color: '#FFFFFF',
		marginBottom: 20,
	},
	button: {
		backgroundColor: '#0FA958',
		borderRadius: 8,
		paddingVertical: 14,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 50,
	},
	buttonDisabled: {
		backgroundColor: 'rgba(15, 169, 88, 0.5)',
	},
	buttonText: {
		fontSize: 18,
		fontWeight: '700',
		color: '#FFFFFF',
	},
	messageContainer: {
		marginTop: 16,
		padding: 12,
		borderRadius: 8,
		borderWidth: 1,
	},
	errorContainer: {
		backgroundColor: 'rgba(220, 38, 38, 0.1)',
		borderColor: 'rgba(220, 38, 38, 0.4)',
	},
	successContainer: {
		backgroundColor: 'rgba(15, 169, 88, 0.1)',
		borderColor: 'rgba(15, 169, 88, 0.4)',
	},
	messageText: {
		fontSize: 14,
		color: '#FFFFFF',
		textAlign: 'center',
	},
});
