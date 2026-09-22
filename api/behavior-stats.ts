import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { rejectUnsupportedMethod, requireJsonBody } from './_lib/validate';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rejectUnsupportedMethod(req, res, ['GET', 'POST'])) return;

  try {
    if (req.method === 'POST') {
      const body = requireJsonBody(req, res);
      if (!body) return;

      const { type } = body;

      if (type === 'rival-claim') {
        // Track Rival's truth/bluff behavior
        const truth = body.truth;
        const bluffWon = body.bluffWon;
        if (typeof truth !== 'boolean') {
          return res.status(400).json({ error: 'truth must be a boolean' });
        }
        if (bluffWon !== undefined && typeof bluffWon !== 'boolean') {
          return res.status(400).json({ error: 'bluffWon must be a boolean' });
        }

        if (truth) {
          await kv.incr('stats:rival:truths');
        } else {
          await kv.incr('stats:rival:bluffs');
          if (bluffWon === true) {
            await kv.incr('stats:rival:bluffSuccess');
          }
        }
        return res.status(200).json({ ok: true });
      }

      if (type === 'bluff-call') {
        // Track bluff calls
        const { caller, correct } = body;

        if (caller !== 'player' && caller !== 'rival') {
          return res.status(400).json({ error: 'Invalid caller' });
        }
        if (typeof correct !== 'boolean') {
          return res.status(400).json({ error: 'correct must be a boolean' });
        }

        await kv.incr(`stats:bluffCalls:${caller}:total`);
        if (correct) {
          await kv.incr(`stats:bluffCalls:${caller}:correct`);
        }

        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown event type' });
    }

    // GET: return aggregated behavior stats
    const rivalTruths = (await kv.get<number>('stats:rival:truths')) ?? 0;
    const rivalBluffs = (await kv.get<number>('stats:rival:bluffs')) ?? 0;
    const rivalBluffSuccessStored = (await kv.get<number>('stats:rival:bluffSuccess')) ?? 0;

    const playerTotal = (await kv.get<number>('stats:bluffCalls:player:total')) ?? 0;
    const playerCorrect = (await kv.get<number>('stats:bluffCalls:player:correct')) ?? 0;

    const rivalTotal = (await kv.get<number>('stats:bluffCalls:rival:total')) ?? 0;
    const rivalCorrect = (await kv.get<number>('stats:bluffCalls:rival:correct')) ?? 0;

    // Calculate rates safely
    const totalRivalClaims = rivalTruths + rivalBluffs;
    const truthRate = totalRivalClaims > 0 ? rivalTruths / totalRivalClaims : 0;
    const failedBluffsFromCalls = Math.min(playerCorrect, rivalBluffs);
    const rivalBluffSuccess =
      rivalBluffs > 0
        ? Math.max(rivalBluffSuccessStored, rivalBluffs - failedBluffsFromCalls)
        : rivalBluffSuccessStored;
    const bluffSuccessRate = rivalBluffs > 0 ? rivalBluffSuccess / rivalBluffs : 0;

    const playerAccuracy = playerTotal > 0 ? playerCorrect / playerTotal : 0;
    const rivalAccuracy = rivalTotal > 0 ? rivalCorrect / rivalTotal : 0;

    return res.status(200).json({
      rival: {
        truths: rivalTruths,
        bluffs: rivalBluffs,
        bluffSuccess: rivalBluffSuccess,
        truthRate,
        bluffSuccessRate,
      },
      bluffCalls: {
        player: {
          total: playerTotal,
          correct: playerCorrect,
          accuracy: playerAccuracy,
        },
        rival: {
          total: rivalTotal,
          correct: rivalCorrect,
          accuracy: rivalAccuracy,
        },
      },
    });
  } catch (error) {
    console.error('Error in behavior-stats:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
