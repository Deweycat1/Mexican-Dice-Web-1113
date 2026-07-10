import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { InlineFlameText } from './InlineFlameText';

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
        <InlineFlameText
          text={text}
          numberOfLines={2}
          ellipsizeMode="tail"
          style={styles.dialogText}
          iconSize={13}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dialogContainer: {
    position: 'absolute',
    top: -3,
    left: 82,
    right: 82,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(224, 181, 12, 0.4)',
    alignItems: 'center',
    zIndex: 1000,
  },
  userContainer: {
    backgroundColor: 'rgba(83, 167, 243, 0.22)',
  },
  rivalContainer: {
    backgroundColor: 'rgba(255, 107, 107, 0.35)',
  },
  dialogSpeaker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 7,
  },
  dialogSpeakerEmoji: {
    fontSize: 22,
  },
  dialogSpeakerImage: {
    width: 34,
    height: 34,
  },
  dialogTextWrapper: {
    flex: 1,
  },
  dialogText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
  },
});
