// Dialog lines for Quick Play screen
// Important: Use only plain hyphens (-), no long dashes

export const userPointWinLines = [
  "I'll take that, thanks!",
  "How’s that sting, trickster?",
  "Your gremlins distracted you, huh?",
  "Looks like momentum is shifting.",
  "Wobbling already?",
  "Oops. That one was mine.",
  "Just warming up over here!",
  "Nice try — almost.",
  "Getting nervous yet?",
  "Another one for me!",
  "You're making this too easy.",
  "Your imps are losing faith!",
];

export const rivalPointWinLines = [
  "Mmm, tasty victory!",
  "Chaos favors me today!",
  "Oh? Was that your plan? Bold.",
  "You’re beginning to wobble.",
  "My imps are celebrating already.",
  "That point practically walked to me.",
  "A delightful little win!",
  "Need a moment to collect yourself?",
  "Predictable. Charming, but predictable.",
  "Luck winks at me again!",
  "I expected more… but I’ll take this.",
  "This is fun. For me, anyway.",
];

export function pickRandomLine(lines: string[]): string {
  if (lines.length === 0) return "";
  const idx = Math.floor(Math.random() * lines.length);
  return lines[idx];
}
