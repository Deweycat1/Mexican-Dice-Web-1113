import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText as Text } from './AppText';
export default function WaitingForAcceptance() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FE9902" />
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
    color: '#FE9902',
    fontWeight: '700',
    textAlign: 'center',
  },
});
