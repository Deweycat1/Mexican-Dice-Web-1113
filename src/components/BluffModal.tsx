import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FlameEmojiIcon } from './FlameEmojiIcon';

type Props = {
  visible: boolean;
  options: number[];
  onCancel: () => void;
  onSelect: (claim: number) => void;
  canShowSocial?: boolean;
  onShowSocial?: () => void;
};

const formatClaim = (value: number) => {
  if (value === 21) return '21 (Inferno)';
  if (value === 31) return '31 (Reverse)';
  if (value === 41) return '41 (Social)';
  const hi = Math.floor(value / 10);
  const lo = value % 10;
  return `${hi}${lo}`;
};

const renderClaim = (value: number) => formatClaim(value);

export default function BluffModal({ visible, options, onCancel, onSelect, canShowSocial, onShowSocial }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.heading}>Choose your claim</Text>
          <Text style={styles.subtle}>
            Select a legal claim or tap Cancel/outside to keep your roll.
          </Text>

          <ScrollView 
            style={styles.optionList}
            contentContainerStyle={styles.optionListContent}
            showsVerticalScrollIndicator={true}
            persistentScrollbar={true}
          >
            {options.map((value) => (
              <Pressable
                key={value}
                style={({ pressed }) =>
                  StyleSheet.flatten([styles.option, pressed && styles.optionPressed])
                }
                onPress={() => onSelect(value)}
              >
                {value === 21 ? (
                  <View style={styles.optionLabelRow}>
                    <Text style={[styles.optionLabel, styles.optionLabelSegment]}>21 (Inferno</Text>
                    <FlameEmojiIcon size={20} style={styles.inlineFlameIcon} />
                    <Text style={[styles.optionLabel, styles.optionLabelSegment]}>)</Text>
                  </View>
                ) : (
                  <Text style={styles.optionLabel}>{renderClaim(value)}</Text>
                )}
              </Pressable>
            ))}

            {canShowSocial && (
              <Pressable
                style={({ pressed }) =>
                  StyleSheet.flatten([
                    styles.option,
                    styles.socialOption,
                    pressed && styles.optionPressed,
                  ])
                }
                onPress={onShowSocial}
              >
                <Text style={styles.optionLabel}>Show 41 (Social) — Reset Round</Text>
              </Pressable>
            )}
          </ScrollView>

          <Pressable 
            style={({ pressed }) => [
              styles.cancel,
              pressed && styles.cancelPressed
            ]} 
            onPress={onCancel}
          >
            <Text style={styles.cancelLabel}>✕ Cancel - Keep My Roll</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#2A3136',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  heading: { 
    color: '#E0B50C', 
    fontWeight: '800', 
    fontSize: 20,
    marginBottom: 8,
  },
  subtle: { 
    color: '#8B949E', 
    marginBottom: 16,
    fontSize: 14,
  },
  optionList: { 
    maxHeight: 400,
  },
  optionListContent: {
    paddingBottom: 8,
  },
  option: {
    backgroundColor: '#22272E',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  optionPressed: {
    backgroundColor: '#2B333B',
  },
  optionLabel: { 
    color: '#F0F6FC', 
    fontWeight: '700', 
    fontSize: 18, 
    textAlign: 'center' 
  },
  optionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabelSegment: {
    marginBottom: 0,
  },
  inlineFlameIcon: {
    marginHorizontal: 6,
  },
  socialOption: {
    backgroundColor: '#2B333B',
  },
  cancel: {
    marginTop: 16,
    backgroundColor: '#8B0000',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
    borderWidth: 2,
    borderColor: '#5A0000',
  },
  cancelPressed: {
    backgroundColor: '#A52A2A',
    opacity: 0.8,
  },
  cancelLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
});
