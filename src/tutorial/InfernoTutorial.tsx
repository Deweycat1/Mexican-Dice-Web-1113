import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';

import { AppText as Text } from '../components/AppText';
import DiceCupStage from '../components/DiceCupStage';
import { Image } from 'expo-image';

type Props = {
  visible: boolean;
  onDone: () => void;
};

const IMAGE_PAGES = [
  require('../../assets/images/infernotutorial/Page1.png'),
  require('../../assets/images/infernotutorial/Page2.png'),
  require('../../assets/images/infernotutorial/Page3.png'),
] as const;
const PAGE_COUNT = IMAGE_PAGES.length + 1;

export function InfernoTutorial({ visible, onDone }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (visible) {
      setIndex(0);
    }
  }, [visible]);

  const handleFinish = useCallback(() => {
    setIndex(0);
    onDone();
  }, [onDone]);

  const handlePrev = useCallback(() => {
    setIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const handleNext = useCallback(() => {
    if (index < PAGE_COUNT - 1) {
      setIndex((prev) => Math.min(prev + 1, PAGE_COUNT - 1));
    } else {
      handleFinish();
    }
  }, [index, handleFinish]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
          <View style={styles.fullscreenPressable}>
            <View style={styles.imageWrapper}>
              {index < IMAGE_PAGES.length ? (
                <Image
                  source={IMAGE_PAGES[index]}
                  style={styles.image}
                  contentFit="contain"
                />
              ) : (
                <View style={styles.cupLesson}>
                  <Text style={styles.cupEyebrow}>SURVIVAL CONTROLS</Text>
                  <Text style={styles.cupTitle}>The cup is your move</Text>
                  <Text style={styles.cupBody}>
                    Tap the cup to shake and roll your dice. Swipe up to lift the cup and call a
                    bluff. Swipe either side to believe the claim and discard the covered dice.
                  </Text>
                  <DiceCupStage
                    phase="handed"
                    diceValues={[6, 4]}
                    rollOwner="cpu"
                    handedStatus="TAP = ROLL  •  ↑ = CALL  •  ↔ = BELIEVE"
                  />
                  <Text style={styles.cupNote}>
                    Every gesture also has a button, so you can use whichever control feels best.
                  </Text>
                  <Text style={styles.cupContinue}>TAP THE RIGHT SIDE TO START SURVIVAL</Text>
                </View>
              )}
            </View>
            <View style={styles.pagerContainer}>
              <Text style={styles.pagerText}>
                {index + 1} / {PAGE_COUNT}
              </Text>
            </View>
            <Pressable style={styles.tapOverlayLeft} onPress={handlePrev} />
            <Pressable style={styles.tapOverlayRight} onPress={handleNext} />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  safeArea: {
    flex: 1,
  },
  fullscreenPressable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cupLesson: {
    width: '100%',
    maxWidth: 430,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  cupEyebrow: {
    color: '#FF7A1A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  cupTitle: {
    color: '#F0F6FC',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },
  cupBody: {
    color: '#C9D1D9',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 8,
  },
  cupNote: {
    color: '#AEB7C2',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  cupContinue: {
    color: '#C0C7D1',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginTop: 24,
  },
  tapOverlayLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '50%',
  },
  tapOverlayRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '50%',
  },
  pagerContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pagerText: {
    color: '#F0F6FC',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
});

export default InfernoTutorial;
