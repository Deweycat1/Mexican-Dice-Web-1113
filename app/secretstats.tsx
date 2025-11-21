import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

interface CityStatsData {
  uniqueCities: number;
  stats: Record<string, number>;
}

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
  average: number;
}

interface WinStatsData {
  playerWins: number;
  cpuWins: number;
}

interface UniqueDevicesData {
// City stats API response
  count: number;
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
  claimsRisk: {
    safest: {
      code: string;
      wins: number;
      losses: number;
      winRate: number;
    } | null;
    mostDangerous: {
      code: string;
      wins: number;
      losses: number;
      winRate: number;
    } | null;
    all: {
      [code: string]: {
        wins: number;
        losses: number;
        winRate: number;
        uses: number;
      };
    };
  };
}

export default function SecretStatsScreen() {
  // City stats
  const [cityStats, setCityStats] = useState<CityStatsData | null>(null);
  const router = useRouter();
  
  // Win/Survival stats
  const [survivalBest, setSurvivalBest] = useState<SurvivalBestData | null>(null);
  const [quickPlayBest, setQuickPlayBest] = useState<QuickPlayBestData | null>(null);
  const [averageStreak, setAverageStreak] = useState<number | null>(null);
  const [playerWins, setPlayerWins] = useState<number>(0);
  const [cpuWins, setCpuWins] = useState<number>(0);
  const [uniqueDevices, setUniqueDevices] = useState<number>(0);
  
  // Behavior stats (rival behavior and bluff calls)
  const [behaviorStats, setBehaviorStats] = useState<BehaviorStats | null>(null);
  
  // Meta stats (honesty, aggression, claims risk, roll rarity)
  const [metaStats, setMetaStats] = useState<MetaStats | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Reset stats state
  const [pendingConfirm, setPendingConfirm] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        
        // Fetch all relevant APIs
        const [
          survivalBestRes,
          quickPlayBestRes,
          survivalAvgRes,
          winsRes,
          uniqueDevicesRes,
          behaviorRes,
          metaRes,
          cityStatsRes
        ] = await Promise.all([
          fetch(`${baseUrl}/api/survival-best`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch(`${baseUrl}/api/quickplay-best`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch(`${baseUrl}/api/survival-average`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch(`${baseUrl}/api/win-stats`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch(`${baseUrl}/api/update-unique-devices`, {
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
          fetch(`${baseUrl}/api/city-stats`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
        ]);
        // Parse city stats
        try {
          if (cityStatsRes.ok) {
            const cityStatsData: CityStatsData = await cityStatsRes.json();
            setCityStats(cityStatsData);
          }
        } catch {
          console.log('City stats not available yet');
        }

        if (!survivalBestRes.ok) throw new Error('Failed to fetch survival best');
        if (!quickPlayBestRes.ok) throw new Error('Failed to fetch quick play best');
        if (!survivalAvgRes.ok) throw new Error('Failed to fetch survival average');
        if (!winsRes.ok) throw new Error('Failed to fetch win stats');

        const survivalBestData: SurvivalBestData = await survivalBestRes.json();
        const quickPlayBestData: QuickPlayBestData = await quickPlayBestRes.json();
        const survivalAvgData: SurvivalAverageData = await survivalAvgRes.json();
        const winsData: WinStatsData = await winsRes.json();
        
        // Fetch unique devices count (non-critical)
        try {
          if (uniqueDevicesRes.ok) {
            const uniqueDevicesData: UniqueDevicesData = await uniqueDevicesRes.json();
            setUniqueDevices((uniqueDevicesData as any).count ?? 0);
          }
        } catch {
          console.log('Unique devices count not available yet');
        }
        
        // Parse behavior and meta stats (with error handling)
        try {
          if (behaviorRes.ok) {
            const behaviorData: BehaviorStats = await behaviorRes.json();
            setBehaviorStats(behaviorData);
          }
        } catch {
          console.log('Behavior stats not available yet');
        }

        try {
          if (metaRes.ok) {
            const metaData: MetaStats = await metaRes.json();
            setMetaStats(metaData);
          }
        } catch {
          console.log('Meta stats not available yet');
        }

        // Set survival stats
        setSurvivalBest(survivalBestData);
        setQuickPlayBest(quickPlayBestData);
        setAverageStreak(survivalAvgData.average ?? 0);

        // Set win stats
        setPlayerWins(winsData.playerWins ?? 0);
        setCpuWins(winsData.cpuWins ?? 0);
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

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
      "FINAL WARNING: This will permanently delete ALL stats for Mexican Dice. This cannot be undone. Continue?"
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
        return '21 (Mexican)';
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
          <ActivityIndicator size="large" color="#0FA958" />
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

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.push('/')} style={styles.backButtonTop}>
        <Text style={styles.backButtonTopText}>← Back</Text>
      </Pressable>
      
      <Text style={styles.title}>Win & Survival Stats</Text>
      <Text style={styles.subtitle}>🔒 Hidden Analytics</Text>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Unique Cities Played Card */}
        {cityStats && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🌍 Unique Cities Played From</Text>
            <Text style={styles.bigNumber}>{cityStats.uniqueCities}</Text>
            <Text style={styles.cardSubtitle}>Total unique cities/regions/countries</Text>
            <View style={{ marginTop: 12 }}>
              <Text style={styles.cardTitle}>City Sessions</Text>
              <View style={styles.statsTable}>
                {Object.entries(cityStats.stats as Record<string, number>)
                  .sort((a, b) => b[1] - a[1])
                  .map(([city, count]) => (
                    <View key={city} style={styles.statRow}>
                      <Text style={styles.statLabel}>{city}</Text>
                      <Text style={styles.statCount}>{count}</Text>
                    </View>
                  ))}
              </View>
            </View>
          </View>
        )}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📱 Unique Devices Played</Text>
          <Text style={styles.bigNumber}>{uniqueDevices.toLocaleString()}</Text>
          <Text style={styles.cardSubtitle}>Total devices that have opened the game</Text>
        </View>

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
              <Text style={styles.statLabel}>The Rival</Text>
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
          <Text style={styles.cardTitle}>🔥 Survival Mode</Text>
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
                <Text style={styles.statLabel}>Rival Accuracy</Text>
                <Text style={styles.statCountLarge}>
                  {(behaviorStats.bluffCalls.rival.accuracy * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Rival Behavior */}
        {behaviorStats?.rival && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🤖 The Rival&apos;s Behavior (Global)</Text>
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
                <Text style={styles.statLabel}>Rival Aggression Index</Text>
                <Text style={styles.statCountLarge}>
                  {metaStats.aggression.rival.index.toFixed(1)}/100
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Safest & Most Dangerous Claims */}
        {metaStats?.claimsRisk && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚠️ Claim Risk Analysis</Text>
            <View style={styles.statsTable}>
              {metaStats.claimsRisk.safest ? (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Safest Claim</Text>
                  <Text style={styles.statCountLarge}>
                    {getRollLabel(metaStats.claimsRisk.safest.code)} ({(metaStats.claimsRisk.safest.winRate * 100).toFixed(1)}% win rate)
                  </Text>
                </View>
              ) : (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Safest Claim</Text>
                  <Text style={styles.noDataText}>Not enough data (need 5+ uses)</Text>
                </View>
              )}
              {metaStats.claimsRisk.mostDangerous ? (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Most Dangerous Claim</Text>
                  <Text style={styles.statCountLarge}>
                    {getRollLabel(metaStats.claimsRisk.mostDangerous.code)} ({(metaStats.claimsRisk.mostDangerous.winRate * 100).toFixed(1)}% win rate)
                  </Text>
                </View>
              ) : (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Most Dangerous Claim</Text>
                  <Text style={styles.noDataText}>Not enough data (need 5+ uses)</Text>
                </View>
              )}
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
    backgroundColor: '#0B3A26',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E6FFE6',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E0B50C',
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
    backgroundColor: '#115E38',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E6FFE6',
    marginBottom: 12,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  bigNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: '#0FA958',
    textAlign: 'center',
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
    borderBottomColor: 'rgba(230, 255, 230, 0.1)',
  },
  statLabel: {
    fontSize: 16,
    color: '#E6FFE6',
    fontWeight: '600',
    flex: 1,
  },
  statValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statCount: {
    fontSize: 16,
    color: '#0FA958',
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'right',
  },
  statPercent: {
    fontSize: 14,
    color: '#CCCCCC',
    minWidth: 70,
    textAlign: 'right',
  },
  noDataText: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  backButton: {
    backgroundColor: '#C21807',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#E6FFE6',
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
    color: '#E6FFE6',
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
    color: '#0FA958',
    fontWeight: '600',
  },
  statCountLarge: {
    fontSize: 24,
    color: '#0FA958',
    fontWeight: '700',
  },
  statCountSmall: {
    fontSize: 13,
    color: '#CCCCCC',
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
    color: '#FF9500',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  resetMessage: {
    fontSize: 14,
    color: '#E6FFE6',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '600',
  },
  resetMessageSuccess: {
    color: '#0FA958',
  },
  resetMessageError: {
    color: '#FF3B30',
  },
});
