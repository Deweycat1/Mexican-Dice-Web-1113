import * as Haptics from 'expo-haptics';

export async function playRollHaptic(enabled: boolean) {
  if (!enabled) return;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export async function playClaimHaptic(enabled: boolean) {
  if (!enabled) return;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export async function playBluffDeclaredHaptic(enabled: boolean) {
  if (!enabled) return;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export async function playBluffCallSuccessHaptic(enabled: boolean) {
  if (!enabled) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export async function playBluffCallFailHaptic(enabled: boolean) {
  if (!enabled) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export async function playSpecial21Haptic(enabled: boolean) {
  if (!enabled) return;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  setTimeout(() => {
    if (!enabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, 80);
}

export async function playSpecial31Haptic(enabled: boolean) {
  if (!enabled) return;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  setTimeout(() => {
    if (!enabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, 120);
}

export async function playSpecial41Haptic(enabled: boolean) {
  if (!enabled) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export async function playLosePointHaptic(enabled: boolean) {
  if (!enabled) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export async function playWinRoundHaptic(enabled: boolean) {
  if (!enabled) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export async function playToggleHaptic(enabled: boolean) {
  if (!enabled) return;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export async function playSpecialClaimHaptic(claim: number, enabled: boolean) {
  if (!enabled) return;
  if (claim === 21) {
    await playSpecial21Haptic(enabled);
  } else if (claim === 31) {
    await playSpecial31Haptic(enabled);
  } else if (claim === 41) {
    await playSpecial41Haptic(enabled);
  }
}
