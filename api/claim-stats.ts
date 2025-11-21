// api/claim-stats.ts
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

const keyForClaim = (claim: string) => `claimStats:${claim}`;

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
    if (req.method === 'POST') {
      // body: { claim: "54" }
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
      const { claim } = body || {};

      if (typeof claim !== 'string' || !ALL_ROLLS.includes(claim)) {
        return res.status(400).json({ error: 'Invalid claim code' });
      }

      // increment global counter for that claim
      const newValue = await kv.incr(keyForClaim(claim));
      return res.status(200).json({ claim, count: newValue });
    }

    if (req.method === 'GET') {
      // Return full stats for all claims
      const entries = await Promise.all(
        ALL_ROLLS.map(async (claim) => {
          const value = (await kv.get<number>(keyForClaim(claim))) ?? 0;
          return [claim, value] as const;
        })
      );

      const data: Record<string, number> = {};
      for (const [claim, count] of entries) {
        data[claim] = count;
      }

      return res.status(200).json({ claims: data });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error('claim-stats error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
