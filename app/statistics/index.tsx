import React from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StyledButton from '../../src/components/StyledButton';

export default function StatisticsMenuScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Statistics</Text>
        <View style={styles.buttonGroup}>
          <StyledButton
            label="Global Stats"
            onPress={() => router.push('/stats')}
            variant="primary"
            style={[styles.menuButton, styles.buttonSpacing, styles.menuButtonRed]}
          />
          <StyledButton
            label="Your Stats"
            onPress={() => router.push('/your-stats')}
            style={[styles.menuButton, styles.buttonSpacing, styles.menuButtonGold]}
          />
          <StyledButton
            label="Back to Menu"
            onPress={() => router.push('/')}
            variant="success"
            style={[styles.menuButton, styles.menuButtonGreen]}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B3A26',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#E6FFE6',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
  },
  buttonSpacing: {
    marginBottom: 16,
  },
  menuButton: {
    width: '80%',
    maxWidth: 320,
  },
  menuButtonRed: {
    borderWidth: 2,
    borderColor: '#8B0000',
  },
  menuButtonGold: {
    backgroundColor: '#D4AF37',
    borderWidth: 2,
    borderColor: '#B8860B',
  },
  menuButtonGreen: {
    borderWidth: 2,
    borderColor: '#006400',
  },
});
