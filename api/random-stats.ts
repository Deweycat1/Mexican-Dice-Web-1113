import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { ALL_ROLL_CODES, rejectUnsupportedMethod, requireJsonBody } from './_lib/validate';

type RandomStatsResponse = {
  honestyRating: number | null;       // percentage 0–100
  mostCommonRoll: string | null;      // e.g., "53"
  coldestRoll: string | null;         // e.g., "32"
  averageTurnLengthMs: number | null; // raw ms
  lowRollLieRate: number | null;      // percentage 0–100
  totalRolls: number;                 // total rolls recorded
};

// A single turn cannot plausibly last longer than this; guards the sum counter.
const MAX_TURN_DURATION_MS = 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rejectUnsupportedMethod(req, res, ['GET', 'POST'])) return;

  try {
    if (req.method === 'GET') {
      // 1. Honesty Rating
      const truthfulClaims = (await kv.get<number>('stats:player:truthfulClaims')) ?? 0;
      const bluffClaims = (await kv.get<number>('stats:player:bluffClaims')) ?? 0;
      const totalClaims = truthfulClaims + bluffClaims;
      const honestyRating = totalClaims > 0 ? (truthfulClaims / totalClaims) * 100 : null;

      // 2. Most Common Roll & 3. Coldest Roll
      const rollCounts: Record<string, number> = {};
      for (const roll of ALL_ROLL_CODES) {
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
            return parseInt(a[0], 10) - parseInt(b[0], 10); // tiebreaker by numeric value
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

    // POST: turn timing and low-roll tracking
    const body = requireJsonBody(req, res);
    if (!body) return;

    const { type, durationMs, actualRoll, wasBluff } = body;

    if (type === 'turn') {
      // Record turn duration
      if (
        typeof durationMs !== 'number' ||
        !Number.isFinite(durationMs) ||
        durationMs <= 0 ||
        durationMs > MAX_TURN_DURATION_MS
      ) {
        return res.status(400).json({ error: 'durationMs must be a positive number of milliseconds' });
      }
      await kv.incrby('stats:player:totalTurnDurationMs', Math.floor(durationMs));
      await kv.incr('stats:player:totalTurns');
      return res.status(200).json({ success: true });
    }

    if (type === 'lowRoll') {
      // Track low-roll bluff behavior (below 61)
      if (typeof actualRoll !== 'number' || !Number.isInteger(actualRoll) || actualRoll < 11 || actualRoll > 66) {
        return res.status(400).json({ error: 'actualRoll must be a dice code between 11 and 66' });
      }
      if (actualRoll < 61) {
        await kv.incr('stats:player:lowRollOpportunities');
        if (wasBluff === true) {
          await kv.incr('stats:player:lowRollBluffs');
        }
      }
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown event type' });
  } catch (err) {
    console.error('random-stats error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
