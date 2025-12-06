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
  "Mmm... sizzling victory.",
  "The flames pick me.",
  "Ooh... scorched you.",
  "Feeling the heat yet?",
  "My imps are blazing.",
  "That point combusted nicely.",
  "A spicy little win.",
  "Need to cool off?",
  "Predictable... easy to burn.",
  "Luck sparks for me again.",
  "Expected... still satisfying.",
  "Too hot for you?",
];

export function pickRandomLine(lines: string[]): string {
  if (lines.length === 0) return "";
  const idx = Math.floor(Math.random() * lines.length);
  return lines[idx];
}
