import { Link } from 'expo-router';
import React from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MexicanDiceLogo from '../assets/images/mexican-dice-logo.png';
import { FlameEmojiIcon } from '../src/components/FlameEmojiIcon';
import IceEmojiIcon from '../src/components/IceEmojiIcon';

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          {/* Hero */}
          <View style={styles.heroSection}>
            <Image source={MexicanDiceLogo} style={styles.logo} />
            <Text style={styles.heroTitle}>InfernoDice: The Ultimate Bluffing Dice Battle</Text>
            <Text style={styles.heroSubtitle}>
              Roll the dice, read your opponents, and see how long you can survive the heat.
            </Text>

            <View style={styles.heroCtaRow}>
              <Link href="/game" asChild>
                <View style={styles.primaryCta}>
                  <Text style={styles.primaryCtaText}>Play InfernoDice</Text>
                </View>
              </Link>
              <Link href="/rules" asChild>
                <View style={styles.secondaryCta}>
                  <Text style={styles.secondaryCtaText}>How to Play</Text>
                </View>
              </Link>
            </View>
          </View>

          {/* What is InfernoDice */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What Is InfernoDice?</Text>
            <Text style={styles.sectionBody}>
              InfernoDice is a fast...paced bluffing dice game where every roll could spark a
              comeback or burn your last point. Claim your roll honestly...or bluff your way to
              victory. Your friends just have to decide: do they believe you?
            </Text>
            <Text style={styles.sectionBody}>
              Built for quick sessions and long streaks alike, InfernoDice turns simple dice into a
              mind game of risk, courage, and perfectly timed lies.
            </Text>

            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• Bold bluffing and call...out moments every round.</Text>
              <Text style={styles.bulletItem}>
                • Special rolls like 21 (Inferno), 31 (Reverse), and 41 (Social) that flip the
                table.
              </Text>
              <Text style={styles.bulletItem}>
                • Multiple ways to play: quick single...player, Survival streaks, and online matches.
              </Text>
            </View>
          </View>

          {/* Key Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Features</Text>
            <View style={styles.featureGrid}>
              <View style={styles.featureCard}>
                <FlameEmojiIcon size={28} style={styles.featureIconImage} />
                <Text style={styles.featureTitle}>Inferno Mode</Text>
                <Text style={styles.featureBody}>
                  Push your streak as far as you can in Survival while every mistake burns a point.
                </Text>
              </View>

              <View style={styles.featureCard}>
                <IceEmojiIcon size={28} style={styles.featureIconImage} />
                <Text style={styles.featureTitle}>Ice Cold Strategy</Text>
                <Text style={styles.featureBody}>
                  Bluff, call, and read patterns in your opponents’ claims to stay one step ahead.
                </Text>
              </View>

              <View style={styles.featureCard}>
                <Image
                  source={require('../assets/images/InfernoDiceEmoji.png')}
                  style={[styles.featureIconImage, styles.featureIconDice]}
                />
                <Text style={styles.featureTitle}>Special Rolls</Text>
                <Text style={styles.featureBody}>
                  21 (Inferno) tops the table, 31 (Reverse) flips the pressure, and 41 (Social)
                  resets the room.
                </Text>
              </View>

              <View style={styles.featureCard}>
                <Text style={styles.featureIcon}>🌐</Text>
                <Text style={styles.featureTitle}>Play With Friends</Text>
                <Text style={styles.featureBody}>
                  Jump into online matches, trade bluffs, and see who keeps their cool under
                  pressure.
                </Text>
              </View>
            </View>
          </View>

          {/* How It Works */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How It Works</Text>
            <View style={styles.stepsContainer}>
              <View style={styles.stepCard}>
                <View style={styles.stepNumberColumn}>
                  <Text style={styles.stepNumber}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Roll the dice</Text>
                  <Text style={styles.stepBody}>
                    Each turn starts with a hidden roll behind your claim.
                  </Text>
                </View>
              </View>
              <View style={styles.stepCard}>
                <View style={styles.stepNumberColumn}>
                  <Text style={styles.stepNumber}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Make your claim</Text>
                  <Text style={styles.stepBody}>
                    Tell the truth or bluff a higher value...your opponent only sees what you say.
                  </Text>
                </View>
              </View>
              <View style={styles.stepCard}>
                <View style={styles.stepNumberColumn}>
                  <Text style={styles.stepNumber}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Beat it or call it</Text>
                  <Text style={styles.stepBody}>
                    Your opponent must claim something stronger or call your bluff and face the
                    consequences.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Built to Grow */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Built to Grow</Text>
            <Text style={styles.sectionBody}>
              InfernoDice is actively developed and tuned based on real player feedback. We&apos;re
              refining AI opponents, polishing online play, and experimenting with new twists to
              keep every session feeling fresh.
            </Text>
          </View>

          {/* Support & Privacy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support &amp; Privacy</Text>
            <Text style={styles.sectionBody}>
              Need help, found a bug, or have an idea for a new feature? We&apos;d love to hear
              from you.
            </Text>
            <Text
              style={styles.linkText}
              onPress={() => {
                void Linking.openURL('mailto:admin@infernodice.com');
              }}
            >
              admin@infernodice.com
            </Text>

            <Text style={[styles.sectionBody, { marginTop: 12 }]}>
              For details on how we handle data and analytics, read our Privacy Policy.
            </Text>
            <Link href="/privacy" asChild>
              <View style={styles.privacyLinkButton}>
                <Text style={styles.privacyLinkText}>View Privacy Policy</Text>
              </View>
            </Link>
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
    marginBottom: 32,
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
  heroCtaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 20,
    gap: 12,
  },
  primaryCta: {
    backgroundColor: '#FE9902',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderWidth: 2,
    borderColor: '#B26B01',
    // @ts-ignore - boxShadow is web-only
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.4)',
  },
  primaryCtaText: {
    color: '#1B1D1F',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryCta: {
    backgroundColor: '#42C6FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#1E8AC4',
    // @ts-ignore - boxShadow is web-only
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.4)',
  },
  secondaryCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
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
  },
  bulletList: {
    marginTop: 12,
    rowGap: 6,
  },
  bulletItem: {
    fontSize: 14,
    color: '#C9D1D9',
    lineHeight: 20,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  featureCard: {
    backgroundColor: '#1F262A',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    width: '48%',
    minWidth: 150,
  },
  featureIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  featureIconImage: {
    marginBottom: 4,
  },
  featureIconDice: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F0F6FC',
    marginBottom: 4,
  },
  featureBody: {
    fontSize: 13,
    color: '#C9D1D9',
    lineHeight: 18,
  },
  stepsContainer: {
    flexDirection: 'column',
    rowGap: 12,
    marginBottom: 8,
  },
  stepCard: {
    backgroundColor: '#1F262A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  stepNumberColumn: {
    width: 32,
    alignItems: 'center',
    marginRight: 10,
  },
  stepNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FE9902',
    marginBottom: 0,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F0F6FC',
    marginBottom: 2,
  },
  stepBody: {
    fontSize: 13,
    color: '#C9D1D9',
    lineHeight: 18,
  },
  linkText: {
    fontSize: 14,
    color: '#42C6FF',
    fontWeight: '600',
    marginTop: 8,
  },
  privacyLinkButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#42C6FF',
  },
  privacyLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C9D1D9',
  },
});
