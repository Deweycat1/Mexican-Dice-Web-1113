import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { AppText as Text } from './AppText';
type Props = {
  visible: boolean;
  onHide: () => void;
  pun?: string | null;
};

const DARK_PUNS = [
  "Your streak just… crapped out.",
  "Snake eyes on life choices, huh?",
  "You rolled the dice… and the dice rolled you.",
  "That streak didn't end — it failed its saving throw.",
  "Your dice have filed for divorce.",
  "That roll? Yeah… that was a natural 1.",
  "Your streak just rage-quit.",
  "Even the dice are tired of your confidence.",
  "Congratulations! You've unlocked: FAILURE.",
  "Those dice were loaded… against you.",
  "You've been critically hit. By yourself.",
  "Your luck ran out of luck.",
  "Your streak rolled over and died. Respectfully.",
  "Your streak rolled a 1… on survival.",
  "Your streak? Oh, it's in the morgue.",
  "The dice regret nothing.",
  "RIP streak. Cause of death: you.",
];

// Shuffle and track used puns to avoid repeats
let punPool = [...DARK_PUNS];
export const getRandomPun = (): string => {
  if (punPool.length === 0) {
    punPool = [...DARK_PUNS];
  }
  const randomIndex = Math.floor(Math.random() * punPool.length);
  const selectedPun = punPool[randomIndex];
  punPool.splice(randomIndex, 1);
  return selectedPun;
};

const AUTO_HIDE_DELAY_MS = 750; // Just under a second including exit animation

export default function StreakEndPopup({ visible, onHide, pun }: Props) {
  const [animating, setAnimating] = useState(false);
  const [currentPun, setCurrentPun] = useState('');

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      setAnimating(false);
      return;
    }

    setAnimating(true);
    // If a pun is provided by the parent (selected at loss time), use it.
    // Otherwise fall back to selecting one here (backwards-compatible).
    setCurrentPun(pun ?? getRandomPun());
    scaleAnim.setValue(0);
    opacityAnim.setValue(0);
    tiltAnim.setValue(-0.05);

    // Entry animation: tilt + scale + fade
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(tiltAnim, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Ominous slow pulse (glow effect)
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Auto-hide quickly so it flashes for < 1 second total
    const timer = setTimeout(() => {
      pulseLoop.stop();
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
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
    }, AUTO_HIDE_DELAY_MS);

    return () => {
      clearTimeout(timer);
      pulseLoop.stop();
    };
  }, [visible, pun, scaleAnim, opacityAnim, tiltAnim, pulseAnim, onHide]);

  if (!visible && !animating) {
    return null;
  }

  return (
    <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]} pointerEvents="none">
      <Animated.View
        style={[
          styles.container,
          {
            opacity: opacityAnim,
            transform: [
              { scale: scaleAnim },
              {
                rotate: tiltAnim.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ['-1rad', '1rad'],
                }),
              },
            ],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.glowContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View style={styles.card}>
            <Text style={styles.text}>{currentPun}</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowContainer: {
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  card: {
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 24,
    maxWidth: '85%',
  },
  text: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 30,
  },
});
