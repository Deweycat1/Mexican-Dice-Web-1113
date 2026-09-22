import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { ensureUserProfile } from '../src/lib/auth';

/**
 * Only honour `redirect` when it is a relative in-app path: a single leading
 * slash, not protocol-relative (`//host`), and no scheme (`https:`, `javascript:`).
 * Anything else falls back to the main menu so the param cannot be used to
 * bounce users to an external site.
 */
function safeRedirectPath(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  if (value.startsWith('/\\')) return '/';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return '/';
  if (/[\r\n\0]/.test(value)) return '/';
  return value;
}

export default function UsernameScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  React.useEffect(() => {
    async function autoAssignUsername() {
      setIsLoading(true);
      try {
        await ensureUserProfile();
        // Navigate to redirect destination or main menu
        const target = safeRedirectPath(redirect);
        router.replace(target as any);
      } catch {
        setErrorMessage('Failed to auto-assign username.');
      } finally {
        setIsLoading(false);
      }
    }
    autoAssignUsername();
  }, [redirect, router]);

  // Render loading spinner and error only
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Assigning Username...</Text>
      {isLoading && <ActivityIndicator color="#FFFFFF" />}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B3A26',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    maxWidth: 400,
  },
});
