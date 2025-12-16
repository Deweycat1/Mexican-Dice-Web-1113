// app/_layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { Stack, usePathname, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { startRollingMusic, stopRollingMusic } from '../src/lib/globalMusic';
import { ensureUserProfile } from '../src/lib/auth';
import { initPushNotifications } from '../src/lib/pushNotifications';
import { useSettingsStore } from '../src/state/useSettingsStore';

export default function RootLayout() {
  const pathname = usePathname();
  const router = useRouter();
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
