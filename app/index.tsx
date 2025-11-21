import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import MexicanDiceLogo from '../assets/images/mexican-dice-logo.png';
import { supabase } from '../src/lib/supabase';

export default function HomeScreen() {
  const router = useRouter();

  const handleOnlinePress = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      if (storedUserId) {
        router.push('/online' as any);
      } else {
        router.push({
          pathname: '/username' as any,
          params: { redirect: '/online' },
        } as any);
      }
    } catch (e) {
      console.log('Error checking stored user id', e);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={MexicanDiceLogo} style={styles.logo} />
      <Text style={styles.subtitle}>Ready to roll?</Text>

      <Link href="/game" style={styles.button}>
        <Text style={styles.buttonText}>Quick Play</Text>
      </Link>

      <Link href="/survival" style={styles.button}>
        <Text style={styles.buttonText}>Survival Mode</Text>
      </Link>

      <Pressable 
        onPress={handleOnlinePress}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>Play Online with a Friend</Text>
      </Pressable>

      <Link href="/stats" style={styles.buttonStats}>
        <Text style={styles.buttonText}>Stats</Text>
      </Link>

      <Link href="/rules" style={styles.buttonRules}>
        <Text style={styles.buttonText}>Rules</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0B3A26', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  logo: {
    width: 180,
    height: 180,
    resizeMode: 'contain',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  subtitle: { 
    fontSize: 15, 
    color: '#E6FFE6', 
    marginBottom: 20 
  },
  button: { 
    backgroundColor: '#C21807',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    // @ts-ignore - boxShadow is web-only
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.4)',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: '#8B0000',
  },
  buttonStats: { 
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    // @ts-ignore - boxShadow is web-only
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.4)',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: '#B8860B',
  },
  buttonRules: { 
    backgroundColor: '#0FA958',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    // @ts-ignore - boxShadow is web-only
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.4)',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: '#006400',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '700',
    textAlign: 'center',
  },
});
