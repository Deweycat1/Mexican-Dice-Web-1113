import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// NOTE: Total API routes should be 12. Verified on 2025-01-27.

/**
 * Returns the average Survival Mode streak across all completed runs.
 * The survival-run API maintains aggregate sum/count values in Upstash KV.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [totalRaw, countRaw] = await Promise.all([
      kv.get<number>('survival:streak:total'),
      kv.get<number>('survival:streak:count'),
    ]);

    const total = typeof totalRaw === 'number' ? totalRaw : 0;
    const count = typeof countRaw === 'number' ? countRaw : 0;

    const average =
      count > 0 ? Number((total / count).toFixed(2)) : 0;

    return res.status(200).json({
      averageSurvivalStreak: average,
      sampleSize: count,
    });
  } catch (error) {
    console.error('Error in survival-average-streak:', error);
    return res.status(500).json({
      averageSurvivalStreak: 0,
      sampleSize: 0,
      error: 'Unable to compute survival average streak',
    });
  }
}
