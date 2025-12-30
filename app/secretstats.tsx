import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { FlameEmojiIcon } from '../src/components/FlameEmojiIcon';
import { supabase } from '../src/lib/supabase';
import { getCurrentUser } from '../src/lib/auth';
import { flushPendingCarryStats } from '../src/state/useGameStore';

interface SurvivalBestData {
  streak: number;
  updatedAt: string;
  city?: string | null;
  state?: string | null;
}

interface QuickPlayBestData {
  streak: number;
  updatedAt: string;
  city?: string | null;
  state?: string | null;
}

interface SurvivalAverageData {
  averageSurvivalStreak: number;
  sampleSize: number;
}

interface WinStatsData {
  playerWins: number;
  cpuWins: number;
}

interface BehaviorStats {
  rival: {
    truths: number;
    bluffs: number;
    bluffSuccess: number;
    truthRate: number;
    bluffSuccessRate: number;
  };
  bluffCalls: {
    player: { total: number; correct: number; accuracy: number };
    rival: { total: number; correct: number; accuracy: number };
  };
}

interface MetaStats {
  honesty: {
    truthful: number;
    bluffs: number;
    honestyRate: number;
  };
  aggression: {
    player: {
      aggressiveEvents: number;
      totalEvents: number;
      index: number;
    };
    rival: {
      aggressiveEvents: number;
      totalEvents: number;
      index: number;
    };
  };
  // claim risk removed from server-side response
}

