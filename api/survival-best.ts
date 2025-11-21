// api/survival-best.ts
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const GLOBAL_KEY = 'survival:globalBest';

export type SurvivalBest = {
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
      const stored = await kv.get<SurvivalBest | number>(GLOBAL_KEY);
      
      // Backward compatibility: if stored value is a number, convert to SurvivalBest
      let survivalBest: SurvivalBest;
      if (typeof stored === 'number') {
        survivalBest = {
          streak: stored,
          updatedAt: new Date().toISOString(),
          city: null,
          state: null,
        };
      } else if (stored && typeof stored === 'object') {
        survivalBest = stored;
      } else {
        survivalBest = {
          streak: 0,
          updatedAt: new Date().toISOString(),
          city: null,
          state: null,
        };
      }
      
      return res.status(200).json(survivalBest);
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
      const stored = await kv.get<SurvivalBest | number>(GLOBAL_KEY);
      
      // Extract current streak value (handle both old number format and new object format)
      const currentStreak = typeof stored === 'number' 
        ? stored 
        : (stored && typeof stored === 'object') 
          ? stored.streak 
          : 0;

      if (streak > currentStreak) {
        const survivalBest: SurvivalBest = {
          streak,
          updatedAt: new Date().toISOString(),
          city,
          state,
        };
        
        await kv.set(GLOBAL_KEY, survivalBest);
        return res.status(200).json({ ...survivalBest, updated: true });
      }

      // Return current best (convert to object if needed)
      const currentBest: SurvivalBest = typeof stored === 'number'
        ? { streak: stored, updatedAt: new Date().toISOString(), city: null, state: null }
        : (stored as SurvivalBest);
      
      return res.status(200).json({ ...currentBest, updated: false });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error('survival-best error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
