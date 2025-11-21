import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import FireworksOverlay from './FireworksOverlay';

type MilestoneMode = '5' | '10' | '15' | 'newLeader' | '20' | '25' | '30' | '35' | '40';

type Props = {
  visible: boolean;
  title: string;
  mode: MilestoneMode;
  onHide: () => void;
};

const MILESTONE_CONFIG = {
  '5': {
    duration: 1500,
    color: '#FF6B6B',
    showFireworks: false,
    showConfetti: false,
  },
  '10': {
    duration: 1800,
    color: '#FF4444',
    showFireworks: false,
    showConfetti: true,
  },
  '15': {
    duration: 2000,
    color: '#FFD700',
    showFireworks: false,
    showConfetti: false,
  },
  '20': {
    duration: 1800,
    color: '#FFD700',
    showFireworks: false,
    showConfetti: false,
  },
  '25': {
    duration: 1800,
    color: '#FF6600',
    showFireworks: false,
    showConfetti: false,
  },
  '30': {
    duration: 1800,
    color: '#FF0000',
    showFireworks: false,
    showConfetti: false,
  },
  '35': {
    duration: 1800,
    color: '#00FFFF',
    showFireworks: false,
    showConfetti: false,
  },
  '40': {
    duration: 2000,
    color: '#8B00FF',
    showFireworks: false,
    showConfetti: true,
  },
  newLeader: {
    duration: 2000,
    color: '#FFD700',
    showFireworks: false,
    showConfetti: true,
  },
};

export default function StreakCelebrationOverlay({ visible, title, mode, onHide }: Props) {
  const [animating, setAnimating] = React.useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const config = MILESTONE_CONFIG[mode];

  useEffect(() => {
    if (!visible) {
      return;
    }

    setAnimating(true);
    scaleAnim.setValue(0);
    opacityAnim.setValue(0);

    // Entry animation: scale + fade
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-hide after duration
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setAnimating(false);
        onHide();
      });
    }, config.duration);

    return () => {
      clearTimeout(timer);
    };
  }, [visible, scaleAnim, opacityAnim, config.duration, onHide]);

  if (!visible && !animating) {
    return null;
  }

  return (
    <>
      <View style={styles.overlay} pointerEvents="none">
        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
              borderColor: config.color,
            },
          ]}
        >
          <Text style={[styles.title, { color: config.color }]}>{title}</Text>
        </Animated.View>
      </View>
      {config.showConfetti && (
        <FireworksOverlay visible={visible && animating} duration={1500} bursts={20} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    backgroundColor: 'rgba(11, 58, 38, 0.95)',
    borderRadius: 16,
    borderWidth: 3,
    paddingHorizontal: 24,
    paddingVertical: 20,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
