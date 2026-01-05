// QR landing route for physical packaging (/app).
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '../src/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';

type DetectedPlatform = 'ios' | 'android' | 'other';

const CANONICAL_APPLE_APP_STORE_URL = 'https://apps.apple.com/app/id6756194760';
const CANONICAL_GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.infernodice.infernodice';

const resolveEnvUrl = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const env = typeof process !== 'undefined' ? process.env : undefined;
const APPLE_APP_STORE_URL =
  resolveEnvUrl(env?.EXPO_PUBLIC_APPLE_APP_STORE_URL ?? env?.APPLE_APP_STORE_URL) ??
  CANONICAL_APPLE_APP_STORE_URL;
const GOOGLE_PLAY_URL =
  resolveEnvUrl(env?.EXPO_PUBLIC_GOOGLE_PLAY_URL ?? env?.GOOGLE_PLAY_URL) ??
  CANONICAL_GOOGLE_PLAY_URL;

export default function AppRedirectScreen() {
  const [platform, setPlatform] = useState<DetectedPlatform>('other');
  const redirectScheduled = useRef(false);

  const hasAppleUrl = APPLE_APP_STORE_URL.length > 0;
  const hasGoogleUrl = GOOGLE_PLAY_URL.length > 0;
  const isComingSoon = !hasAppleUrl || !hasGoogleUrl;
  const shouldRedirect =
    (platform === 'ios' && hasAppleUrl) || (platform === 'android' && hasGoogleUrl);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const ua = navigator.userAgent || '';
    const detected: DetectedPlatform = /iPad|iPhone|iPod/i.test(ua)
      ? 'ios'
      : /Android/i.test(ua)
        ? 'android'
        : 'other';

    setPlatform(detected);

    if (redirectScheduled.current) return;

    const targetUrl =
      detected === 'ios' ? APPLE_APP_STORE_URL : detected === 'android' ? GOOGLE_PLAY_URL : '';

    if (!targetUrl) return;

    redirectScheduled.current = true;
    const timer = setTimeout(() => {
      window.location.href = targetUrl;
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const handleOpenUrl = (url: string) => {
    if (!url) return;
    void Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Get the app</Text>
        {shouldRedirect ? (
          <Text style={styles.subtitle}>Taking you to the store…</Text>
        ) : (
          <Text style={styles.note}>
            If you scanned a QR code from the box, you’re in the right place.
          </Text>
        )}
        {isComingSoon ? <Text style={styles.subtitle}>Coming soon.</Text> : null}

        <View style={styles.buttonRow}>
          {hasAppleUrl ? (
            <Pressable
              accessibilityRole="button"
              style={[styles.button, styles.appleButton]}
              onPress={() => handleOpenUrl(APPLE_APP_STORE_URL)}
            >
              <Text style={styles.buttonText}>App Store</Text>
            </Pressable>
          ) : null}
          {hasGoogleUrl ? (
            <Pressable
              accessibilityRole="button"
              style={[styles.button, styles.googleButton]}
              onPress={() => handleOpenUrl(GOOGLE_PLAY_URL)}
            >
              <Text style={[styles.buttonText, styles.googleButtonText]}>Google Play</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0F1115',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F4F5F7',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#C7CAD1',
    textAlign: 'center',
  },
  note: {
    fontSize: 13,
    color: '#8E949E',
    textAlign: 'center',
    maxWidth: 320,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  appleButton: {
    backgroundColor: '#FFFFFF',
  },
  googleButton: {
    backgroundColor: '#1E232B',
    borderWidth: 1,
    borderColor: '#2D3440',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101318',
  },
  googleButtonText: {
    color: '#F4F5F7',
  },
});
