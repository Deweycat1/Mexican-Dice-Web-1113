import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import RulesContent from '../src/components/RulesContent';

export default function RulesScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inferno Dice...Rules!</Text>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.rulesCard}>
          <RulesContent />
        </View>
      </ScrollView>


      <View
        style={{
          marginTop: 'auto',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 24,
        }}
      >
        <Pressable
          onPress={() => router.push('/')}
          style={({ pressed }) => StyleSheet.flatten([
            styles.menuButton,
            pressed && styles.menuButtonPressed,
          ])}
        >
          <Text style={styles.menuButtonText}>Main Menu</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B3A26',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginTop: 35,
    marginBottom: 18,
  },
  rulesCard: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 18,
    padding: 18,
    rowGap: 12,
  },
  menuButton: {
    backgroundColor: '#C21807',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderWidth: 2,
    borderColor: '#8B0000',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    // @ts-ignore - boxShadow is web-only
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.4)',
  },
  menuButtonPressed: {
    opacity: 0.85,
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
