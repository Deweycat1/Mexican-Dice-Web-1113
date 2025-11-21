// api/quickplay-best.ts
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const GLOBAL_KEY = 'quickplay:globalBest';

export type QuickPlayBest = {
  streak: number;
  updatedAt: string;  // ISO timestamp
  city?: string | null;
  state?: string | null; // region / state code
};

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
      const stored = await kv.get<QuickPlayBest | number>(GLOBAL_KEY);
      
      // Backward compatibility: if stored value is a number, convert to QuickPlayBest
      let quickPlayBest: QuickPlayBest;
      if (typeof stored === 'number') {
        quickPlayBest = {
          streak: stored,
          updatedAt: new Date().toISOString(),
          city: null,
          state: null,
        };
      } else if (stored && typeof stored === 'object') {
        quickPlayBest = stored;
      } else {
        quickPlayBest = {
          streak: 0,
          updatedAt: new Date().toISOString(),
          city: null,
          state: null,
        };
      }
      
      return res.status(200).json(quickPlayBest);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
      const { streak } = body || {};

      if (typeof streak !== 'number' || streak < 0) {
        return res.status(400).json({ error: 'streak must be a non-negative number' });
      }

      // Extract location from Vercel headers (IP-based geo)
      const city = (req.headers['x-vercel-ip-city'] as string | undefined) ?? null;
      const state = (req.headers['x-vercel-ip-country-region'] as string | undefined) ?? null;

      // Get current best
      const stored = await kv.get<QuickPlayBest | number>(GLOBAL_KEY);
      
      // Extract current streak value (handle both old number format and new object format)
      const currentStreak = typeof stored === 'number' 
        ? stored 
        : (stored && typeof stored === 'object') 
          ? stored.streak 
          : 0;

      if (streak > currentStreak) {
        const quickPlayBest: QuickPlayBest = {
          streak,
          updatedAt: new Date().toISOString(),
          city,
          state,
        };
        
        await kv.set(GLOBAL_KEY, quickPlayBest);
        return res.status(200).json({ ...quickPlayBest, updated: true });
      }

      // Return current best (convert to object if needed)
      const currentBest: QuickPlayBest = typeof stored === 'number'
        ? { streak: stored, updatedAt: new Date().toISOString(), city: null, state: null }
        : (stored as QuickPlayBest);
      
      return res.status(200).json({ ...currentBest, updated: false });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error('quickplay-best error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
