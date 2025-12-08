import { Link } from 'expo-router';
import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MexicanDiceLogo from '../assets/images/mexican-dice-logo.png';

export default function SupportScreen() {
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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Us</Text>
            <Text style={styles.sectionBody}>
              If you run into any issues, have feedback, or want to report a bug, please email us
              and we&apos;ll get back to you as soon as we can.
            </Text>

            <Pressable
              onPress={handleEmailPress}
              style={({ pressed }) => [styles.primaryCta, pressed && styles.primaryCtaPressed]}
            >
              <Text style={styles.primaryCtaText}>Email InfernoDice Support</Text>
            </Pressable>
          </View>

          {/* Useful Links */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Useful Links</Text>
            <View style={styles.linkList}>
              <Link href="/privacy" asChild>
                <Pressable style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}>
                  <Text style={styles.linkLabel}>Privacy Policy</Text>
                  <Text style={styles.linkChevron}>›</Text>
                </Pressable>
              </Link>

              <Link href="/about" asChild>
                <Pressable style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}>
                  <Text style={styles.linkLabel}>About InfernoDice</Text>
                  <Text style={styles.linkChevron}>›</Text>
                </Pressable>
              </Link>
            </View>
          </View>

          {/* Response Time Note */}
          <View style={styles.footerNoteContainer}>
            <Text style={styles.footerNote}>
              We&apos;re a small indie team behind InfernoDice. We do our best to respond within a
              few business days.
            </Text>
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
  primaryCtaPressed: {
    opacity: 0.9,
  },
  primaryCtaText: {
    color: '#1B1D1F',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  linkList: {
    marginTop: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  linkRowPressed: {
    opacity: 0.85,
  },
  linkLabel: {
    fontSize: 15,
    color: '#C9D1D9',
    fontWeight: '600',
  },
  linkChevron: {
    fontSize: 18,
    color: '#6E7681',
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
});

