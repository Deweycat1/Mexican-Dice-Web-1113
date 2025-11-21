// Dialog lines for Quick Play screen
// Important: Use only plain hyphens (-), no long dashes

export const userPointWinLines = [
  "I will take that point, thanks.",
  "Slipping already.",
  "You feeling ok over there.",
  "Looks like momentum is shifting.",
  "Do not worry, it happens to the best demons.",
  "That has to sting.",
  "Oops. That one was mine.",
  "I am just getting started.",
  "Nice try, but not quite.",
  "Getting nervous yet.",
  "Another one bites the dust.",
  "You are making this too easy.",
];

export const rivalPointWinLines = [
  "Delicious. More, please.",
  "Your downfall is entertaining.",
  "Was that your plan. Bold.",
  "You are unraveling.",
  "I could get used to this.",
  "That point was practically a gift.",
  "The dice favor me today.",
  "Do you need a moment.",
  "Predictable as always.",
  "Your luck is running out.",
  "I expected more resistance.",
  "This is almost too easy.",
];

export function pickRandomLine(lines: string[]): string {
  if (lines.length === 0) return "";
  const idx = Math.floor(Math.random() * lines.length);
  return lines[idx];
}
