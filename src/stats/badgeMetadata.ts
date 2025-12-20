import { BadgeId } from './badges';

export type BadgeMeta = {
  id: BadgeId;
  title: string;
  icon: string; // emoji placeholder
  description: string;
};

export const BADGE_METADATA: Record<BadgeId, BadgeMeta> = {
  inferno_record_breaker: {
    id: 'inferno_record_breaker',
    title: 'Inferno Record Breaker',
    icon: '🔥', // new best Inferno streak
    description: 'Set a new global streak record in Inferno Survival mode.',
  },
  inferno_streak_5: {
    id: 'inferno_streak_5',
    title: 'Inferno Streak 5+',
    icon: '5️⃣',
    description: 'Reach a streak of at least 5 in a single Inferno Survival run.',
  },
  inferno_streak_10: {
    id: 'inferno_streak_10',
    title: 'Inferno Streak 10+',
    icon: '🔟',
    description: 'Reach a streak of at least 10 in a single Inferno Survival run.',
  },
  first_survivor: {
    id: 'first_survivor',
    title: 'First Survivor',
    icon: '🌱', // first real survival run
    description: 'Achieve your first solid survival run by reaching a streak of 5.',
  },
  true_survivor_20: {
    id: 'true_survivor_20',
    title: 'True Survivor',
    icon: '🏆',
    description: 'Reach a streak of at least 20 in a single Inferno Survival run.',
  },
  inferno_immortal: {
    id: 'inferno_immortal',
    title: 'Inferno Immortal',
    icon: '👑',
    description: 'Reach an all-time best Inferno Survival streak of 20 or more.',
  },
  pure_honesty: {
    id: 'pure_honesty',
    title: 'Pure Honesty',
    icon: '🤝', // no bluffs
    description: 'Win a normal game without bluffing a single time.',
  },
  silent_strategist: {
    id: 'silent_strategist',
    title: 'Silent Strategist',
    icon: '🤫', // few claims, quiet win
    description: 'Win a normal game while making three or fewer total claims.',
  },
  welcome_back_7_days: {
    id: 'welcome_back_7_days',
    title: 'Welcome Back',
    icon: '📅', // multiple days played
    description: 'Play on at least seven different days.',
  },
  inferno_week_7_day_streak: {
    id: 'inferno_week_7_day_streak',
    title: 'Inferno Week',
    icon: '🔥📅', // 7-day Inferno streak
    description: 'Play Inferno on seven consecutive days.',
  },
  bluff_catcher_5: {
    id: 'bluff_catcher_5',
    title: 'Bluff Catcher I',
    icon: '🕵️‍♂️',
    description: "Correctly call Infernoman's bluff at least five times.",
  },
  bluff_catcher_10: {
    id: 'bluff_catcher_10',
    title: 'Bluff Catcher II',
    icon: '🔎',
    description: "Correctly call Infernoman's bluff at least ten times.",
  },
  bluff_catcher_20: {
    id: 'bluff_catcher_20',
    title: 'Bluff Catcher III',
    icon: '👁️',
    description: "Correctly call Infernoman's bluff at least twenty times.",
  },
  inferno_letter_collector: {
    id: 'inferno_letter_collector',
    title: 'Fire Master',
    icon: '🔤',
    description: 'Collect all 7 Inferno letters in Inferno Mode.',
  },
};

export function getBadgeMeta(id: BadgeId): BadgeMeta {
  return BADGE_METADATA[id];
}
