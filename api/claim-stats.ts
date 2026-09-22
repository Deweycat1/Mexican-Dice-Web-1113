// api/claim-stats.ts
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { ALL_ROLL_CODES, isRollCode, rejectUnsupportedMethod, requireJsonBody } from './_lib/validate';

const keyForClaim = (claim: string) => `claimStats:${claim}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rejectUnsupportedMethod(req, res, ['GET', 'POST'])) return;

  try {
    if (req.method === 'POST') {
      // body: { claim: "54" }
      const body = requireJsonBody(req, res);
      if (!body) return;

      const { claim } = body;
      if (!isRollCode(claim)) {
        return res.status(400).json({ error: 'Invalid claim code' });
      }

      // increment global counter for that claim
      const newValue = await kv.incr(keyForClaim(claim));
      return res.status(200).json({ claim, count: newValue });
    }

    // GET: return full stats for all claims
    res.setHeader('X-Stats-Generated-At', new Date().toISOString());
    res.setHeader('X-Stats-Env', process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown');

    const entries = await Promise.all(
      ALL_ROLL_CODES.map(async (claim) => {
        const value = (await kv.get<number>(keyForClaim(claim))) ?? 0;
        return [claim, value] as const;
      })
    );

    const data: Record<string, number> = {};
    for (const [claim, count] of entries) {
      data[claim] = count;
    }

    return res.status(200).json({ claims: data });
  } catch (err) {
    console.error('claim-stats error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
