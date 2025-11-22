import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Keys
const SURVIVAL_DEVICES_SET = 'survival:devices';
const SURVIVAL_OVER10_SET = 'survival:over10';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
      const { deviceId, streak } = body || {};

      if (!deviceId || typeof deviceId !== 'string') {
        return res.status(400).json({ error: 'deviceId is required and must be a string' });
      }
      if (typeof streak !== 'number' || streak < 0) {
        return res.status(400).json({ error: 'streak must be a non-negative number' });
      }

      // Ensure this device is tracked as a survival player
      await kv.sadd(SURVIVAL_DEVICES_SET, deviceId);

      // Per-device best key
      const bestKey = `survival:best:${deviceId}`;
      const currentBest = (await kv.get<number>(bestKey)) ?? 0;

      let updated = false;
      if (streak > currentBest) {
        await kv.set(bestKey, streak);
        updated = true;
      }

      // Maintain over-10 set membership (use the authoritative best value)
      const bestAfter = updated ? streak : currentBest;
      if (bestAfter > 10) {
        await kv.sadd(SURVIVAL_OVER10_SET, deviceId);
      } else {
        await kv.srem(SURVIVAL_OVER10_SET, deviceId);
      }

      return res.status(200).json({ deviceId, streak, updated });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in survival-run:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
