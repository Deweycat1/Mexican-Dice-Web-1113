import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText as Text } from '../src/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';

import MexicanDiceLogo from '../assets/images/mexican-dice-logo.png';

export default function SupportScreen() {
  const router = useRouter();
  const handleEmailPress = () => {
    void Linking.openURL('mailto:admin@infernodice.com');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          {/* Hero */}
          <View style={styles.heroSection}>
            <Image source={MexicanDiceLogo} style={styles.logo} />
            <Text style={styles.heroTitle}>InfernoDice Support</Text>
            <Text style={styles.heroSubtitle}>
              Need help or have a question about the game? You&apos;re in the right place.
            </Text>
          </View>

          {/* Contact */}
          <View style={[styles.section, styles.contactSection]}>
            <Text style={[styles.sectionTitle, styles.contactTitle]}>Contact Us</Text>
            <Text style={[styles.sectionBody, styles.contactBody]}>
              If you run into any issues, have feedback, or want to report a bug, please email us
              and we&apos;ll get back to you as soon as we can.
            </Text>

            <Pressable
              onPress={handleEmailPress}
              style={({ pressed }) => [
                styles.primaryCta,
                styles.primaryCtaCentered,
                pressed && styles.primaryCtaPressed,
              ]}
            >
              <Text style={styles.primaryCtaText}>Email InfernoDice Support</Text>
            </Pressable>
          </View>

          {/* Useful Links */}
          <View style={styles.section}>
            <View style={styles.footerButtonsRow}>
              <Pressable
                onPress={() => router.push('/privacy')}
                style={({ pressed }) =>
                  StyleSheet.flatten([
                    styles.menuButton,
                    styles.footerButtonInline,
                    pressed && styles.menuButtonPressed,
                  ])
                }
              >
                <Text style={styles.menuButtonText}>Privacy Policy</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push('/about')}
                style={({ pressed }) =>
                  StyleSheet.flatten([
                    styles.menuButton,
                    styles.menuButtonRed,
                    styles.footerButtonInline,
                    pressed && styles.menuButtonPressed,
                  ])
                }
              >
                <Text style={styles.menuButtonText}>About</Text>
              </Pressable>
            </View>
          </View>

          {/* Response Time Note */}
          <View style={styles.footerNoteContainer}>
            <Text style={styles.footerNote}>
              We&apos;re a small indie team behind InfernoDice. We do our best to respond within a
              few business days.
            </Text>
          </View>

          <View style={styles.backHomeContainer}>
            <Pressable
              onPress={() => router.push('/')}
              style={({ pressed }) =>
                StyleSheet.flatten([
                  styles.menuButton,
                  pressed && styles.menuButtonPressed,
                ])
              }
            >
              <Text style={styles.menuButtonText}>Back to Home</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1F262A',
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#C9D1D9',
    textAlign: 'center',
    maxWidth: 520,
  },
  section: {
    backgroundColor: '#2A3136',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  contactSection: {
    alignItems: 'center',
  },
  contactTitle: {
    textAlign: 'center',
  },
  contactBody: {
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F0F6FC',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 14,
    color: '#C9D1D9',
    lineHeight: 20,
    marginBottom: 14,
  },
  primaryCta: {
    backgroundColor: '#FE9902',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: '#B26B01',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    // @ts-ignore - boxShadow is web-only
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.4)',
  },
  primaryCtaCentered: {
    alignSelf: 'center',
  },
  primaryCtaPressed: {
    opacity: 0.9,
  },
  primaryCtaText: {
    color: '#1B1D1F',
    fontSize: 11.25,
    fontWeight: '800',
    textAlign: 'center',
  },
  footerNoteContainer: {
    marginTop: 6,
    paddingHorizontal: 4,
  },
  footerNote: {
    fontSize: 13,
    color: '#8B949E',
    textAlign: 'center',
  },
  footerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  menuButton: {
    backgroundColor: '#53A7F3',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderWidth: 2,
    borderColor: '#1C75BC',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    // @ts-ignore - boxShadow is web-only
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.4)',
  },
  footerButtonInline: {
    marginHorizontal: 8,
    alignSelf: 'auto',
  },
  menuButtonRed: {
    backgroundColor: '#B33636',
    borderColor: '#7A2424',
  },
  menuButtonPressed: {
    opacity: 0.85,
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  backHomeContainer: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
