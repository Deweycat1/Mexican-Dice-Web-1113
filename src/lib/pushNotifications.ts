import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Router } from 'expo-router';

import { supabase } from './supabase';

// Push notification initialization is intentionally centralized here so that:
// - Android can explicitly request notification runtime permission before token retrieval
// - Android can configure a default notification channel prior to using expo-notifications
// - Token registration only runs when a user is known, and avoids repeated upserts per session
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type InitPushNotificationsArgs = {
  userId: string;
  router: Router;
};

let didInit = false;

export async function initPushNotifications({ userId, router }: InitPushNotificationsArgs): Promise<void> {
  if (!userId) {
    console.log('[push] skipping registration, missing userId', { platform: Platform.OS });
    return;
  }

  console.log('[push] starting registration', { userId, platform: Platform.OS });

  if (didInit) return;
  didInit = true;

  if (Platform.OS === 'web') {
    console.log('[push] skipping push init on web');
    return;
  }

  try {
    const projectId =
      (Constants?.expoConfig as { extra?: { eas?: { projectId?: string } } } | undefined)?.extra?.eas
        ?.projectId ??
      (Constants?.easConfig as { projectId?: string } | undefined)?.projectId;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[push] current notification permission status', {
      status: existingStatus,
      platform: Platform.OS,
    });

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('[push] requesting notification permissions');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[push] notification permissions not granted');
      return;
    }

    console.log('[push] notification permission granted', { platform: Platform.OS });

    if (Platform.OS === 'android') {
      console.log('[push] configuring Android notification channel');
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const expoPushToken = tokenResponse.data;

    if (!expoPushToken) {
      console.warn('[push] failed to obtain Expo push token');
      return;
    }

    console.log('[push] obtained Expo push token', {
      userId,
      platform: Platform.OS,
      tokenSuffix: expoPushToken.slice(-6),
      hasProjectId: !!projectId,
    });

    console.log('[push] saving token to backend');

    let error: unknown;
    try {
      const result = await supabase
        .from('user_push_tokens')
        .upsert(
          [
            {
              user_id: userId,
              expo_push_token: expoPushToken,
              platform: Platform.OS,
              is_enabled: true,
              last_seen_at: new Date().toISOString(),
            },
          ],
          { onConflict: 'user_id,expo_push_token' }
        );
      error = result.error;
    } catch (err) {
      console.error('[push] save failed (exception)', err);
      throw err;
    }

    if (error) {
      console.error('[push] failed to upsert push token', error);
    } else {
      console.log('[push] upserted push token successfully');
    }
  } catch (err) {
    console.error('[push] error initializing notifications', err);
  }
}

// Helper that can be manually called (e.g. from dev tools)
// to verify push registration without affecting gameplay flows.
export async function verifyPushRegistration(args: InitPushNotificationsArgs): Promise<{ ok: boolean; reason?: string }> {
  try {
    await initPushNotifications(args);
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error';
    console.error('[push] verifyPushRegistration failed', err);
    return { ok: false, reason };
  }
}
