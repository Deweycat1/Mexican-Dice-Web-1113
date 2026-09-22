// api/survival-best.ts
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { STREAK_MAX, isValidStreak, readGeo, rejectUnsupportedMethod, requireJsonBody } from './_lib/validate';

const GLOBAL_KEY = 'survival:globalBest';

export type SurvivalBest = {
  streak: number;
  updatedAt: string;  // ISO timestamp
  city?: string | null;
  state?: string | null; // region / state code
};

/** Normalize the stored value (legacy plain number or object) into SurvivalBest. */
function normalizeStored(stored: SurvivalBest | number | null | undefined): SurvivalBest {
  if (typeof stored === 'number') {
    return { streak: stored, updatedAt: new Date().toISOString(), city: null, state: null };
  }
  if (stored && typeof stored === 'object' && typeof stored.streak === 'number') {
    return stored;
  }
  return { streak: 0, updatedAt: new Date().toISOString(), city: null, state: null };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rejectUnsupportedMethod(req, res, ['GET', 'POST'])) return;

  try {
    if (req.method === 'GET') {
      const stored = await kv.get<SurvivalBest | number>(GLOBAL_KEY);
      return res.status(200).json(normalizeStored(stored));
    }

    // POST
    const body = requireJsonBody(req, res);
    if (!body) return;

    const { streak } = body;
    if (!isValidStreak(streak)) {
      return res.status(400).json({ error: `streak must be an integer between 0 and ${STREAK_MAX}` });
    }

    const stored = await kv.get<SurvivalBest | number>(GLOBAL_KEY);
    const currentBest = normalizeStored(stored);

    if (streak > currentBest.streak) {
      const { city, state } = readGeo(req);
      const survivalBest: SurvivalBest = {
        streak,
        updatedAt: new Date().toISOString(),
        city,
        state,
      };

      await kv.set(GLOBAL_KEY, survivalBest);
      return res.status(200).json({ ...survivalBest, updated: true });
    }

    return res.status(200).json({ ...currentBest, updated: false });
  } catch (err) {
    console.error('survival-best error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
