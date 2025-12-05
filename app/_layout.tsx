// app/_layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { Stack, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { startRollingMusic, stopRollingMusic } from '../src/lib/globalMusic';
import { ensureUserProfile } from '../src/lib/auth';
import { useSettingsStore } from '../src/state/useSettingsStore';

export default function RootLayout() {
  const pathname = usePathname();
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
    const onSurvivalScreen = pathname?.startsWith('/survival');
    if (!musicEnabled || onSurvivalScreen) {
      void stopRollingMusic();
    } else {
      void startRollingMusic();
    }
  }, [pathname, musicEnabled]);

  useEffect(() => {
    (async () => {
      try {
        await ensureUserProfile();
      } catch (error) {
        if (__DEV__) {
          console.warn('[RootLayout] Failed to ensure user profile on startup', error);
        }
      }
    })();
  }, []);

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
