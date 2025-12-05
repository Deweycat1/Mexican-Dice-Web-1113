import { Link, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import FeltBackground from '../src/components/FeltBackground';
import { getPersonalStats, PersonalStats } from '../src/stats/personalStats';

const formatDays = (value: number) => `${value} ${value === 1 ? 'day' : 'days'}`;

type StatRowProps = {
  label: string;
  value: string | number;
};

const StatRow = ({ label, value }: StatRowProps) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

export default function YourStatsScreen() {
  const [stats, setStats] = useState<PersonalStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const load = async () => {
        const data = await getPersonalStats();
        if (isActive) {
          setStats(data);
        }
      };
      load();
      return () => {
        isActive = false;
      };
    }, [])
  );

  return (
    <View style={styles.root}>
      <FeltBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.content}>
            <Text style={styles.title}>Your Stats</Text>
            {!stats ? (
              <ActivityIndicator color="#FE9902" />
            ) : (
              <>
                <View style={styles.card}>
                  <StatRow label="Total Number of Games Played" value={stats.totalGamesPlayed} />
                  <StatRow label="Current Daily Streak" value={formatDays(stats.currentDailyStreak)} />
                  <StatRow label="Longest Daily Streak" value={formatDays(stats.longestDailyStreak)} />
                  <StatRow label="Total Days Played" value={stats.totalDaysPlayed} />
                </View>
                <Link href="/" style={styles.mainMenuButton}>
                  <Text style={styles.buttonText}>Main Menu</Text>
                </Link>
              </>
            )}
          </View>
        </SafeAreaView>
      </FeltBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B3A26',
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 16,
  },
  title: {
    color: '#E6FFE6',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 16,
  },
  mainMenuButton: {
    marginTop: 24,
    backgroundColor: '#C21807',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    // @ts-ignore
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.4)',
    borderWidth: 2,
    borderColor: '#8B0000',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'column',
    gap: 4,
  },
  rowLabel: {
    color: '#C9F0D6',
    fontSize: 16,
    fontWeight: '600',
  },
  rowValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
});
