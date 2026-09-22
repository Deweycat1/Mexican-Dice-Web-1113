// api/roll-stats.ts
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { ALL_ROLL_CODES, isRollCode, rejectUnsupportedMethod, requireJsonBody } from './_lib/validate';

const keyForRoll = (roll: string) => `rollStats:${roll}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rejectUnsupportedMethod(req, res, ['GET', 'POST'])) return;

  try {
    if (req.method === 'POST') {
      // body: { roll: "54" }
      const body = requireJsonBody(req, res);
      if (!body) return;

      const { roll } = body;
      if (!isRollCode(roll)) {
        return res.status(400).json({ error: 'Invalid roll code' });
      }

      // increment global counter for that roll
      const newValue = await kv.incr(keyForRoll(roll));
      // also increment total roll counter
      await kv.incr('rollStats:total');
      return res.status(200).json({ roll, count: newValue });
    }

    // GET: return full stats for all rolls
    res.setHeader('X-Stats-Generated-At', new Date().toISOString());
    res.setHeader('X-Stats-Env', process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown');

    const entries = await Promise.all(
      ALL_ROLL_CODES.map(async (roll) => {
        const value = (await kv.get<number>(keyForRoll(roll))) ?? 0;
        return [roll, value] as const;
      })
    );

    const data: Record<string, number> = {};
    for (const [roll, count] of entries) {
      data[roll] = count;
    }

    return res.status(200).json({ rolls: data });
  } catch (err) {
    console.error('roll-stats error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
