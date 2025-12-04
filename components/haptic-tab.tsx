import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '../src/state/useSettingsStore';

export function HapticTab(props: BottomTabBarButtonProps) {
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios' && hapticsEnabled) {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
