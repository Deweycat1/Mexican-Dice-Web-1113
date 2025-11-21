import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FeltBackground from '../src/components/FeltBackground';

export default function FeltTest() {
  return (
    <FeltBackground>
      <View style={styles.container}>
        <View style={styles.yellowBox}>
          <Text style={styles.title}>YELLOW BOX TEST</Text>
          <Text style={styles.subtitle}>If you see this, FeltBackground works!</Text>
          <Text style={styles.info}>Test timestamp: {new Date().toLocaleTimeString()}</Text>
        </View>

        <View style={styles.redBox}>
          <Text style={styles.boxText}>RED BOX (zIndex: 100)</Text>
        </View>

        <View style={styles.blueBox}>
          <Text style={styles.boxText}>BLUE BOX (absolute position)</Text>
        </View>
      </View>
    </FeltBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yellowBox: {
    backgroundColor: 'yellow',
    padding: 40,
    borderRadius: 12,
    borderWidth: 4,
    borderColor: 'orange',
    zIndex: 999999,
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'black',
    marginBottom: 8,
    textAlign: 'center',
  },
  info: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  redBox: {
    backgroundColor: 'red',
    padding: 20,
    borderRadius: 8,
    zIndex: 100,
    marginBottom: 20,
  },
  blueBox: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'blue',
    padding: 20,
    borderRadius: 8,
    zIndex: 50,
  },
  boxText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
});