export default function SecretStatsScreen() {
  const router = useRouter();
  
  // Win/Survival stats
  const [survivalBest, setSurvivalBest] = useState<SurvivalBestData | null>(null);
  const [survivalOver10, setSurvivalOver10] = useState<{ totalSurvivalUsers: number; survivalOver10Users: number; survivalOver10Rate: number } | null>(null);
  const [quickPlayBest, setQuickPlayBest] = useState<QuickPlayBestData | null>(null);
  const [averageStreak, setAverageStreak] = useState<number | null>(null);
  const [survivalAverage, setSurvivalAverage] = useState<SurvivalAverageData | null>(null);
  const [playerWins, setPlayerWins] = useState<number>(0);
  const [cpuWins, setCpuWins] = useState<number>(0);
  
  // Behavior stats (rival behavior and bluff calls)
  const [behaviorStats, setBehaviorStats] = useState<BehaviorStats | null>(null);
  
  // Meta stats (honesty, aggression, claims risk, roll rarity)
  const [metaStats, setMetaStats] = useState<MetaStats | null>(null);

  // Hidden dice math stats
  const [carryHits, setCarryHits] = useState<number>(0);
  const [carryAttempts, setCarryAttempts] = useState<number>(0);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Reset stats state
  const [pendingConfirm, setPendingConfirm] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const resolveBaseUrl = useCallback(
    () => (typeof window !== 'undefined' ? window.location.origin : ''),
    []
  );

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const baseUrl = resolveBaseUrl();
      
      // Fetch all relevant APIs
      const [
        survivalBestRes,
        quickPlayBestRes,
        winsRes,
        behaviorRes,
        metaRes,
        survivalOver10Res,
        survivalAverageRes,
      ] = await Promise.all([
        fetch(`${baseUrl}/api/survival-best`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
        fetch(`${baseUrl}/api/quickplay-best`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
        fetch(`${baseUrl}/api/win-stats`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
        fetch(`${baseUrl}/api/behavior-stats`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
        fetch(`${baseUrl}/api/meta-stats`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
        fetch(`${baseUrl}/api/survival-over10`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
        fetch(`${baseUrl}/api/survival-average-streak`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
      ]);

      if (!survivalBestRes.ok) throw new Error('Failed to fetch survival best');
      if (!quickPlayBestRes.ok) throw new Error('Failed to fetch quick play best');
      if (!winsRes.ok) throw new Error('Failed to fetch win stats');

      const survivalBestData: SurvivalBestData = await survivalBestRes.json();
      const quickPlayBestData: QuickPlayBestData = await quickPlayBestRes.json();
      const winsData: WinStatsData = await winsRes.json();
      if (survivalAverageRes.ok) {
        try {
          const survivalAverageData: SurvivalAverageData = await survivalAverageRes.json();
          setSurvivalAverage(survivalAverageData);
        } catch {
          if (__DEV__) {
            console.log('Survival average stats not available yet');
          }
        }
      }
      
      // Parse behavior and meta stats (with error handling)
      try {
        if (behaviorRes.ok) {
          const behaviorData: BehaviorStats = await behaviorRes.json();
          setBehaviorStats(behaviorData);
        }
      } catch {
        if (__DEV__) {
          console.log('Behavior stats not available yet');
        }
      }

      try {
        if (metaRes.ok) {
          const metaData: MetaStats = await metaRes.json();
          setMetaStats(metaData);
        }
      } catch {
        if (__DEV__) {
          console.log('Meta stats not available yet');
        }
      }

      try {
        if (survivalOver10Res.ok) {
          const over10Data = await survivalOver10Res.json();
          setSurvivalOver10(over10Data);
        }
      } catch {
        if (__DEV__) {
          console.log('Survival over-10 stats not available yet');
        }
      }

      // Set survival stats
      setSurvivalBest(survivalBestData);
      setQuickPlayBest(quickPlayBestData);
      // Average streak not available (endpoint removed); keep as null so UI shows fallback

      // Set win stats
      setPlayerWins(winsData.playerWins ?? 0);
      setCpuWins(winsData.cpuWins ?? 0);

      // Fetch hidden carry stats from Supabase
      try {
        const user = await getCurrentUser();
        if (user) {
          const { data: carryData, error: carryError } = await supabase
            .from('secret_stats')
            .select('carry_hits, carry_attempts')
            .eq('user_id', user.id)
            .maybeSingle();

          if (carryError) {
            if (__DEV__) {
              console.log('Carry stats not available yet');
            }
          } else {
            setCarryHits(carryData?.carry_hits ?? 0);
            setCarryAttempts(carryData?.carry_attempts ?? 0);
          }
        }
      } catch {
        if (__DEV__) {
          console.log('Carry stats not available yet');
        }
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  }, [resolveBaseUrl]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      void (async () => {
        await flushPendingCarryStats();
        if (isActive) {
          await fetchStats();
        }
      })();
      return () => {
        isActive = false;
      };
    }, [fetchStats])
  );

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) return;
      void (async () => {
        await flushPendingCarryStats();
        await fetchStats();
      })();
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  }, [fetchStats]);

  // Auto-timeout confirmation after 15 seconds
  useEffect(() => {
    if (!pendingConfirm) return;

    const timer = setTimeout(() => {
      setPendingConfirm(false);
      setResetMessage(null);
    }, 15000); // 15 seconds

    return () => clearTimeout(timer);
  }, [pendingConfirm]);

  // Handler for reset stats button
  const handleResetClick = async () => {
    setResetMessage(null);

    // First click — arm confirmation
    if (!pendingConfirm) {
      setPendingConfirm(true);
      return;
    }

    // Second click — ask for final confirmation
    const proceed = typeof window !== 'undefined' && window.confirm(
      "FINAL WARNING: This will permanently delete ALL stats for Inferno Dice. This cannot be undone. Continue?"
    );
    if (!proceed) {
      setPendingConfirm(false);
      setResetMessage("Reset cancelled.");
      return;
    }

    // Prompt for password
    const entered = typeof window !== 'undefined' && window.prompt("Enter admin password to reset ALL stats:");
    if (!entered) {
      setPendingConfirm(false);
      setResetMessage("Reset cancelled (no password provided).");
      return;
    }

    try {
      setIsResetting(true);
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

      const res = await fetch(`${baseUrl}/api/admin/reset-stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: entered }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          const errorData = await res.json();
          setResetMessage(errorData.error || "Incorrect password. Stats were NOT reset.");
          setPendingConfirm(false);
          return;
        }
        throw new Error(`Reset failed with status ${res.status}`);
      }

      const data = await res.json();
      setResetMessage(data.message || "All stats have been reset successfully.");
      setPendingConfirm(false);

      // Refresh stats after successful reset
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error(err);
      setResetMessage("There was an error resetting stats. Check logs and try again.");
      setPendingConfirm(false);
    } finally {
      setIsResetting(false);
    }
  };

  const getRollLabel = (roll: string): string => {
    switch (roll) {
      case '21':
        return '21 (Inferno)';
      case '31':
        return '31 (Reverse)';
      case '41':
        return '41 (Social)';
      default:
        return roll;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#53A7F3" />
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
        <Pressable
          onPress={() => router.push('/')}
          style={({ pressed }: { pressed: boolean }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Text style={styles.backButtonText}>Back to Menu</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error Loading Stats</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/')}
          style={({ pressed }: { pressed: boolean }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Text style={styles.backButtonText}>Back to Menu</Text>
        </Pressable>
      </View>
    );
  }

  const totalGames = playerWins + cpuWins;
  const playerWinRate = totalGames > 0 ? (playerWins / totalGames) * 100 : 0;
  const cpuWinRate = totalGames > 0 ? (cpuWins / totalGames) * 100 : 0;
  const carryPercent =
    carryAttempts > 0
      ? `${((carryHits / carryAttempts) * 100).toFixed(2)}%`
      : '—';

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.push('/')} style={styles.backButtonTop}>
        <Text style={styles.backButtonTopText}>← Back</Text>
      </Pressable>
      
      <View style={styles.titleRow}>
        <Text style={[styles.title, styles.titleSegment]}>Win & Inferno</Text>
        <FlameEmojiIcon size={28} style={styles.inlineFlameIcon} />
        <Text style={[styles.title, styles.titleSegment]}>Mode Stats</Text>
      </View>
      <Text style={styles.subtitle}>🔒 Hidden Analytics</Text>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎮 Quick Play - Total Games</Text>
          <Text style={styles.bigNumber}>{totalGames.toLocaleString()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏆 Quick Play Wins</Text>
            <View style={styles.statsTable}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>You</Text>
              <View style={styles.statValues}>
                <Text style={styles.statCount}>{playerWins}</Text>
                <Text style={styles.statPercent}>({playerWinRate.toFixed(1)}%)</Text>
              </View>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Infernoman</Text>
              <View style={styles.statValues}>
                <Text style={styles.statCount}>{cpuWins}</Text>
                <Text style={styles.statPercent}>({cpuWinRate.toFixed(1)}%)</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎯 Quick Play – Longest Win Streak</Text>
          <View style={styles.statsTable}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Longest Win Streak</Text>
              <Text style={styles.statCountLarge}>{quickPlayBest?.streak ?? 0}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Record Location</Text>
              <Text style={styles.statCountLarge}>
                {quickPlayBest?.city && quickPlayBest?.state
                  ? `${quickPlayBest.city}, ${quickPlayBest.state}`
                  : 'Unknown (no location data)'}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Record Date & Time</Text>
              <Text style={styles.statCountSmall}>
                {quickPlayBest?.updatedAt
                  ? new Date(quickPlayBest.updatedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : '—'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <FlameEmojiIcon size={20} style={styles.inlineFlameIcon} />
            <Text style={[styles.cardTitle, styles.cardTitleSegment]}>Inferno</Text>
            <FlameEmojiIcon size={20} style={styles.inlineFlameIcon} />
            <Text style={[styles.cardTitle, styles.cardTitleSegment]}>Mode</Text>
          </View>
          <View style={styles.statsTable}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Global Best Streak</Text>
              <Text style={styles.statCountLarge}>{survivalBest?.streak ?? 0}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Record Location</Text>
              <Text style={styles.statCountLarge}>
                {survivalBest?.city && survivalBest?.state
                  ? `${survivalBest.city}, ${survivalBest.state}`
                  : 'Unknown (no location data)'}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Record Date & Time</Text>
              <Text style={styles.statCountSmall}>
                {survivalBest?.updatedAt
                  ? new Date(survivalBest.updatedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })
                  : '—'}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Average Streak</Text>
              <Text style={styles.statCountLarge}>{averageStreak?.toFixed(2) ?? '0.00'}</Text>
            </View>
          </View>
        </View>

        {survivalAverage && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, styles.cardTitleSegment]}>🏔️ Average Inferno</Text>
              <FlameEmojiIcon size={20} style={styles.inlineFlameIcon} />
              <Text style={[styles.cardTitle, styles.cardTitleSegment]}>Mode Streak</Text>
            </View>
            <Text style={styles.bigNumber}>{survivalAverage.averageSurvivalStreak.toFixed(2)}</Text>
            <Text style={styles.cardSubtext}>
              Based on {survivalAverage.sampleSize.toLocaleString()} completed runs
            </Text>
          </View>
        )}

        {/* Bluff Call Accuracy */}
        {behaviorStats?.bluffCalls && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🎲 Bluff Call Accuracy (Global)</Text>
            <View style={styles.statsTable}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Your Accuracy</Text>
                <Text style={styles.statCountLarge}>
                  {(behaviorStats.bluffCalls.player.accuracy * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Infernoman Accuracy</Text>
                <Text style={styles.statCountLarge}>
                  {(behaviorStats.bluffCalls.rival.accuracy * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Infernoman Behavior */}
        {behaviorStats?.rival && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🤖 Infernoman&apos;s Behavior (Global)</Text>
            <View style={styles.statsTable}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Truth Rate</Text>
                <Text style={styles.statCountLarge}>
                  {(behaviorStats.rival.truthRate * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Bluffs Attempted</Text>
                <Text style={styles.statCountLarge}>
                  {behaviorStats.rival.bluffs}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Bluff Success Rate</Text>
                <Text style={styles.statCountLarge}>
                  {(behaviorStats.rival.bluffSuccessRate * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Player Honesty & Aggression */}
        {metaStats && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Your Behavior & Aggression</Text>
            <View style={styles.statsTable}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Honesty Rate</Text>
                <Text style={styles.statCountLarge}>
                  {(metaStats.honesty.honestyRate * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Truthful Claims</Text>
                <Text style={styles.statCountLarge}>
                  {metaStats.honesty.truthful}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Bluff Claims</Text>
                <Text style={styles.statCountLarge}>
                  {metaStats.honesty.bluffs}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Your Aggression Index</Text>
                <Text style={styles.statCountLarge}>
                  {metaStats.aggression.player.index.toFixed(1)}/100
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Infernoman Aggression Index</Text>
                <Text style={styles.statCountLarge}>
                  {metaStats.aggression.rival.index.toFixed(1)}/100
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧮 Dice Math (Hidden)</Text>
          <View style={styles.statsTable}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Carry Rate</Text>
              <Text style={styles.statCountLarge}>{carryPercent}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Overlapping dice across consecutive rolls</Text>
              <Text style={styles.statCountSmall}>{carryAttempts.toLocaleString()} checks</Text>
            </View>
          </View>
        </View>

        {/* Claim Risk Analysis has been deprecated and removed from the backend. */}

        {/* Survival: Percent of users scoring >10 */}
        {survivalOver10 && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <FlameEmojiIcon size={20} style={styles.inlineFlameIcon} />
              <Text style={[styles.cardTitle, styles.cardTitleSegment]}>Inferno</Text>
              <FlameEmojiIcon size={20} style={styles.inlineFlameIcon} />
              <Text style={[styles.cardTitle, styles.cardTitleSegment]}>Mode</Text>
            </View>
            <View style={styles.statsTable}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>% of users scoring &gt; 10</Text>
                <Text style={styles.statCountLarge}>
                  {`${(survivalOver10.survivalOver10Rate ?? 0).toFixed(1)}%`}
                </Text>
              </View>
              <View style={styles.statRow}>
                <View style={styles.statLabelRow}>
                  <Text style={[styles.statLabel, styles.statLabelSegment]}>Total Inferno</Text>
                  <FlameEmojiIcon size={16} style={styles.inlineFlameIcon} />
                  <Text style={[styles.statLabel, styles.statLabelSegment]}>Mode Players</Text>
                </View>
                <Text style={styles.statCountLarge}>{survivalOver10.totalSurvivalUsers ?? 0}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Users &gt; 10</Text>
                <Text style={styles.statCountLarge}>{survivalOver10.survivalOver10Users ?? 0}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Reset All Stats Button */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚠️ Admin Controls</Text>
          
          <Pressable
            onPress={handleResetClick}
            disabled={isResetting}
            style={({ pressed }: { pressed: boolean }) => [
              styles.resetButton,
              pendingConfirm && styles.resetButtonArmed,
              (pressed || isResetting) && styles.resetButtonPressed,
            ]}
          >
            <Text style={styles.resetButtonText}>
              {isResetting 
                ? "Resetting..." 
                : pendingConfirm 
                  ? "Confirm Reset (This Can't Be Undone)" 
                  : "Reset All Stats"}
            </Text>
          </Pressable>

          {pendingConfirm && (
            <Text style={styles.warningText}>
              This will permanently erase ALL stats, including survival, quick play, roll history,
              and behavioral data. Click the button again and enter the password to confirm.
            </Text>
          )}

          {resetMessage && (
            <Text style={[
              styles.resetMessage,
              resetMessage.includes('success') && styles.resetMessageSuccess,
              resetMessage.includes('Incorrect') && styles.resetMessageError,
            ]}>
              {resetMessage}
            </Text>
          )}
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F262A',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#E0B50C',
    marginBottom: 4,
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  titleSegment: {
    marginBottom: 0,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B949E',
    marginBottom: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#2A3136',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E0B50C',
    marginBottom: 12,
    textAlign: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  cardTitleSegment: {
    marginBottom: 0,
  },
  inlineFlameIcon: {
    marginHorizontal: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#8B949E',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  cardPressable: {
    alignItems: 'center',
  },
  cardPressed: {
    opacity: 0.85,
  },
  bigNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: '#F0F6FC',
    textAlign: 'center',
  },
  cardSubtext: {
    marginTop: 6,
    textAlign: 'center',
    color: '#8B949E',
    fontSize: 14,
  },
  statsTable: {
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  statLabel: {
    fontSize: 16,
    color: '#F0F6FC',
    fontWeight: '600',
    flex: 1,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  statLabelSegment: {
    flex: 0,
  },
  statValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statCount: {
    fontSize: 16,
    color: '#F0F6FC',
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'right',
  },
  statPercent: {
    fontSize: 14,
    color: '#8B949E',
    minWidth: 70,
    textAlign: 'right',
  },
  noDataText: {
    fontSize: 14,
    color: '#8B949E',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  backButton: {
    backgroundColor: '#53A7F3',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 16,
    marginBottom: 24,
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    color: '#F0F6FC',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F262A',
  },
  loadingText: {
    fontSize: 16,
    color: '#F0F6FC',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF3B30',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#F0F6FC',
    textAlign: 'center',
    marginBottom: 8,
  },
  backButtonTop: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backButtonTopText: {
    fontSize: 16,
    color: '#53A7F3',
    fontWeight: '600',
  },
  statCountLarge: {
    fontSize: 24,
    color: '#F0F6FC',
    fontWeight: '700',
  },
  statCountSmall: {
    fontSize: 13,
    color: '#8B949E',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  resetButton: {
    backgroundColor: '#C21807',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 12,
    alignItems: 'center',
  },
  resetButtonArmed: {
    backgroundColor: '#FF3B30',
  },
  resetButtonPressed: {
    opacity: 0.7,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  warningText: {
    fontSize: 13,
    color: '#E0B50C',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  resetMessage: {
    fontSize: 14,
    color: '#F0F6FC',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '600',
  },
  resetMessageSuccess: {
    color: '#53A7F3',
  },
  resetMessageError: {
    color: '#FF3B30',
  },
});
