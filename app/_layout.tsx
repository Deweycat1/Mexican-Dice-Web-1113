// app/_layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { getOrCreateDeviceId, isDeviceCounted, markDeviceAsCounted } from '../src/utils/deviceId';

export default function RootLayout() {
  // Initialize device tracking
  useEffect(() => {
    const initDeviceTracking = async () => {
      try {
        // Get or create device ID
        const deviceId = await getOrCreateDeviceId();
        
        // Check if this device has already been counted
        const alreadyCounted = await isDeviceCounted();
        
        if (!alreadyCounted) {
          // Call API to register this device
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
          
          const response = await fetch(`${baseUrl}/api/update-unique-devices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId }),
          });
          
          if (response.ok) {
            // Mark device as counted
            await markDeviceAsCounted();
            const data = await response.json();
            console.log('Device registered. Total unique devices:', data.count);
          }
        }
      } catch (error) {
        console.error('Error initializing device tracking:', error);
        // Silently fail - don't block app initialization
      }
    };
    
    initDeviceTracking();
  }, []);

  // Ensure web root/background fills viewport and uses the canonical dark green
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const color = '#0B3A26';
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
          headerStyle: { backgroundColor: '#0B3A26' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#0B3A26' },
        }}
      />
      {Platform.OS === 'web' && <Analytics />}
    </>
  );
}
