import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

type RivalClaimEvent = {
  type: 'rival-claim';
  truth: boolean;
  bluffWon?: boolean;
};

type BluffCallEvent = {
  type: 'bluff-call';
  caller: 'player' | 'rival';
  correct: boolean;
};

type BehaviorEvent = RivalClaimEvent | BluffCallEvent;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      // Record behavior events
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const event = body as BehaviorEvent;

      if (!event || !event.type) {
        return res.status(400).json({ error: 'Invalid event type' });
      }

      if (event.type === 'rival-claim') {
        // Track Rival's truth/bluff behavior
        if (event.truth) {
          await kv.incr('stats:rival:truths');
        } else {
          await kv.incr('stats:rival:bluffs');
          if (event.bluffWon) {
            await kv.incr('stats:rival:bluffSuccess');
          }
        }
        return res.status(200).json({ ok: true });
      }

      if (event.type === 'bluff-call') {
        // Track bluff calls
        const { caller, correct } = event;
        
        if (caller !== 'player' && caller !== 'rival') {
          return res.status(400).json({ error: 'Invalid caller' });
        }

        await kv.incr(`stats:bluffCalls:${caller}:total`);
        if (correct) {
          await kv.incr(`stats:bluffCalls:${caller}:correct`);
        }
        
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown event type' });
    }

    if (req.method === 'GET') {
      // Return aggregated behavior stats
      const rivalTruths = await kv.get<number>('stats:rival:truths') ?? 0;
      const rivalBluffs = await kv.get<number>('stats:rival:bluffs') ?? 0;
      const rivalBluffSuccess = await kv.get<number>('stats:rival:bluffSuccess') ?? 0;

      const playerTotal = await kv.get<number>('stats:bluffCalls:player:total') ?? 0;
      const playerCorrect = await kv.get<number>('stats:bluffCalls:player:correct') ?? 0;
      
      const rivalTotal = await kv.get<number>('stats:bluffCalls:rival:total') ?? 0;
      const rivalCorrect = await kv.get<number>('stats:bluffCalls:rival:correct') ?? 0;

      // Calculate rates safely
      const totalRivalClaims = rivalTruths + rivalBluffs;
      const truthRate = totalRivalClaims > 0 ? rivalTruths / totalRivalClaims : 0;
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
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in behavior-stats:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
