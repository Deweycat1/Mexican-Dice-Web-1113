// api/win-stats.ts
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const PLAYER_WINS_KEY = 'winStats:playerWins';
const CPU_WINS_KEY = 'winStats:cpuWins';
const CURRENT_STREAK_KEY = 'quickplay:currentWinStreak';
const QUICKPLAY_BEST_KEY = 'quickplay:globalBest';

type QuickPlayBest = {
  streak: number;
  updatedAt: string;
  city?: string | null;
  state?: string | null;
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
      const playerWins = (await kv.get<number>(PLAYER_WINS_KEY)) ?? 0;
      const cpuWins = (await kv.get<number>(CPU_WINS_KEY)) ?? 0;
      return res.status(200).json({ playerWins, cpuWins });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
      const { winner } = body || {};

      if (winner !== 'player' && winner !== 'cpu') {
        return res.status(400).json({ error: 'winner must be "player" or "cpu"' });
      }

      const key = winner === 'player' ? PLAYER_WINS_KEY : CPU_WINS_KEY;
      const newValue = await kv.incr(key);
      
      const playerWins = winner === 'player' ? newValue : (await kv.get<number>(PLAYER_WINS_KEY)) ?? 0;
      const cpuWins = winner === 'cpu' ? newValue : (await kv.get<number>(CPU_WINS_KEY)) ?? 0;
      
      // Track Quick Play win streak
      let currentStreak = (await kv.get<number>(CURRENT_STREAK_KEY)) ?? 0;
      
      if (winner === 'player') {
        // Player won - increment streak
        currentStreak += 1;
        await kv.set(CURRENT_STREAK_KEY, currentStreak);
        
        // Check if this is a new global best
        const storedBest = await kv.get<QuickPlayBest | number>(QUICKPLAY_BEST_KEY);
        const currentBest = typeof storedBest === 'number' 
          ? storedBest 
          : (storedBest && typeof storedBest === 'object') 
            ? storedBest.streak 
            : 0;
        
        if (currentStreak > currentBest) {
          // New record! Extract location from headers
          const city = (req.headers['x-vercel-ip-city'] as string | undefined) ?? null;
          const state = (req.headers['x-vercel-ip-country-region'] as string | undefined) ?? null;
          
          const quickPlayBest: QuickPlayBest = {
            streak: currentStreak,
            updatedAt: new Date().toISOString(),
            city,
            state,
          };
          
          await kv.set(QUICKPLAY_BEST_KEY, quickPlayBest);
        }
      } else {
        // CPU won - reset streak
        currentStreak = 0;
        await kv.set(CURRENT_STREAK_KEY, 0);
      }
      
      return res.status(200).json({ playerWins, cpuWins, currentStreak });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error('win-stats error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
