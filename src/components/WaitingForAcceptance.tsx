import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function WaitingForAcceptance() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#E0B50C" />
      <Text style={styles.text}>Waiting for your friend to accept...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B3A26',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  text: {
    marginTop: 24,
    fontSize: 22,
    color: '#E0B50C',
    fontWeight: '700',
    textAlign: 'center',
  },
});
