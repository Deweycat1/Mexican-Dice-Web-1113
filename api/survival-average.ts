// api/survival-average.ts
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const TOTAL_STREAKS_KEY = 'survival:totalStreaks';
const TOTAL_RUNS_KEY = 'survival:totalRuns';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const totalStreaks = (await kv.get<number>(TOTAL_STREAKS_KEY)) ?? 0;
      const totalRuns = (await kv.get<number>(TOTAL_RUNS_KEY)) ?? 0;
      const average = totalRuns > 0 ? totalStreaks / totalRuns : 0;
      return res.status(200).json({ average: Math.round(average * 100) / 100 });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
      const { streak } = body || {};

      if (typeof streak !== 'number' || streak < 0) {
        return res.status(400).json({ error: 'streak must be a non-negative number' });
      }

      // Increment total runs
      await kv.incr(TOTAL_RUNS_KEY);
      
      // Add streak to total
      const currentTotal = (await kv.get<number>(TOTAL_STREAKS_KEY)) ?? 0;
      await kv.set(TOTAL_STREAKS_KEY, currentTotal + streak);
      
      const totalStreaks = currentTotal + streak;
      const totalRuns = (await kv.get<number>(TOTAL_RUNS_KEY)) ?? 1;
      const average = totalRuns > 0 ? totalStreaks / totalRuns : 0;
      
      return res.status(200).json({ average: Math.round(average * 100) / 100 });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error('survival-average error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
