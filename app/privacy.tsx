import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText as Text } from '../src/components/AppText';
export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Privacy Policy</Text>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.card}>
          <Text style={styles.heading}>Privacy Policy for InfernoDice</Text>
          <Text style={styles.body}>
            Last updated: December 6, 2025
          </Text>

          <Text style={styles.sectionTitle}>1. Introduction</Text>
          <Text style={styles.body}>
            InfernoDice (“we”, “us”, or “our”) is a casual dice game built for entertainment. This
            Privacy Policy explains how we collect, use, and protect information when you use the
            InfernoDice app.
          </Text>

          <Text style={styles.sectionTitle}>2. Information We Collect</Text>
          <Text style={styles.subheading}>2.1. Information you provide</Text>
          <Text style={styles.body}>
            - Profile information such as your in‑game username or display name.{'\n'}
            - Any content you voluntarily submit through in‑app feedback forms or support channels.
          </Text>

          <Text style={styles.subheading}>2.2. Automatically collected information</Text>
          <Text style={styles.body}>
            When you use InfernoDice, we may automatically collect:
          </Text>
          <Text style={styles.body}>
            - Basic usage data, such as game modes played, matches started, and general interaction
            patterns (for example, how often you play).{'\n'}
            - Device and app information, such as device model, operating system version, app
            version, and performance or error logs.
          </Text>

          <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
          <Text style={styles.body}>
            We use the information we collect to:
          </Text>
          <Text style={styles.body}>
            - Operate the game and provide core features such as online matchmaking and statistics.{'\n'}
            - Maintain fair play and detect abuse or misuse of the service.{'\n'}
            - Understand how players use the game so we can fix bugs, improve balance, and design
            new features.{'\n'}
            - Generate anonymous, aggregated statistics about gameplay (for example, most common
            rolls or win rates).
          </Text>

          <Text style={styles.sectionTitle}>4. Analytics and Third‑Party Services</Text>
          <Text style={styles.body}>
            InfernoDice may use third‑party services (such as analytics and hosting providers) to
            help us understand usage and keep the game running reliably. These providers may process
            limited technical information on our behalf, such as IP address, device details, and
            usage events. We do not sell your personal information.
          </Text>

          <Text style={styles.sectionTitle}>5. Online Play and Usernames</Text>
          <Text style={styles.body}>
            When you play online, your chosen username and basic match data (for example, who you
            played and the outcome) may be visible to other players in lobbies or match history. Do
            not use a username that contains personal information you do not want to share.
          </Text>

          <Text style={styles.sectionTitle}>6. Data Retention</Text>
          <Text style={styles.body}>
            We keep gameplay and analytics data for as long as needed to support the game, analyze
            trends, and maintain fair play. If we no longer need certain data, we will delete it or
            anonymize it.
          </Text>

          <Text style={styles.sectionTitle}>7. Your Choices</Text>
          <Text style={styles.body}>
            - You can change your in‑game username from within the app where that option is
            provided.{'\n'}
            - You may choose not to play online modes if you prefer not to share match data with
            other players.{'\n'}
            - If your device or platform offers privacy controls (such as limiting ad tracking or
            analytics), those settings may further restrict the data shared with us or our
            providers.
          </Text>

          <Text style={styles.sectionTitle}>8. Children&apos;s Privacy</Text>
          <Text style={styles.body}>
            InfernoDice is not specifically directed at children. If you are a parent or guardian
            and believe that your child has provided personal information to us, please contact us
            so we can review and, if appropriate, delete that information.
          </Text>

          <Text style={styles.sectionTitle}>9. Data Security</Text>
          <Text style={styles.body}>
            We use reasonable technical and organizational measures to protect the information we
            collect. However, no online service can guarantee absolute security, and you use the app
            at your own risk.
          </Text>

          <Text style={styles.sectionTitle}>10. Changes to This Policy</Text>
          <Text style={styles.body}>
            We may update this Privacy Policy from time to time to reflect changes in the app or in
            applicable laws. When we do, we will adjust the “Last updated” date at the top of this
            page. Your continued use of InfernoDice after any changes means you accept the updated
            policy.
          </Text>

          <Text style={styles.sectionTitle}>11. Contact Us</Text>
          <Text style={styles.body}>
            If you have any questions or concerns about this Privacy Policy or how we handle data in
            InfernoDice, you can contact the developer team at:{'\n'}
            {'\n'}
            admin@infernodice.com
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerButtonsRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) =>
              StyleSheet.flatten([
                styles.menuButton,
                styles.footerButtonInline,
                pressed && styles.menuButtonPressed,
              ])
            }
          >
            <Text style={styles.menuButtonText}>Back</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/support')}
            style={({ pressed }) =>
              StyleSheet.flatten([
                styles.menuButton,
                styles.footerButtonInline,
                pressed && styles.menuButtonPressed,
              ])
            }
          >
            <Text style={styles.menuButtonText}>Support</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F262A',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginTop: 35,
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#2A3136',
    borderRadius: 18,
    padding: 18,
    rowGap: 12,
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F0F6FC',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F0F6FC',
    marginTop: 12,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F0F6FC',
    marginTop: 8,
    marginBottom: 2,
  },
  body: {
    fontSize: 14,
    color: '#C9D1D9',
    lineHeight: 20,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  footerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  menuButtonPressed: {
    opacity: 0.85,
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
