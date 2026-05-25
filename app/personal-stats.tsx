import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '../src/components/AppText';
import StyledButton from '../src/components/StyledButton';
import {
  getMySupabasePlayerStats,
  SupabasePlayerStats,
} from '../src/stats/supabasePlayerStats';

const formatPercent = (rate: number, sampleSize: number) =>
  sampleSize > 0 ? `${(rate * 100).toFixed(1)}%` : '-';

const formatAverage = (value: number, sampleSize: number) =>
  sampleSize > 0 ? value.toFixed(2) : '-';

const formatRoll = (roll: string | null) => {
  switch (roll) {
    case '21':
      return '21 (Inferno)';
    case '31':
      return '31 (Reverse)';
    case '41':
      return '41 (Social)';
    case null:
      return '-';
    default:
      return roll;
  }
};

const StatRow = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <View style={styles.statRow}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const StatsCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    <View style={styles.statsTable}>{children}</View>
  </View>
);

export default function PersonalStatsScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<SupabasePlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        try {
          setLoading(true);
          setError(null);
          const data = await getMySupabasePlayerStats();
          if (active) {
            setStats(data);
          }
        } catch (err) {
          console.error('Failed to load personal stats', err);
          if (active) {
            setError('Unable to load personal stats right now.');
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      void load();

      return () => {
        active = false;
      };
    }, [])
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={[styles.card, styles.centerContent]}>
          <ActivityIndicator size="large" color="#53A7F3" />
          <Text style={styles.loadingText}>Loading personal stats...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={[styles.card, styles.centerContent]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    if (!stats) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No Stats Yet</Text>
          <Text style={styles.noDataText}>
            Play a few rounds to start building your personal profile.
          </Text>
        </View>
      );
    }

    const totalDecidedGames = stats.wins + stats.losses;
    const quickPlayWinRate =
      stats.quickPlayGames > 0 ? stats.quickPlayWins / stats.quickPlayGames : 0;
    const onlineWinRate =
      stats.onlineGames > 0 ? stats.onlineWins / stats.onlineGames : 0;

    return (
      <>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Total Games</Text>
          <Text style={styles.heroNumber}>{stats.gamesPlayed.toLocaleString()}</Text>
          <Text style={styles.heroSubtext}>
            {stats.wins.toLocaleString()} wins / {stats.losses.toLocaleString()} losses
          </Text>
        </View>

        <StatsCard title="Mode Performance">
          <StatRow
            label="Overall Win Rate"
            value={formatPercent(
              totalDecidedGames > 0 ? stats.wins / totalDecidedGames : 0,
              totalDecidedGames
            )}
          />
          <StatRow
            label="Quick Play"
            value={`${stats.quickPlayWins} / ${stats.quickPlayGames} (${formatPercent(
              quickPlayWinRate,
              stats.quickPlayGames
            )})`}
          />
          <StatRow
            label="Online"
            value={`${stats.onlineWins} / ${stats.onlineGames} (${formatPercent(
              onlineWinRate,
              stats.onlineGames
            )})`}
          />
          <StatRow label="Inferno Runs" value={stats.survivalRuns} />
          <StatRow label="Best Inferno Streak" value={stats.survivalBest} />
          <StatRow
            label="Average Inferno Streak"
            value={formatAverage(stats.averageSurvivalStreak, stats.survivalRuns)}
          />
        </StatsCard>

        <StatsCard title="Streaks">
          <StatRow label="Current Win Streak" value={stats.currentWinStreak} />
          <StatRow label="Longest Win Streak" value={stats.longestWinStreak} />
          <StatRow label="Current Loss Streak" value={stats.currentLossStreak} />
          <StatRow label="Longest Loss Streak" value={stats.longestLossStreak} />
        </StatsCard>

        <StatsCard title="Bluffing Profile">
          <StatRow
            label="Honesty Rate"
            value={formatPercent(stats.honestyRate, stats.claimsTotal)}
          />
          <StatRow label="Truthful Claims" value={stats.truthfulClaims} />
          <StatRow label="Bluff Claims" value={stats.bluffClaims} />
          <StatRow
            label="Bluff Call Accuracy"
            value={formatPercent(stats.bluffCallAccuracy, stats.bluffCallsTotal)}
          />
          <StatRow label="Bluff Calls Won" value={`${stats.bluffCallsCorrect} / ${stats.bluffCallsTotal}`} />
        </StatsCard>

        <StatsCard title="Dice Profile">
          <StatRow label="Rolls Tracked" value={stats.rollsTotal} />
          <StatRow label="Claims Tracked" value={stats.claimsTotal} />
          <StatRow
            label="Favorite Roll"
            value={`${formatRoll(stats.favoriteRoll)} (${stats.favoriteRollCount})`}
          />
          <StatRow
            label="Favorite Claim"
            value={`${formatRoll(stats.favoriteClaim)} (${stats.favoriteClaimCount})`}
          />
        </StatsCard>

        <StatsCard title="Special Rolls">
          <StatRow
            label="21 Inferno Rolled / Claimed"
            value={`${stats.rolls21} / ${stats.claims21}`}
          />
          <StatRow
            label="31 Reverse Rolled / Claimed"
            value={`${stats.rolls31} / ${stats.claims31}`}
          />
          <StatRow
            label="41 Social Rolled / Claimed"
            value={`${stats.rolls41} / ${stats.claims41}`}
          />
        </StatsCard>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Personal Stats</Text>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {renderContent()}
          <View style={styles.footer}>
            <StyledButton
              label="Back to Stats"
              onPress={() => router.push('/statistics')}
              style={styles.backButton}
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1F262A',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F0F6FC',
    marginBottom: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#2A3136',
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
    borderWidth: 1,
    borderColor: '#30363D',
  },
  heroCard: {
    backgroundColor: '#2A3136',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CCCCCC',
    textTransform: 'uppercase',
  },
  heroNumber: {
    fontSize: 52,
    fontWeight: '800',
    color: '#53A7F3',
    marginTop: 4,
  },
  heroSubtext: {
    fontSize: 15,
    color: '#F0F6FC',
    marginTop: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F0F6FC',
    marginBottom: 12,
    textAlign: 'center',
  },
  statsTable: {
    marginTop: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
    gap: 12,
  },
  statLabel: {
    flex: 1,
    fontSize: 15,
    color: '#CCCCCC',
  },
  statValue: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#F0F6FC',
    textAlign: 'right',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#F0F6FC',
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  backButton: {
    width: '80%',
    maxWidth: 320,
  },
});
