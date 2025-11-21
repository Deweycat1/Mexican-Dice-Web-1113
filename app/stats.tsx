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

interface RollStatsData {
  rolls: Record<string, number>;
}

interface ClaimStatsData {
  claims: Record<string, number>;
}

interface RandomStatsData {
  honestyRating: number | null;
  mostCommonRoll: string | null;
  coldestRoll: string | null;
  averageTurnLengthMs: number | null;
  lowRollLieRate: number | null;
  totalRolls: number;
}

interface RollStat {
  roll: string;
  label: string;
  count: number;
  percentage: number;
}

interface ClaimStat {
  claim: string;
  label: string;
  count: number;
  percentage: number;
}

type StatView = 'menu' | 'rolls' | 'claims' | 'randomStats';


export default function StatsScreen() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<StatView>('menu');
  
  // Roll stats
  const [rollStats, setRollStats] = useState<RollStat[]>([]);
  const [totalRolls, setTotalRolls] = useState<number>(0);
  
  // Claim stats
  const [claimStats, setClaimStats] = useState<ClaimStat[]>([]);
  const [totalClaims, setTotalClaims] = useState<number>(0);
  
  // Random Stats (formerly Player Tendencies)
  const [randomStats, setRandomStats] = useState<RandomStatsData | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        
        // Fetch all APIs in parallel
        const [rollsRes, claimsRes, randomStatsRes] = await Promise.all([
          fetch(`${baseUrl}/api/roll-stats`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch(`${baseUrl}/api/claim-stats`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch(`${baseUrl}/api/random-stats`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
        ]);

        if (!rollsRes.ok) throw new Error('Failed to fetch roll stats');
        if (!claimsRes.ok) throw new Error('Failed to fetch claim stats');

        const rollsData: RollStatsData = await rollsRes.json();
        const claimsData: ClaimStatsData = await claimsRes.json();
        
        // Random stats might fail if no data yet
        if (randomStatsRes.ok) {
          const randomStatsData: RandomStatsData = await randomStatsRes.json();
          setRandomStats(randomStatsData);
        }

        // Process roll statistics
        const rolls = rollsData.rolls || {};
        const totalR = Object.values(rolls).reduce((sum, count) => sum + count, 0);
        setTotalRolls(totalR);
        const rollsArray: RollStat[] = Object.entries(rolls)
          .map(([roll, count]) => ({
            roll,
            label: getRollLabel(roll),
            count,
            percentage: totalR > 0 ? (count / totalR) * 100 : 0,
          }))
          .sort((a, b) => parseInt(a.roll, 10) - parseInt(b.roll, 10));
        setRollStats(rollsArray);

        // Process claim statistics
        const claims = claimsData.claims || {};
        const totalC = Object.values(claims).reduce((sum, count) => sum + count, 0);
        setTotalClaims(totalC);
        const claimsArray: ClaimStat[] = Object.entries(claims)
          .map(([claim, count]) => ({
            claim,
            label: getRollLabel(claim),
            count,
            percentage: totalC > 0 ? (count / totalC) * 100 : 0,
          }))
          .sort((a, b) => parseInt(a.claim, 10) - parseInt(b.claim, 10));
        setClaimStats(claimsArray);
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

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
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
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
          <Text style={styles.errorHint}>
            Make sure the Upstash KV database is connected to your Vercel project.
          </Text>
          <Pressable
            onPress={() => {
              setError(null);
              setIsLoading(true);
              // Re-trigger the effect by updating a key
              const fetchStats = async () => {
                setIsLoading(true);
                setError(null);

                try {
                  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                  
                  const [rollsResponse] = await Promise.all([
                    fetch(`${baseUrl}/api/roll-stats`, {
                      method: 'GET',
                      headers: { 'Content-Type': 'application/json' },
                    }),
                  ]);
                  
                  if (!rollsResponse.ok) {
                    throw new Error(`Roll stats API: ${rollsResponse.status}`);
                  }

                  const rollsData: RollStatsData = await rollsResponse.json();

                  const rolls = rollsData.rolls || {};
                  const total = Object.values(rolls).reduce((sum, count) => sum + count, 0);
                  setTotalRolls(total);

                  const statsArray: RollStat[] = Object.entries(rolls)
                    .map(([roll, count]) => ({
                      roll,
                      label: getRollLabel(roll),
                      count,
                      percentage: total > 0 ? (count / total) * 100 : 0,
                    }))
                    .sort((a, b) => parseInt(a.roll, 10) - parseInt(b.roll, 10));

                  setRollStats(statsArray);
                } catch (err) {
                  console.error('Error fetching stats:', err);
                  setError(err instanceof Error ? err.message : 'Failed to load statistics');
                } finally {
                  setIsLoading(false);
                }
              };
              fetchStats();
            }}
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Text style={styles.backButtonText}>Back to Menu</Text>
        </Pressable>
      </View>
    );
  }

  // Menu view
  const renderMenu = () => (
    <View style={styles.container}>
      <Text style={styles.title}>Global Statistics</Text>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.menuScrollContent}>
        <Pressable
          onPress={() => router.push('/roll-claim-comparison')}
          style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
        >
          <Text style={styles.menuButtonIcon}>🎲</Text>
          <Text style={styles.menuButtonTitle}>Roll vs Claim</Text>
          <Text style={styles.menuButtonDesc}>See how honest the table really is</Text>
        </Pressable>

        <Pressable
          onPress={() => setCurrentView('randomStats')}
          style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
        >
          <Text style={styles.menuButtonIcon}>🎯</Text>
          <Text style={styles.menuButtonTitle}>Random Stats</Text>
          <Text style={styles.menuButtonDesc}>Little mysteries hiding in your dice rolls</Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Text style={styles.backButtonText}>Back to Menu</Text>
        </Pressable>
      </ScrollView>
    </View>
  );

  // Roll Distribution view
  const renderRolls = () => (
    <View style={styles.container}>
      <Pressable onPress={() => setCurrentView('menu')} style={styles.backButtonTop}>
        <Text style={styles.backButtonTopText}>← Back</Text>
      </Pressable>
      
      <Text style={styles.title}>Roll Distribution</Text>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎲 Total Rolls Tracked</Text>
          <Text style={styles.bigNumber}>{totalRolls.toLocaleString()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Breakdown by Roll</Text>
          {rollStats.length === 0 ? (
            <Text style={styles.noDataText}>No rolls recorded yet</Text>
          ) : (
            <View style={styles.statsTable}>
              {rollStats.map((stat) => (
                <View key={stat.roll} style={styles.statRow}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <View style={styles.statValues}>
                    <Text style={styles.statCount}>{stat.count}</Text>
                    <Text style={styles.statPercent}>({stat.percentage.toFixed(2)}%)</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  // Win & Survival Stats view
  // Claim Distribution view
  const renderClaims = () => (
    <View style={styles.container}>
      <Pressable onPress={() => setCurrentView('menu')} style={styles.backButtonTop}>
        <Text style={styles.backButtonTopText}>← Back</Text>
      </Pressable>
      
      <Text style={styles.title}>Claim Distribution</Text>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🗣️ Total Claims Made</Text>
          <Text style={styles.bigNumber}>{totalClaims.toLocaleString()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Breakdown by Claim</Text>
          {claimStats.length === 0 ? (
            <Text style={styles.noDataText}>No claims recorded yet</Text>
          ) : (
            <View style={styles.statsTable}>
              {claimStats.map((stat) => (
                <View key={stat.claim} style={styles.statRow}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <View style={styles.statValues}>
                    <Text style={styles.statCount}>{stat.count}</Text>
                    <Text style={styles.statPercent}>({stat.percentage.toFixed(2)}%)</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  // Random Stats view (formerly Player Tendencies)
  const renderRandomStats = () => {
    const formatTurnLength = (ms: number | null): string => {
      if (ms === null) return '—';
      const seconds = ms / 1000;
      return `${seconds.toFixed(1)}s`;
    };

    const formatPercentage = (value: number | null): string => {
      if (value === null) return '—';
      return `${value.toFixed(0)}%`;
    };

    const formatRoll = (roll: string | null): string => {
      if (roll === null) return '—';
      return getRollLabel(roll);
    };

    return (
      <View style={styles.container}>
        <Pressable onPress={() => setCurrentView('menu')} style={styles.backButtonTop}>
          <Text style={styles.backButtonTopText}>← Back</Text>
        </Pressable>
        
        <Text style={styles.title}>Random Stats</Text>
        <Text style={styles.subtitle}>Little mysteries hiding in your dice rolls</Text>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {randomStats === null ? (
            <View style={styles.card}>
              <Text style={styles.noDataText}>
                Play a few games to unlock your Random Stats!
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🎭 Honesty Rating</Text>
                <Text style={styles.bigNumber}>{formatPercentage(randomStats.honestyRating)}</Text>
                <Text style={styles.tendencyDescription}>
                  How often you tell the truth instead of bluffing
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>🎲 Most Common Roll</Text>
                <Text style={styles.bigNumber}>{formatRoll(randomStats.mostCommonRoll)}</Text>
                <Text style={styles.tendencyDescription}>
                  Your most frequently rolled combo
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>❄️ Coldest Roll</Text>
                <Text style={styles.bigNumber}>{formatRoll(randomStats.coldestRoll)}</Text>
                <Text style={styles.tendencyDescription}>
                  The roll that almost never shows up for you
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>⏱️ Average Turn Length</Text>
                <Text style={styles.bigNumber}>{formatTurnLength(randomStats.averageTurnLengthMs)}</Text>
                <Text style={styles.tendencyDescription}>
                  How long you typically take to make a move
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>🃏 Low-Roll Lie Rate</Text>
                <Text style={styles.bigNumber}>{formatPercentage(randomStats.lowRollLieRate)}</Text>
                <Text style={styles.tendencyDescription}>
                  How often you bluff when you roll below a 61
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0FA958" />
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
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
          <Text style={styles.errorHint}>
            Make sure the Upstash KV database is connected to your Vercel project.
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Text style={styles.backButtonText}>Back to Menu</Text>
        </Pressable>
      </View>
    );
  }

  // Render based on current view
  switch (currentView) {
    case 'rolls':
      return renderRolls();
    case 'claims':
      return renderClaims();
    case 'randomStats':
      return renderRandomStats();
    default:
      return renderMenu();
  }
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
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#CCCCCC',
    marginBottom: 16,
    marginTop: -8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  menuScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexGrow: 1,
    justifyContent: 'center',
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
  errorHint: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#0FA958',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  menuButton: {
    backgroundColor: '#115E38',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  menuButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  menuButtonIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  menuButtonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E6FFE6',
    marginBottom: 8,
    textAlign: 'center',
  },
  menuButtonDesc: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
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
  tendencyDescription: {
    fontSize: 13,
    color: '#CCCCCC',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
