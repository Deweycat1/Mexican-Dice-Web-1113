import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FlameEmojiIcon } from '../src/components/FlameEmojiIcon';
import IceEmojiIcon from '../src/components/IceEmojiIcon';
interface RollStatsData {
  rolls: Record<string, number>;
}

interface ClaimStatsData {
  claims: Record<string, number>;
}

type RollClaimRow = {
  roll: string;
  label: string;
  rollCount: number;
  rollPercentage: number;
  claimCount: number;
  claimPercentage: number;
  bluffBias: number; // claimPercentage - rollPercentage
};

type BluffCategory = 'over' | 'under' | 'balanced';
type InsightKind = BluffCategory;

export default function RollClaimComparisonScreen() {
  const router = useRouter();
  
  const [data, setData] = useState<RollClaimRow[]>([]);
  const [totalRolls, setTotalRolls] = useState<number>(0);
  const [totalClaims, setTotalClaims] = useState<number>(0);
  const [mostOverhyped, setMostOverhyped] = useState<RollClaimRow | null>(null);
  const [mostAvoided, setMostAvoided] = useState<RollClaimRow | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      
      const [rollsRes, claimsRes] = await Promise.all([
        fetch(`${baseUrl}/api/roll-stats`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
        fetch(`${baseUrl}/api/claim-stats`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
      ]);

      if (!rollsRes.ok) throw new Error('Failed to fetch roll stats');
      if (!claimsRes.ok) throw new Error('Failed to fetch claim stats');

      const rollsData: RollStatsData = await rollsRes.json();
      const claimsData: ClaimStatsData = await claimsRes.json();

      // Process data
      const rolls = rollsData.rolls || {};
      const claims = claimsData.claims || {};

      const totalR = Object.values(rolls).reduce((sum, count) => sum + count, 0);
      const totalC = Object.values(claims).reduce((sum, count) => sum + count, 0);
      
      setTotalRolls(totalR);
      setTotalClaims(totalC);

      // Get all unique rolls from both datasets
      const allRolls = new Set([...Object.keys(rolls), ...Object.keys(claims)]);
      
      const merged: RollClaimRow[] = Array.from(allRolls)
        .map((roll) => {
          const rollCount = rolls[roll] || 0;
          const claimCount = claims[roll] || 0;
          const rollPercentage = totalR > 0 ? (rollCount / totalR) * 100 : 0;
          const claimPercentage = totalC > 0 ? (claimCount / totalC) * 100 : 0;
          const bluffBias = claimPercentage - rollPercentage;

          return {
            roll,
            label: getRollLabel(roll),
            rollCount,
            rollPercentage,
            claimCount,
            claimPercentage,
            bluffBias,
          };
        })
        .sort((a, b) => parseInt(a.roll, 10) - parseInt(b.roll, 10));

      setData(merged);

      // Find most overhyped (highest positive bias)
      const overhyped = merged.reduce((max, row) => 
        row.bluffBias > (max?.bluffBias || 0) ? row : max
      , null as RollClaimRow | null);
      setMostOverhyped(overhyped);

      // Find most avoided (most negative bias)
      const avoided = merged.reduce((min, row) => 
        row.bluffBias < (min?.bluffBias || 0) ? row : min
      , null as RollClaimRow | null);
      setMostAvoided(avoided);

    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const getBluffCategory = (bias: number): BluffCategory => {
    if (bias > 3) return 'over';
    if (bias < -3) return 'under';
    return 'balanced';
  };

  const getCategoryEmoji = (category: BluffCategory): string => {
    if (category === 'balanced') {
      return '⚖️';
    }
    return '';
  };

  const getCategoryLabel = (category: BluffCategory): string => {
    switch (category) {
      case 'over':
        return 'Over-claimed';
      case 'under':
        return 'Under-claimed';
      case 'balanced':
        return 'Balanced';
    }
  };

  const InsightCell: React.FC<{ kind: InsightKind }> = ({ kind }) => {
    const config: { icon: React.ReactNode; label: string } =
      kind === 'balanced'
        ? { icon: <Text>⚖️</Text>, label: getCategoryLabel('balanced') }
        : kind === 'over'
        ? { icon: <FlameEmojiIcon size={16} />, label: getCategoryLabel('over') }
        : { icon: <IceEmojiIcon size={16} />, label: getCategoryLabel('under') };

    return (
      <View style={styles.insightCell}>
        <View style={styles.insightIcon}>{config.icon}</View>
        <Text style={styles.insightText}>{config.label}</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerBackVisible: false,
            headerLeft: () => null,
          }}
        />
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#53A7F3" />
            <Text style={styles.loadingText}>Loading statistics...</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen
          options={{
            headerBackVisible: false,
            headerLeft: () => null,
          }}
        />
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error Loading Stats</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={fetchStats}
              style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const renderRow = ({ item }: { item: RollClaimRow }) => {
    const category = getBluffCategory(item.bluffBias);

    return (
      <View style={styles.tableRow}>
        <Text style={styles.rollCell}>{item.label}</Text>
        
        <View style={styles.dataCell}>
          <Text style={[styles.cellText, styles.cellTextRolled]}>
            {item.rollCount} ({item.rollPercentage.toFixed(2)}%)
          </Text>
          <View style={[styles.miniBar, { width: `${Math.min(100, item.rollPercentage * 3)}%` }]} />
        </View>
        
        <View style={styles.dataCell}>
          <Text style={[styles.cellText, styles.cellTextClaimed]}>
            {item.claimCount} ({item.claimPercentage.toFixed(2)}%)
          </Text>
          <View style={[styles.miniBar, styles.miniBarClaim, { width: `${Math.min(100, item.claimPercentage * 3)}%` }]} />
        </View>
        
        <Text style={[styles.diffCell, item.bluffBias > 0 ? styles.diffPositive : styles.diffNegative]}>
          {item.bluffBias > 0 ? '+' : ''}{item.bluffBias.toFixed(2)}%
        </Text>

        <InsightCell kind={category} />
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerLeft: () => null,
        }}
      />
      <View style={styles.container}>
        <Text style={styles.title}>Roll vs Claim</Text>
        <Text style={styles.subtitle}>See how honest the table really is</Text>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Highlight Cards */}
          <View style={styles.highlightRow}>
            <View style={styles.highlightCard}>
              <Text style={styles.highlightIcon}>🎲</Text>
              <Text style={styles.highlightValue}>{totalRolls.toLocaleString()}</Text>
              <Text style={styles.highlightLabel}>Rolls Tracked</Text>
            </View>

            <View style={styles.highlightCard}>
              <Text style={styles.highlightIcon}>🗣️</Text>
              <Text style={styles.highlightValue}>{totalClaims.toLocaleString()}</Text>
              <Text style={styles.highlightLabel}>Claims Made</Text>
            </View>
          </View>

          <View style={styles.highlightRow}>
            {mostOverhyped && mostOverhyped.bluffBias > 3 && (
              <View style={[styles.highlightCard, styles.highlightCardWide]}>
                <View style={styles.highlightIconWrapper}>
                  <FlameEmojiIcon size={32} />
                </View>
                <Text style={styles.highlightValue}>{mostOverhyped.label}</Text>
                <Text style={styles.highlightLabel}>Most Overhyped</Text>
                <Text style={styles.highlightDetail}>
                  Claimed {mostOverhyped.claimPercentage.toFixed(1)}% vs rolled {mostOverhyped.rollPercentage.toFixed(1)}%
                </Text>
              </View>
            )}

            {mostAvoided && mostAvoided.bluffBias < -3 && (
              <View style={[styles.highlightCard, styles.highlightCardWide]}>
                <IceEmojiIcon size={32} style={styles.highlightIceIcon} />
                <Text style={styles.highlightValue}>{mostAvoided.label}</Text>
                <Text style={styles.highlightLabel}>Most Avoided</Text>
                <Text style={styles.highlightDetail}>
                  Claimed {mostAvoided.claimPercentage.toFixed(1)}% vs rolled {mostAvoided.rollPercentage.toFixed(1)}%
                </Text>
              </View>
            )}
          </View>

          {/* Table Header */}
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={styles.headerCell}>Roll</Text>
              <Text style={styles.headerCell}>Rolled</Text>
              <Text style={styles.headerCell}>Claimed</Text>
              <Text style={styles.headerCell}>Diff</Text>
              <Text style={styles.headerCell}>Insight</Text>
            </View>

            {/* Table Body */}
            {data.length > 0 ? (
              data.map((item) => (
                <View key={item.roll}>
                  {renderRow({ item })}
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>No data available yet</Text>
            )}
          </View>

          {/* TODO: Claim Accuracy Section */}
          {/* Add claim accuracy calculation when correct/incorrect claim data becomes available */}

          {/* Bottom Menu Button */}
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.bottomMenuButton, pressed && styles.bottomMenuButtonPressed]}
          >
            <Text style={styles.bottomMenuButtonText}>Back to Menu</Text>
          </Pressable>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B1D1F',
    paddingTop: 50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  backButtonTop: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButtonTopText: {
    color: '#53A7F3',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 24,
  },
  highlightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  highlightCard: {
    flex: 1,
    backgroundColor: '#2A3136',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363D',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightCardWide: {
    flex: 1,
  },
  highlightIcon: {
    fontSize: 32,
    marginBottom: 8,
    textAlign: 'center',
  },
  highlightIceIcon: {
    marginBottom: 8,
  },
  highlightIconWrapper: {
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  highlightLabel: {
    fontSize: 12,
    color: '#8B949E',
    textAlign: 'center',
  },
  highlightDetail: {
    fontSize: 11,
    color: '#8B949E',
    textAlign: 'center',
    marginTop: 4,
  },
  tableContainer: {
    backgroundColor: '#2A3136',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363D',
    padding: 16,
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#30363D',
    paddingBottom: 12,
    marginBottom: 12,
  },
  headerCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#FE9902',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  rollCell: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  dataCell: {
    flex: 1,
    alignItems: 'center',
  },
  cellText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 4,
  },
  cellTextRolled: {
    color: '#53A7F3',
    fontWeight: '600',
  },
  cellTextClaimed: {
    color: '#FE9902',
    fontWeight: '600',
  },
  miniBar: {
    height: 4,
    backgroundColor: '#53A7F3',
    borderRadius: 2,
    minWidth: 2,
  },
  miniBarClaim: {
    backgroundColor: '#FE9902',
  },
  diffCell: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  diffPositive: {
    color: '#FF6B6B',
  },
  diffNegative: {
    color: '#53A7F3',
  },
  insightCell: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightIcon: {
    width: 22,
    textAlign: 'center',
    marginRight: 4,
  },
  insightText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#F0F6FC',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B6B',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#8B949E',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#53A7F3',
    borderColor: '#1C75BC',
    borderWidth: 2,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryButtonText: {
    color: '#F0F6FC',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  noDataText: {
    fontSize: 14,
    color: '#8B949E',
    textAlign: 'center',
    paddingVertical: 20,
  },
  bottomMenuButton: {
    backgroundColor: '#53A7F3',
    borderColor: '#1C75BC',
    borderWidth: 2,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  bottomMenuButtonPressed: {
    opacity: 0.7,
  },
  bottomMenuButtonText: {
    color: '#F0F6FC',
    fontSize: 16,
    fontWeight: '700',
  },
});
