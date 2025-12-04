import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

type Props = {
  containerStyle?: StyleProp<ViewStyle>;
  textColor?: string;
};

export function RulesContent({ containerStyle, textColor = '#E6FFE6' }: Props) {
  const colorStyle = { color: textColor };
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.heading, colorStyle]}>General Gameplay</Text>
      <Text style={[styles.paragraph, colorStyle]}>
        Roll two dice and read them as a two-digit number with the higher die first (3 and 5 → 53).
      </Text>
      <Text style={[styles.paragraph, colorStyle]}>
        Doubles beat all mixed rolls (11 beats 66), and Special Rolls are explained below.
      </Text>
      <Text style={[styles.paragraph, colorStyle]}>
        After you roll, you make a claim to the next player - either truthful or a bluff. You may claim any roll that matches or beats
        the last claim, or you may claim a Special Roll (21 or 31). You cannot bluff a 41.
      </Text>

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

      <Text style={[styles.heading, colorStyle]}>Wink Feature (Multiplayer Only)</Text>
      <Text style={[styles.paragraph, colorStyle]}>
        Winks let you add personality to a multiplayer match. They do not affect gameplay…they are just extra mind games to enhance the
        bluffing chaos. You get 3 winks per game, so use them wisely.
      </Text>
      <Text style={[styles.paragraph, colorStyle]}>When you send a wink:</Text>
      <Text style={[styles.bullet, colorStyle]}>• Your opponent sees a 😉 notification</Text>
      <Text style={[styles.bullet, colorStyle]}>• They have no idea why you winked</Text>
      <Text style={[styles.bullet, colorStyle]}>• Did you roll something big?</Text>
      <Text style={[styles.bullet, colorStyle]}>• Are you bluffing?</Text>
      <Text style={[styles.bullet, colorStyle]}>• Or just trying to scare them?</Text>

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
});

export default RulesContent;
