import type { VercelRequest, VercelResponse } from '@vercel/node';

import averageStreak from './_lib/survival/survival-average-streak';
import best from './_lib/survival/survival-best';
import over10 from './_lib/survival/survival-over10';
import run from './_lib/survival/survival-run';

/**
 * Single serverless function for all survival-stat endpoints.
 *
 * Vercel's Hobby plan allows at most 12 serverless functions per deployment; the four survival
 * handlers used to be four functions. `vercel.json` rewrites the original URLs
 * (/api/survival-best, /api/survival-run, ...) here with a `kind` query parameter, so nothing
 * in the app had to change.
 */
const HANDLERS: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown>> = {
  best,
  run,
  over10,
  'average-streak': averageStreak,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.kind;
  const kind = Array.isArray(raw) ? raw[0] : raw;
  const target = kind ? HANDLERS[kind] : undefined;
  if (!target) {
    return res.status(404).json({ error: 'Unknown survival endpoint' });
  }
  return target(req, res);
}
