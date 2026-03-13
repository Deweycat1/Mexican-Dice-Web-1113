// api/roll-stats.ts
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// All valid normalized rolls: high die first
const ALL_ROLLS = [
  '11', '21', '31', '41', '51', '61',
  '22', '32', '42', '52', '62',
  '33', '43', '53', '63',
  '44', '54', '64',
  '55', '65',
  '66',
];

const keyForRoll = (roll: string) => `rollStats:${roll}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Ensure responses are never cached by browsers or edge/CDN.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      // body: { roll: "54" }
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
      const { roll } = body || {};

      if (typeof roll !== 'string' || !ALL_ROLLS.includes(roll)) {
        return res.status(400).json({ error: 'Invalid roll code' });
      }

      // increment global counter for that roll
      const newValue = await kv.incr(keyForRoll(roll));
      // also increment total roll counter
      await kv.incr('rollStats:total');
      return res.status(200).json({ roll, count: newValue });
    }

    if (req.method === 'GET') {
      res.setHeader('X-Stats-Generated-At', new Date().toISOString());
      res.setHeader('X-Stats-Env', process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown');
      // Return full stats for all rolls
      const entries = await Promise.all(
        ALL_ROLLS.map(async (roll) => {
          const value = (await kv.get<number>(keyForRoll(roll))) ?? 0;
          return [roll, value] as const;
        })
      );

      const data: Record<string, number> = {};
      for (const [roll, count] of entries) {
        data[roll] = count;
      }

      return res.status(200).json({ rolls: data });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error('roll-stats error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
