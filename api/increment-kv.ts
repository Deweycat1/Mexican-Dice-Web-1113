import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { key } = body;

      if (!key || typeof key !== 'string') {
        return res.status(400).json({ error: 'Invalid key' });
      }

      await kv.incr(key);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in increment-kv:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
