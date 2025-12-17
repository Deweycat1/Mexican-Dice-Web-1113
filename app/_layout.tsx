import { Analytics } from '@vercel/analytics/react';
import * as Notifications from 'expo-notifications';
import { Stack, usePathname, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { startRollingMusic, stopRollingMusic } from '../src/lib/globalMusic';
import { ensureUserProfile } from '../src/lib/auth';
import { initPushNotifications } from '../src/lib/pushNotifications';
import { useSettingsStore } from '../src/state/useSettingsStore';

const ANDROID_TURN_CHANNEL_ID = 'turns';

export default function RootLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const didHandleInitialNotification = useRef(false);
  const musicEnabled = useSettingsStore((state) => state.musicEnabled);

  // Ensure web root/background fills viewport and uses the dark gunmetal base
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const color = '#1B1D1F';
      const html = document.documentElement as HTMLElement;
      const body = document.body as HTMLElement;
      html.style.backgroundColor = color;
      html.style.height = '100%';
      body.style.margin = '0';
      body.style.padding = '0';
      body.style.minHeight = '100%';
      body.style.backgroundColor = color;
      const root = (document.getElementById('root') ||
        document.getElementById('__next') ||
        (document.querySelector('.expo-root') as HTMLElement | null));
      if (root) {
        root.style.minHeight = '100%';
        root.style.backgroundColor = color;
      }
    } catch {}
  }, []);

  useEffect(() => {
    const onSurvivalScreen = pathname?.includes('survival');
    const onInfernoScreen = pathname?.includes('inferno');

    if (!musicEnabled) {
      void stopRollingMusic();
      return;
    }

    if (onSurvivalScreen || onInfernoScreen) {
      void stopRollingMusic();
      return;
    }

    void startRollingMusic();
  }, [pathname, musicEnabled]);

  useEffect(() => {
    (async () => {
      try {
        const profile = await ensureUserProfile();

        // Push registration should:
        // - Run once per native app session
        // - Only run on iOS/Android (never web)
        // - Initialize as soon as the authenticated user is known
        // Validation:
        // - On Android: accepting notifications creates user_push_tokens row with platform='android'
        // - On iOS: existing behavior remains unchanged
        // - On web: registration is not attempted
        try {
          void initPushNotifications({ userId: profile.id, router });
        } catch (pushError) {
          if (__DEV__) {
            console.warn('[RootLayout] Failed to initialize push notifications', pushError);
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[RootLayout] Failed to ensure user profile on startup', error);
        }
      }
    })();
  }, [router]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let receivedSubscription: Notifications.Subscription | undefined;
    let responseSubscription: Notifications.Subscription | undefined;

    const handleNotificationResponse = async (
      response: Notifications.NotificationResponse
    ): Promise<void> => {
      try {
        const data = response.notification.request.content.data as { gameId?: string } | undefined;
        const gameId = data?.gameId;

        if (gameId) {
          router.push(`/online/game-v2/${gameId}`);
        } else {
          router.push('/online');
        }

        if (Platform.OS === 'ios') {
          await Notifications.setBadgeCountAsync(0);
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[RootLayout] Error handling notification response', err);
        }
      }
    };

    (async () => {
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync(ANDROID_TURN_CHANNEL_ID, {
            name: 'Turns',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            enableVibrate: true,
            vibrationPattern: [0, 250, 250, 250],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            showBadge: true,
          });
        } catch (err) {
          if (__DEV__) {
            console.warn('[RootLayout] Failed to configure Android notification channel', err);
          }
        }
      }

      try {
        await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowSound: true,
            allowBadge: true,
          },
        });
      } catch (err) {
        if (__DEV__) {
          console.warn('[RootLayout] Failed to request notification permissions', err);
        }
      }

      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse && !didHandleInitialNotification.current) {
          didHandleInitialNotification.current = true;
          await handleNotificationResponse(lastResponse);
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[RootLayout] Error handling last notification response', err);
        }
      }

      receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
        try {
          const data = notification.request.content.data as { badgeCount?: number | string } | undefined;
          const rawBadge = data?.badgeCount;
          let fromData: number | undefined;
          if (typeof rawBadge === 'number') {
            fromData = rawBadge;
          } else if (typeof rawBadge === 'string') {
            const parsed = Number(rawBadge);
            if (Number.isFinite(parsed)) {
              fromData = parsed;
            }
          }
          const fromContent =
            typeof notification.request.content.badge === 'number'
              ? notification.request.content.badge
              : undefined;
          const badgeCount = fromData ?? fromContent;

          if (Platform.OS === 'ios' && typeof badgeCount === 'number') {
            void Notifications.setBadgeCountAsync(badgeCount);
          }
        } catch (err) {
          if (__DEV__) {
            console.warn('[RootLayout] Error handling notification receipt', err);
          }
        }
      });

      responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        void handleNotificationResponse(response);
      });
    })();

    return () => {
      receivedSubscription?.remove();
      responseSubscription?.remove();
    };
  }, [router]);

  return (
    <>
      <Head>
        {/* Google tag (gtag.js) */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-27D1DYN90F"
        />
        <script>
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-27D1DYN90F');
          `}
        </script>
      </Head>

      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: '#1B1D1F' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#1B1D1F' },
        }}
      />
      {Platform.OS === 'web' && <Analytics />}
    </>
  );
}
