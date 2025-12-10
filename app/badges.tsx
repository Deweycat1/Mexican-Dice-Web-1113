import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import StyledButton from '../src/components/StyledButton';
import { loadBadges } from '../src/stats/badges';
import { BadgeMeta, getBadgeMeta } from '../src/stats/badgeMetadata';

export default function BadgesScreen() {
  const router = useRouter();
  const [badges, setBadges] = useState<BadgeMeta[] | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const store = await loadBadges();
        const earnedEntries = Object.values(store).filter(
          (entry): entry is NonNullable<typeof entry> => !!entry && entry.earned
        );

        earnedEntries.sort((a, b) => {
          const aTime = a.earnedAt ? new Date(a.earnedAt).getTime() : 0;
          const bTime = b.earnedAt ? new Date(b.earnedAt).getTime() : 0;
          return aTime - bTime;
        });

        const metaList = earnedEntries.map((entry) => getBadgeMeta(entry.id));

        if (isMounted) {
          setBadges(metaList);
        }
      } catch (err) {
        console.error('Failed to load earned badges', err);
        if (isMounted) {
          setBadges([]);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  if (badges === null) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#53A7F3" />
          <Text style={styles.loadingText}>Loading badges...</Text>
        </View>
        <StyledButton
          label="Back to Stats"
          onPress={() => router.push('/statistics')}
          style={styles.backButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Badges</Text>

      {badges.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Keep playing to unlock your first badge.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.listContent}>
          {badges.map((badge) => (
            <View key={badge.id} style={styles.badgeRow}>
              <Text style={styles.badgeIcon}>{badge.icon}</Text>
              <Text style={styles.badgeTitle}>{badge.title}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <StyledButton
        label="Back to Stats"
        onPress={() => router.push('/statistics')}
        style={styles.backButton}
      />
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
    paddingHorizontal: 24,
  },
  title: {
    color: '#F0F6FC',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#F0F6FC',
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    paddingVertical: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#2A3136',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  badgeIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  badgeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F0F6FC',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  emptyText: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
  },
  backButton: {
    width: '100%',
    maxWidth: 320,
    marginTop: 16,
    marginBottom: 24,
  },
});

