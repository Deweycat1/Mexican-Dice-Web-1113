/* eslint-env jest */
// Native storage has no implementation under Jest; use the official in-memory mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Audio/haptics are fire-and-forget side effects in the store; keep them inert in tests.
jest.mock('expo-av', () => ({
  Audio: {
    Sound: { createAsync: jest.fn(async () => ({ sound: { playAsync: jest.fn(), unloadAsync: jest.fn(), setOnPlaybackStatusUpdate: jest.fn() } })) },
    setAudioModeAsync: jest.fn(async () => undefined),
  },
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
