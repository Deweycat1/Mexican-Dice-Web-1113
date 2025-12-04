import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function SurvivalRulesContent() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Survival Mode Rules</Text>
      <Text style={styles.subtitle}>(A streamlined, single player twist on Inferno Dice)</Text>

      <Text style={styles.heading}>How Survival Works</Text>
      <Text style={styles.paragraph}>You face off against the Rival in an endless series of rounds.</Text>
      <Text style={styles.paragraph}>Each time you win a round, your streak increases.</Text>
      <Text style={styles.paragraph}>If you lose a round, your streak ends immediately.</Text>
      <Text style={styles.paragraph}>There are no points or scorekeeper dice in Survival Mode.</Text>
      <Text style={styles.paragraph}>Your only objective is simple: survive as long as possible.</Text>

      <Text style={styles.heading}>Rolling and Claims</Text>
      <Text style={styles.paragraph}>
        Each roll gives you two dice, read as a two digit number with the higher die first (3 and 5 → 53).
      </Text>

      <Text style={styles.heading}>Turn Structure</Text>
      <Text style={styles.paragraph}>1. Rival makes the opening claim.</Text>
      <Text style={styles.paragraph}>2. You roll the dice.</Text>
      <Text style={styles.paragraph}>3. You must either:</Text>
      <Text style={styles.bullet}>• Claim your roll truthfully</Text>
      <Text style={styles.bullet}>• Bluff with a higher legal claim</Text>
      <Text style={styles.bullet}>• Call Bluff if you think the Rival lied</Text>
      <Text style={styles.paragraph}>
        A claim must match or beat the active challenge unless it is a Special Roll. You may never bluff a 41 Social.
      </Text>

      <Text style={styles.heading}>Dice Ranking</Text>
      <Text style={styles.paragraph}>From lowest to highest:</Text>
      <Text style={styles.bullet}>• Mixed rolls → Doubles → Special Rolls</Text>
      <Text style={styles.paragraph}>Doubles beat all mixed rolls.</Text>

      <Text style={styles.heading}>Special Rolls</Text>

      <Text style={styles.rollHeading}>21 Inferno</Text>
      <Text style={styles.paragraph}>The highest roll in the game.</Text>
      <Text style={styles.paragraph}>
        If you win a round using an Inferno, whether truth or bluff, your streak increases by 2 instead of 1.
      </Text>
      <Text style={styles.paragraph}>When an Inferno is claimed, the opponent must either:</Text>
      <Text style={styles.bullet}>• Roll a real 21</Text>
      <Text style={styles.bullet}>• Call Bluff</Text>
      <Text style={styles.paragraph}>Inferno retains its power even when reversed.</Text>

      <Text style={styles.rollHeading}>31 Reverse</Text>
      <Text style={styles.paragraph}>A Reverse reflects the challenge back to the previous player.</Text>
      <Text style={styles.paragraph}>Example:</Text>
      <Text style={styles.paragraph}>If the Rival reverses onto you, you must beat your own previous claim.</Text>
      <Text style={styles.paragraph}>You may always claim a Reverse, truthfully or as a bluff.</Text>
      <Text style={styles.paragraph}>If an Inferno is reversed onto a player, the plus two streak value still applies.</Text>

      <Text style={styles.rollHeading}>41 Social</Text>
      <Text style={styles.paragraph}>A Social cannot be claimed or bluffed. It must be shown immediately.</Text>
      <Text style={styles.paragraph}>When rolled:</Text>
      <Text style={styles.bullet}>• The round resets</Text>
      <Text style={styles.bullet}>• All claims clear</Text>
      <Text style={styles.bullet}>• No streak is added</Text>
      <Text style={styles.bullet}>• A new round begins with a fresh Rival claim</Text>

      <Text style={styles.heading}>Bluffing and Calling Bluff</Text>
      <Text style={styles.paragraph}>If you suspect the Rival lied, you may Call Bluff.</Text>
      <Text style={styles.paragraph}>If the Rival told the truth: Your streak ends.</Text>
      <Text style={styles.paragraph}>If the Rival was bluffing: You win the round and your streak increases.</Text>
      <Text style={styles.paragraph}>Streak increase amounts:</Text>
      <Text style={styles.bullet}>• Normal win → plus one</Text>
      <Text style={styles.bullet}>• Win involving an Inferno → plus two</Text>

      <Text style={styles.heading}>Winning a Round</Text>
      <Text style={styles.paragraph}>You win a round if:</Text>
      <Text style={styles.bullet}>• You beat the Rival’s claim, truth or bluff</Text>
      <Text style={styles.bullet}>• You call a bluff correctly</Text>
      <Text style={styles.bullet}>• You win through special roll logic such as Inferno or Reverse</Text>
      <Text style={styles.paragraph}>Every win increases your streak except 41 Social resets, which give no streak.</Text>

      <Text style={styles.heading}>Losing a Round</Text>
      <Text style={styles.paragraph}>Your Survival run ends immediately if:</Text>
      <Text style={styles.bullet}>• You fail to match or beat the active claim</Text>
      <Text style={styles.bullet}>• You are caught bluffing</Text>
      <Text style={styles.bullet}>• You incorrectly call a bluff</Text>
      <Text style={styles.bullet}>• Special roll logic causes you to lose</Text>

      <Text style={styles.heading}>Your Streak</Text>
      <Text style={styles.paragraph}>Your streak is the number of consecutive rounds you have won.</Text>
      <Text style={styles.paragraph}>You also track:</Text>
      <Text style={styles.bullet}>• Your Best (your personal record)</Text>
      <Text style={styles.bullet}>• Global Best (top streak across all players)</Text>
      <Text style={styles.paragraph}>Climb as high as you can and try to survive long enough to break the global record.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    rowGap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    color: '#E6FFE6',
  },
  subtitle: {
    fontSize: 14,
    color: '#C9F0D6',
    marginBottom: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
    color: '#E6FFE6',
  },
  rollHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
    color: '#E6FFE6',
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    color: '#E6FFE6',
  },
  bullet: {
    fontSize: 14,
    marginLeft: 12,
    color: '#E6FFE6',
  },
});
