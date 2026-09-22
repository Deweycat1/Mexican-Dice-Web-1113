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

// Registration bookkeeping, keyed per user so switching accounts re-registers, and per
// (userId, token) so repeated calls never re-upsert the same token.
let lastInitUserId: string | null = null;
let inFlight: { userId: string; promise: Promise<void> } | null = null;
const registeredTokenKeys = new Set<string>();

const tokenKey = (userId: string, token: string) => `${userId}:${token}`;

/**
 * Runs the full permission + token + upsert flow for `userId`. Safe to call repeatedly
 * (e.g. after the user changes notification permissions): the backend upsert is skipped
 * when this (userId, token) pair was already registered in this session unless `force`.
 */
export async function registerPushToken(
  userId: string,
  options?: { force?: boolean }
): Promise<void> {
  if (!userId) {
    console.log('[push] skipping registration, missing userId', { platform: Platform.OS });
    return;
  }

  if (inFlight && inFlight.userId === userId) {
    return inFlight.promise;
  }

  const run = async () => {
    console.log('[push] starting registration', { userId, platform: Platform.OS });

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

      const key = tokenKey(userId, expoPushToken);
      if (!options?.force && registeredTokenKeys.has(key)) {
        console.log('[push] token already registered for this user in this session, skipping upsert');
        return;
      }

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
        registeredTokenKeys.add(key);
        console.log('[push] upserted push token successfully');
      }
    } catch (err) {
      console.error('[push] error initializing notifications', err);
    }
  };

  const promise = run().finally(() => {
    if (inFlight && inFlight.userId === userId) inFlight = null;
  });
  inFlight = { userId, promise };
  return promise;
}

/**
 * App-level entry point. Runs registration once per userId: calling it again for the same
 * user is a no-op, while a different userId (account switch) triggers a fresh registration.
 * Use `registerPushToken` to explicitly re-run after permission changes.
 */
export async function initPushNotifications({ userId }: InitPushNotificationsArgs): Promise<void> {
  if (!userId) {
    console.log('[push] skipping registration, missing userId', { platform: Platform.OS });
    return;
  }

  if (lastInitUserId === userId) {
    console.log('[push] already initialized for this user', { userId });
    return;
  }
  lastInitUserId = userId;

  await registerPushToken(userId);
}

// Helper that can be manually called (e.g. from dev tools)
// to verify push registration without affecting gameplay flows.
export async function verifyPushRegistration(args: InitPushNotificationsArgs): Promise<{ ok: boolean; reason?: string }> {
  try {
    await registerPushToken(args.userId, { force: true });
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error';
    console.error('[push] verifyPushRegistration failed', err);
    return { ok: false, reason };
  }
}
