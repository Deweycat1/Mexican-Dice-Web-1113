import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Router } from 'expo-router';

import { supabase } from './supabase';

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
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[push] notification permissions not granted');
      return;
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
      hasProjectId: !!projectId,
    });

    const { error } = await supabase
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

    if (error) {
      console.error('[push] failed to upsert push token', error);
    } else {
      console.log('[push] upserted push token successfully');
    }

    Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const gameId = (response.notification.request.content.data as { gameId?: string } | undefined)
          ?.gameId;
        if (gameId) {
          console.log('[push] notification tapped, navigating to game', { gameId });
          router.push(`/online/game-v2/${gameId}`);
        } else {
          console.log('[push] notification tapped with no gameId in payload');
        }
      } catch (err) {
        console.error('[push] error handling notification tap', err);
      }
    });
  } catch (err) {
    console.error('[push] error initializing notifications', err);
  }
}

