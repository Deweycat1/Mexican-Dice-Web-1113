import { BadgeId } from './badges';

export type BadgeMeta = {
  id: BadgeId;
  title: string;
  icon: string; // emoji placeholder
};

export const BADGE_METADATA: Record<BadgeId, BadgeMeta> = {
  inferno_record_breaker: {
    id: 'inferno_record_breaker',
    title: 'Inferno Record Breaker',
    icon: '🔥', // new best Inferno streak
  },
  inferno_streak_5: {
    id: 'inferno_streak_5',
    title: 'Inferno Streak 5+',
    icon: '5️⃣',
  },
  inferno_streak_10: {
    id: 'inferno_streak_10',
    title: 'Inferno Streak 10+',
    icon: '🔟',
  },
  first_survivor: {
    id: 'first_survivor',
    title: 'First Survivor',
    icon: '🌱', // first real survival run
  },
  true_survivor_20: {
    id: 'true_survivor_20',
    title: 'True Survivor',
    icon: '🏆',
  },
  inferno_immortal: {
    id: 'inferno_immortal',
    title: 'Inferno Immortal',
    icon: '👑',
  },
  pure_honesty: {
    id: 'pure_honesty',
    title: 'Pure Honesty',
    icon: '🤝', // no bluffs
  },
  silent_strategist: {
    id: 'silent_strategist',
    title: 'Silent Strategist',
    icon: '🤫', // few claims, quiet win
  },
  welcome_back_7_days: {
    id: 'welcome_back_7_days',
    title: 'Welcome Back',
    icon: '📅', // multiple days played
  },
  inferno_week_7_day_streak: {
    id: 'inferno_week_7_day_streak',
    title: 'Inferno Week',
    icon: '🔥📅', // 7-day Inferno streak
  },
  bluff_catcher_5: {
    id: 'bluff_catcher_5',
    title: 'Bluff Catcher I',
    icon: '🕵️‍♂️',
  },
  bluff_catcher_10: {
    id: 'bluff_catcher_10',
    title: 'Bluff Catcher II',
    icon: '🔎',
  },
  bluff_catcher_20: {
    id: 'bluff_catcher_20',
    title: 'Bluff Catcher III',
    icon: '👁️',
  },
};

export function getBadgeMeta(id: BadgeId): BadgeMeta {
  return BADGE_METADATA[id];
}
