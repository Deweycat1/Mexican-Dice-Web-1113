import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText as Text } from './AppText';
type Props = {
  containerStyle?: StyleProp<ViewStyle>;
  textColor?: string;
};

export function RulesContent({ containerStyle, textColor = '#E6FFE6' }: Props) {
  const colorStyle = { color: textColor };
  const generalGameplay = [
    {
      text: 'Players take turns rolling two dice with the goal to match or beat the previous roll.',
    },
    {
      text: 'Each roll is read as a two-digit number, with the higher die always listed first.',
    },
    { text: 'Doubles always outrank mixed rolls. (11 > 65)' },
    {
      text: 'After rolling, the active player must either:',
      subBullets: ['Claim the value actually rolled, or', 'Bluff by claiming a higher value.'],
    },
    {
      text: 'The next player must choose to:',
      subBullets: ['Beat the current claim, or', 'Call the bluff.'],
    },
  ];

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.heading, colorStyle]}>General Gameplay</Text>
      {generalGameplay.map((item) => (
        <View key={item.text}>
          <Text style={[styles.bullet, colorStyle]}>• {item.text}</Text>
          {item.subBullets?.map((subBullet) => (
            <Text key={subBullet} style={[styles.bullet, styles.subBullet, colorStyle]}>
              ◦ {subBullet}
            </Text>
          ))}
        </View>
      ))}

      <Text style={[styles.heading, colorStyle]}>Special Rolls</Text>

      <Text style={[styles.rollHeading, colorStyle]}>21 “Inferno”</Text>
      <Text style={[styles.paragraph, colorStyle]}>Claiming an Inferno makes the round worth 2 points. The next player must either:</Text>
      <Text style={[styles.bullet, colorStyle]}>• Roll for a real 21</Text>
      <Text style={[styles.bullet, colorStyle]}>• Call Bluff</Text>
      <Text style={[styles.paragraph, colorStyle]}>
        Whoever is wrong - caller or claimer - loses 2 points. A Reverse does not reduce this penalty.
      </Text>

      <Text style={[styles.rollHeading, colorStyle]}>31 “Reverse”</Text>
      <Text style={[styles.paragraph, colorStyle]}>
        A Reverse sends the challenge back to the previous player, who must now match or beat the reflected roll. You may always claim
        a Reverse (truth or bluff). If an Inferno gets reversed onto a player, the 2-point penalty still applies.
      </Text>

      <Text style={[styles.rollHeading, colorStyle]}>41 “Social”</Text>
      <Text style={[styles.paragraph, colorStyle]}>A Social must be shown and can never be bluffed. When rolled:</Text>
      <Text style={[styles.bullet, colorStyle]}>• The round resets</Text>
      <Text style={[styles.bullet, colorStyle]}>• All claims clear</Text>
      <Text style={[styles.bullet, colorStyle]}>• No points are lost</Text>
      <Text style={[styles.bullet, colorStyle]}>• Dice pass to the next player</Text>

      <Text style={[styles.heading, colorStyle]}>Bluffs</Text>
      <Text style={[styles.paragraph, colorStyle]}>
        If a bluff is suspected, a player may Call Bluff instead of accepting the claimed roll.
      </Text>

      <Text style={[styles.subheading, colorStyle]}>Normal Rounds</Text>
      <Text style={[styles.bullet, colorStyle]}>• Claim true → Caller loses 1 point</Text>
      <Text style={[styles.bullet, colorStyle]}>• Claim false → Bluffer loses 1 point</Text>

      <Text style={[styles.subheading, colorStyle]}>Inferno Rounds</Text>
      <Text style={[styles.bullet, colorStyle]}>• The loser always loses 2 points</Text>

      <Text style={[styles.heading, colorStyle]}>Live Selfies (Friend Matches Only)</Text>
      <Text style={[styles.paragraph, colorStyle]}>
        After rolling on a mobile device, you may attach a live selfie to your claim. You can send up
        to 3 selfies per match.
      </Text>
      <Text style={[styles.bullet, colorStyle]}>• Selfies must be taken live with the front camera</Text>
      <Text style={[styles.bullet, colorStyle]}>• The selfie is sent when you submit your claim</Text>
      <Text style={[styles.bullet, colorStyle]}>• Your opponent can view it until they roll or Call Bluff</Text>
      <Text style={[styles.bullet, colorStyle]}>• Both players&apos; selfies return in the match summary collage</Text>
      <Text style={[styles.bullet, colorStyle]}>• The finished collage can be shared from the match summary</Text>

      <Text style={[styles.heading, colorStyle]}>Scoring & Scorekeeper Dice</Text>
      <Text style={[styles.paragraph, colorStyle]}>
        Everyone starts with 5 points. Your scorekeeper die counts up as you lose points:
      </Text>
      <Text style={[styles.bullet, colorStyle]}>• Full health (5 points) → Die shows 1</Text>
      <Text style={[styles.bullet, colorStyle]}>• Losing points → Die climbs toward 6</Text>
      <Text style={[styles.bullet, colorStyle]}>• When it reaches 6 → You are at 0 and out</Text>
      <Text style={[styles.paragraph, colorStyle]}>This makes danger easy to read:</Text>
      <Text style={[styles.bullet, colorStyle]}>• Low die = safe</Text>
      <Text style={[styles.bullet, colorStyle]}>• High die = close to elimination</Text>
      <Text style={[styles.bullet, colorStyle]}>• Face 6 = game over</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    rowGap: 6,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  rollHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
  },
  bullet: {
    fontSize: 14,
    marginLeft: 12,
  },
  subBullet: {
    marginLeft: 22,
  },
});

export default RulesContent;
