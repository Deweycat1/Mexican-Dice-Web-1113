// Dialog lines for Quick Play screen
// Important: Use only plain hyphens (-), no long dashes

export const userPointWinLines = [
  'Ice cold.',
  'Frostbite, bud.',
  'Chill out, Inferno.',
  'Your flame’s fading.',
  'Slipped again?',
  'Frozen solid.',
  'Too cold for you?',
  'That melt hurt?',
  'Thin ice, pal.',
  'Cool as ever.',
  'Snowballing now.',
  'I’ll stash that.',
  'Steam’s dying.',
  'Your heat’s weak.',
  'Another freeze.',
  'Cold snap!',
  'Winter wins again.',
  'That’s iced.',
  'Frosted ya.',
  'Chill winds blow.',
  'Cold claim!',
  'I’m glacier-strong.',
  'Ice rising.',
  'Your fire’s trembling.',
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
