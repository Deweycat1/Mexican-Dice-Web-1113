import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type OnlineGameOverModalProps = {
  visible: boolean;
  didIWin: boolean;
  myScore: number;
  opponentScore: number;
  opponentName: string;
  onClose: () => void;
};

// End-of-game banner lines (reused from Quick Play)
const HEAVENLY_LINES = [
  "You ascend victorious.",
  "Heaven smiles on your rolls.",
  "Saint of the six pips.",
  "You just blessed those dice.",
];

const DEMONIC_LINES = [
  "Dragged into dice hell.",
  "The devil devoured your points.",
  "Your luck just went up in smoke.",
  "You gambled with demons and lost.",
];

const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export default function OnlineGameOverModal({
  visible,
  didIWin,
  myScore,
  opponentScore,
  opponentName,
  onClose,
}: OnlineGameOverModalProps) {
  const router = useRouter();

  const flavorLine = didIWin ? pickRandom(HEAVENLY_LINES) : pickRandom(DEMONIC_LINES);

  const handleBackToMenu = () => {
    onClose();
    router.replace('/');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[
          styles.modalContent,
          didIWin ? styles.modalWin : styles.modalLose
        ]}>
          {/* Title */}
          <Text style={[
            styles.title,
            didIWin ? styles.titleWin : styles.titleLose
          ]}>
            {didIWin ? 'Victory!' : 'Defeat'}
          </Text>

          {/* Flavor text */}
          <Text style={[
            styles.subtitle,
            didIWin ? styles.subtitleWin : styles.subtitleLose
          ]}>
            {flavorLine}
          </Text>

          {/* Scores */}
          <View style={styles.scoresContainer}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>You:</Text>
              <Text style={[
                styles.scoreValue,
                didIWin ? styles.scoreWin : styles.scoreLose
              ]}>
                {myScore}
              </Text>
            </View>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>{opponentName}:</Text>
              <Text style={[
                styles.scoreValue,
                !didIWin ? styles.scoreWin : styles.scoreLose
              ]}>
                {opponentScore}
              </Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleBackToMenu}
            >
              <Text style={styles.buttonText}>Back to Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  modalWin: {
    backgroundColor: '#1a4d2e',
    borderWidth: 3,
    borderColor: '#E0B50C',
  },
  modalLose: {
    backgroundColor: '#3d1a1a',
    borderWidth: 3,
    borderColor: '#8B0000',
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  titleWin: {
    color: '#FFD700',
  },
  titleLose: {
    color: '#FF6B6B',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  subtitleWin: {
    color: '#E0F7E0',
  },
  subtitleLose: {
    color: '#FFB3B3',
  },
  scoresContainer: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  scoreWin: {
    color: '#FFD700',
  },
  scoreLose: {
    color: '#FF6B6B',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#E0B50C',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0B3A26',
  },
});
