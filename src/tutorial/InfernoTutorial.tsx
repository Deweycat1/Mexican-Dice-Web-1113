import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';

import { AppText as Text } from '../components/AppText';
import { Image } from 'expo-image';

type Props = {
  visible: boolean;
  onDone: () => void;
};

const PAGES = [
  require('../../assets/images/infernotutorial/Page1.png'),
  require('../../assets/images/infernotutorial/Page2.png'),
  require('../../assets/images/infernotutorial/Page3.png'),
] as const;

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
    if (index < PAGES.length - 1) {
      setIndex((prev) => Math.min(prev + 1, PAGES.length - 1));
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
              <Image
                source={PAGES[index]}
                style={styles.image}
                contentFit="contain"
              />
            </View>
            <View style={styles.pagerContainer}>
              <Text style={styles.pagerText}>
                {index + 1} / {PAGES.length}
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
