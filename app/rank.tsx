import { useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StyledButton from '../src/components/StyledButton';
import { getPersonalStats, PersonalStats } from '../src/stats/personalStats';
import type { PlayerRank } from '../src/stats/rank';
import {
  getMyRank,
  getRankTier,
  getTop10Ranks,
  getTopBluffersBySuccess,
  getTopSurvivalPlayers,
} from '../src/stats/rank';

const formatDays = (value: number) => `${value} ${value === 1 ? 'day' : 'days'}`;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  const bigint = parseInt(h, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
};
const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;

const getTopPercentColor = (topPercent: number) => {
  const t = clamp01((topPercent - 1) / 99);
  const blue = hexToRgb('#53A7F3');
  const red = hexToRgb('#FF4D4D');

  const r = lerp(red.r, blue.r, t);
  const g = lerp(red.g, blue.g, t);
  const b = lerp(red.b, blue.b, t);

  return rgbToHex(r, g, b);
};

const getTierColor = (tier: string) => {
  switch (tier) {
    case 'Inferno':
      return '#FF4D4D';
    case 'Blaze':
      return '#FF7A1A';
    case 'Ember':
      return '#FE9902';
    case 'Cinder':
      return '#F2C94C';
    case 'Ash':
      return '#53A7F3';
    default:
      return '#53A7F3';
  }
};

export default function RankScreen() {
  const router = useRouter();
  const [myRank, setMyRank] = useState<PlayerRank | null>(null);
  const [top10, setTop10] = useState<PlayerRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topBluffers, setTopBluffers] = useState<PlayerRank[]>([]);
  const [topSurvivors, setTopSurvivors] = useState<PlayerRank[]>([]);
  const [personalStats, setPersonalStats] = useState<PersonalStats | null>(null);
  const [personalStatsLoading, setPersonalStatsLoading] = useState(true);
  const [personalStatsError, setPersonalStatsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [rank, leaderboard, bluffers, survivors] = await Promise.all([
          getMyRank(),
          getTop10Ranks(),
          getTopBluffersBySuccess(5),
          getTopSurvivalPlayers(5, 1),
        ]);

        if (cancelled) return;

        setMyRank(rank);
        setTop10(leaderboard);
        setTopBluffers(bluffers);
        setTopSurvivors(survivors);
      } catch (err) {
        console.error('Failed to load rank data', err);
        if (!cancelled) {
          setError('Unable to load ranking data right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadPersonalStats = async () => {
        try {
          setPersonalStatsLoading(true);
          setPersonalStatsError(null);
          const data = await getPersonalStats();
          if (isActive) {
            setPersonalStats(data);
          }
        } catch (err) {
          console.error('Failed to load personal stats', err);
          if (isActive) {
            setPersonalStatsError('Unable to load your stats right now.');
          }
        } finally {
          if (isActive) {
            setPersonalStatsLoading(false);
          }
        }
      };

      void loadPersonalStats();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const renderMyRankCard = () => {
    if (loading) {
      return (
        <View style={[styles.card, styles.centerContent]}>
          <ActivityIndicator size="large" color="#53A7F3" />
          <Text style={styles.loadingText}>Loading rank...</Text>
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

    if (!myRank) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Rank in the Inferno</Text>
          <Text style={styles.noDataText}>
            No rank yet. Play a few games in Quick Play, Survival, or Online to earn your first
            Inferno rating.
          </Text>
        </View>
      );
    }

    const tier = getRankTier(myRank.infernoRating);
    const percentile = myRank.percentile ?? 0;
    const topPercent = Math.max(1, 100 - Math.round(percentile * 100));
    const percentColor = getTopPercentColor(topPercent);
    const winRate =
      myRank.gamesPlayed > 0
        ? Math.round((myRank.wins / myRank.gamesPlayed) * 100)
        : 0;

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Rank in the Inferno</Text>
        <View style={styles.rankMainRow}>
          <View style={styles.rankTierBlock}>
            <Text style={styles.rankTierText}>{tier}</Text>
            <Text style={styles.rankRatingText}>{myRank.infernoRating}</Text>
            <Text style={[styles.rankSubText, styles.rankSubTextBold]}>
              Top{' '}
              <Text
                style={[
                  styles.rankSubTextBold,
                  styles.rankPercent,
                  { color: percentColor },
                ]}
              >
                {topPercent}%
              </Text>{' '}
              of players worldwide
            </Text>
          </View>
        </View>
        <View style={styles.rankStatsRow}>
          <View style={styles.rankStatItem}>
            <Text style={styles.rankStatLabel}>Games Played</Text>
            <Text style={styles.rankStatValue}>{myRank.gamesPlayed}</Text>
          </View>
          <View style={styles.rankStatItem}>
            <Text style={styles.rankStatLabel}>Wins / Losses</Text>
            <Text style={styles.rankStatValue}>
              {myRank.wins} / {myRank.losses}
            </Text>
          </View>
          <View style={styles.rankStatItem}>
            <Text style={styles.rankStatLabel}>Win Rate</Text>
            <Text style={styles.rankStatValue}>{winRate}%</Text>
          </View>
          <View style={styles.rankStatItem}>
            <Text style={styles.rankStatLabel}>Best Survival Streak</Text>
            <Text style={styles.rankStatValue}>{myRank.survivalBest}</Text>
          </View>
        </View>

        <View style={styles.sectionDivider} />
        {personalStatsLoading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator color="#FE9902" />
            <Text style={styles.loadingText}>Loading your stats...</Text>
          </View>
        ) : personalStatsError ? (
          <Text style={styles.errorText}>{personalStatsError}</Text>
        ) : !personalStats ? (
          <Text style={styles.noDataText}>
            No personal stats yet. Play a few games to start tracking your progress.
          </Text>
        ) : (
          <>
            <Text style={styles.sectionLabel}>PERSONAL STATS</Text>
            <View style={styles.rankStatsRow}>
              <View style={styles.rankStatItem}>
                <Text style={styles.rankStatLabel}>Total Games</Text>
                <Text style={styles.rankStatValue}>{personalStats.totalGamesPlayed}</Text>
              </View>
              <View style={styles.rankStatItem}>
                <Text style={styles.rankStatLabel}>Daily Streak</Text>
                <Text style={styles.rankStatValue}>
                  {formatDays(personalStats.currentDailyStreak)}
                </Text>
              </View>
              <View style={styles.rankStatItem}>
                <Text style={styles.rankStatLabel}>Days Played</Text>
                <Text style={styles.rankStatValue}>{personalStats.totalDaysPlayed}</Text>
              </View>
              <View style={styles.rankStatItem}>
                <Text style={styles.rankStatLabel}>Bluff Calls Won</Text>
                <Text style={styles.rankStatValue}>
                  {typeof myRank.correctBluffEvents === 'number'
                    ? myRank.correctBluffEvents
                    : '—'}
                </Text>
              </View>
              <View style={styles.rankStatItem}>
                <Text style={styles.rankStatLabel}>Most Common Roll</Text>
                <Text style={styles.rankStatValue}>
                  {personalStats.mostCommonRollLifetime ?? '—'}
                </Text>
              </View>
              <View style={styles.rankStatItem}>
                <Text style={styles.rankStatLabel}>Successful Bluffs</Text>
                <Text style={styles.rankStatValue}>
                  {personalStats.successfulBluffsLifetime}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    );
  };

  const renderLeaderboard = () => {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hall of Flame – Top 10</Text>
        {top10.length === 0 ? (
          <Text style={styles.noDataText}>
            No ranked players yet. Come back after more games have been played.
          </Text>
        ) : (
          <View style={styles.leaderboardContainer}>
            {top10.map((p, index) => {
              const tier = getRankTier(p.infernoRating);
              const isMe = !!myRank && myRank.userId === p.userId;
              return (
                <View
                  key={p.userId}
                  style={[styles.leaderRow, isMe && styles.leaderRowMe]}
                >
                  <Text style={styles.leaderRank}>#{index + 1}</Text>
                  <View style={styles.leaderMiddle}>
                    <Text
                      style={styles.leaderName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {p.username}
                    </Text>
                    <Text style={styles.leaderTier}>{tier}</Text>
                  </View>
                  <View style={styles.leaderRight}>
                    <Text style={styles.leaderRating}>{p.infernoRating}</Text>
                    <Text style={styles.leaderGames}>
                      {p.gamesPlayed} game{p.gamesPlayed === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const renderBluffLegend = () => {
    if (loading) {
      // Main loading state already shows a spinner; no need to duplicate here
      return null;
    }

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bluff Legend</Text>
        {topBluffers.length === 0 ? (
          <Text style={styles.noDataText}>
            No bluff data yet. Call a few bluffs (and be right about them) to claim this title.
          </Text>
        ) : (
          (() => {
            const legend = topBluffers[0];
            const isMe = !!myRank && myRank.userId === legend.userId;

            return (
              <View style={styles.bluffLegendContent}>
                <Text style={styles.bluffLegendName}>
                  {legend.username} {isMe ? '(that’s you!)' : ''}
                </Text>
                <Text style={styles.bluffLegendStat}>
                  Successful bluffs: {legend.correctBluffEvents}
                </Text>
                <Text style={styles.bluffLegendStatSecondary}>
                  Total bluff events: {legend.bluffEvents}
                </Text>
              </View>
            );
          })()
        )}
      </View>
    );
  };

  const renderSurvivalChampion = () => {
    if (loading) {
      return null; // covered by main loading state in the rank card
    }

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Inferno Mode Record Holder</Text>
        {topSurvivors.length === 0 ? (
          <Text style={styles.noDataText}>
            No Survival data yet. Push your streak in Inferno Survival mode to claim this title.
          </Text>
        ) : (
          <>
            {(() => {
              const champ = topSurvivors[0];
              const isMe = !!myRank && myRank.userId === champ.userId;

              return (
                <View style={styles.survivalChampionContent}>
                  <Text style={styles.survivalChampionName}>
                    {champ.username} {isMe ? '(that’s you!)' : ''}
                  </Text>
                  <Text style={styles.survivalChampionStat}>
                    Best Survival streak: {champ.survivalBest}
                  </Text>
                  <Text style={styles.survivalChampionStatSecondary}>
                    Survival runs played: {champ.survivalRuns}
                  </Text>
                </View>
              );
            })()}
            <View style={styles.leaderboardContainer}>
              {topSurvivors.map((p, index) => {
                const isMe = !!myRank && myRank.userId === p.userId;
                return (
                  <View
                    key={p.userId}
                    style={[styles.leaderRow, isMe && styles.leaderRowMe]}
                  >
                    <Text style={styles.leaderRank}>#{index + 1}</Text>
                    <View style={styles.leaderMiddle}>
                      <Text
                        style={styles.leaderName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {p.username}
                      </Text>
                      <Text style={styles.leaderTier}>
                        Streak: {p.survivalBest}
                      </Text>
                    </View>
                    <View style={styles.leaderRight}>
                      <Text style={styles.leaderGames}>
                        {p.survivalRuns} run{p.survivalRuns === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Rank &amp; Leaderboard</Text>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {renderMyRankCard()}
            {renderLeaderboard()}
            {renderBluffLegend()}
            {renderSurvivalChampion()}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1F262A',
  },
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 40,
    paddingHorizontal: 16,
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F0F6FC',
    marginBottom: 12,
    textAlign: 'center',
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
    fontStyle: 'italic',
    marginTop: 4,
  },
  rankMainRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  rankTierBlock: {
    alignItems: 'center',
  },
  rankTierText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FE9902',
  },
  rankRatingText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#53A7F3',
    marginTop: 4,
  },
  rankSubText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginTop: 6,
    textAlign: 'center',
  },
  rankSubTextBold: {
    fontWeight: '800',
  },
  rankPercent: {
    fontWeight: '800',
  },
  rankStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rankStatItem: {
    width: '48%',
    marginTop: 8,
  },
  rankStatLabel: {
    fontSize: 13,
    color: '#CCCCCC',
  },
  rankStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F0F6FC',
    marginTop: 2,
  },
  leaderboardContainer: {
    marginTop: 4,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  leaderRowMe: {
    backgroundColor: 'rgba(83, 167, 243, 0.18)',
  },
  leaderRank: {
    width: 40,
    fontSize: 16,
    fontWeight: '700',
    color: '#F0F6FC',
  },
  leaderMiddle: {
    flex: 1,
    paddingRight: 8,
  },
  leaderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F0F6FC',
  },
  leaderTier: {
    fontSize: 13,
    color: '#CCCCCC',
    marginTop: 2,
  },
  leaderRight: {
    alignItems: 'flex-end',
  },
  leaderRating: {
    fontSize: 16,
    fontWeight: '700',
    color: '#53A7F3',
  },
  leaderGames: {
    fontSize: 12,
    color: '#8B949E',
    marginTop: 2,
  },
  footer: {
    marginTop: 8,
    alignItems: 'center',
  },
  backButton: {
    width: '100%',
    maxWidth: 300,
  },
  bluffLegendContent: {
    marginTop: 8,
  },
  bluffLegendName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FE9902',
    marginBottom: 4,
  },
  bluffLegendStat: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  bluffLegendStatSecondary: {
    fontSize: 14,
    color: '#A0B4C0',
    marginTop: 2,
  },
  survivalChampionContent: {
    marginTop: 8,
  },
  survivalChampionName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FE9902',
    marginBottom: 4,
  },
  survivalChampionStat: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  survivalChampionStatSecondary: {
    fontSize: 14,
    color: '#A0B4C0',
    marginTop: 2,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(48, 54, 61, 0.6)',
    marginVertical: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#53A7F3',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
});
