import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

export default function FeltBackground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', zIndex: 0 }]}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="felt" cx="50%" cy="30%" r="90%">
              <Stop offset="0%" stopColor="#25282C" />
              <Stop offset="70%" stopColor="#202326" />
              <Stop offset="100%" stopColor="#1B1D1F" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#felt)" />
        </Svg>
      </View>
      <View style={styles.childrenContainer}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#1B1D1F', // ensure no light patch shows behind felt
  },
  childrenContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});
