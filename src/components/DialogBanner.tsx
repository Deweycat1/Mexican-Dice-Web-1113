import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type Speaker = 'user' | 'rival';

interface DialogBannerProps {
  speaker: Speaker;
  text: string;
}

export default function DialogBanner({ speaker, text }: DialogBannerProps) {
  const containerStyle = [
    styles.dialogContainer,
    speaker === 'user' ? styles.userContainer : styles.rivalContainer
  ];

  return (
    <View style={containerStyle}>
      <View style={styles.dialogSpeaker}>
        {speaker === 'user' ? (
          <Image
            source={require('../../assets/images/User.png')}
            style={styles.dialogSpeakerImage}
          />
        ) : (
          <Image
            source={require('../../assets/images/Rival.png')}
            style={styles.dialogSpeakerImage}
          />
        )}
      </View>

      <View style={styles.dialogTextWrapper}>
        <Text
          numberOfLines={3}
          ellipsizeMode="tail"
          style={styles.dialogText}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dialogContainer: {
    position: 'absolute',
    top: -5,
    left: 75,
    right: 75,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(224, 181, 12, 0.4)',
    alignItems: 'center',
    zIndex: 1000,
  },
  userContainer: {
    backgroundColor: 'rgba(107, 255, 137, 0.35)',
  },
  rivalContainer: {
    backgroundColor: 'rgba(255, 107, 107, 0.35)',
  },
  dialogSpeaker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  dialogSpeakerEmoji: {
    fontSize: 22,
  },
  dialogSpeakerImage: {
    width: 25,
    height: 25,
  },
  dialogTextWrapper: {
    flex: 1,
  },
  dialogText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
