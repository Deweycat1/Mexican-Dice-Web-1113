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

type RandomStatsResponse = {
  honestyRating: number | null;       // percentage 0–100
  mostCommonRoll: string | null;      // e.g., "53"
  coldestRoll: string | null;         // e.g., "32"
  averageTurnLengthMs: number | null; // raw ms
  lowRollLieRate: number | null;      // percentage 0–100
  totalRolls: number;                 // total rolls recorded
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
      // 1. Honesty Rating
      const truthfulClaims = (await kv.get<number>('stats:player:truthfulClaims')) ?? 0;
      const bluffClaims = (await kv.get<number>('stats:player:bluffClaims')) ?? 0;
      const totalClaims = truthfulClaims + bluffClaims;
      const honestyRating = totalClaims > 0 ? (truthfulClaims / totalClaims) * 100 : null;

      // 2. Most Common Roll & 3. Coldest Roll
      const rollCounts: Record<string, number> = {};
      for (const roll of ALL_ROLLS) {
        const count = (await kv.get<number>(`rollStats:${roll}`)) ?? 0;
        if (count > 0) {
          rollCounts[roll] = count;
        }
      }

      const rollEntries = Object.entries(rollCounts);
      let mostCommonRoll: string | null = null;
      let coldestRoll: string | null = null;

      if (rollEntries.length > 0) {
        // Most common: highest count
        rollEntries.sort((a, b) => b[1] - a[1]);
        mostCommonRoll = rollEntries[0][0];

        // Coldest: lowest count (only if we have at least 2 unique rolls)
        if (rollEntries.length >= 2) {
          // Sort by count ascending, then by roll value for tiebreaker
          const sortedForColdest = [...rollEntries].sort((a, b) => {
            if (a[1] !== b[1]) return a[1] - b[1]; // ascending by count
            return parseInt(a[0]) - parseInt(b[0]); // tiebreaker by numeric value
          });
          coldestRoll = sortedForColdest[0][0];
        }
      }

      // 4. Average Turn Length
      const totalTurnDurationMs = (await kv.get<number>('stats:player:totalTurnDurationMs')) ?? 0;
      const totalTurns = (await kv.get<number>('stats:player:totalTurns')) ?? 0;
      const averageTurnLengthMs = totalTurns > 0 ? totalTurnDurationMs / totalTurns : null;

      // 5. Low-Roll Lie Rate
      const lowRollOpportunities = (await kv.get<number>('stats:player:lowRollOpportunities')) ?? 0;
      const lowRollBluffs = (await kv.get<number>('stats:player:lowRollBluffs')) ?? 0;
      const lowRollLieRate = lowRollOpportunities > 0 
        ? (lowRollBluffs / lowRollOpportunities) * 100 
        : null;

      // 6. Total Rolls
      const totalRolls = (await kv.get<number>('rollStats:total')) ?? 0;

      const response: RandomStatsResponse = {
        honestyRating,
        mostCommonRoll,
        coldestRoll,
        averageTurnLengthMs,
        lowRollLieRate,
        totalRolls,
      };

      return res.status(200).json(response);
    }

    if (req.method === 'POST') {
      // Handle turn timing and low-roll tracking
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
      const { type, durationMs, actualRoll, wasBluff } = body || {};

      if (type === 'turn') {
        // Record turn duration
        if (typeof durationMs === 'number' && durationMs > 0) {
          await kv.incrby('stats:player:totalTurnDurationMs', Math.floor(durationMs));
          await kv.incr('stats:player:totalTurns');
        }
      } else if (type === 'lowRoll') {
        // Track low-roll bluff behavior (below 61)
        if (typeof actualRoll === 'number' && actualRoll < 61) {
          await kv.incr('stats:player:lowRollOpportunities');
          if (wasBluff === true) {
            await kv.incr('stats:player:lowRollBluffs');
          }
        }
      }

      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error('player-tendencies error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
