// api/increment-kv.ts
//
// Generic counter increment used by the client's meta-stats trackers
// (trackHonesty / trackAggression / trackClaimRisk in src/state/useGameStore.ts).
//
// Only keys on the allowlist below may be incremented. Everything else is a
// 400 so a caller cannot bump arbitrary KV keys (e.g. the global best streak).
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { isRollCode, rejectUnsupportedMethod, requireJsonBody } from './_lib/validate';

const EXACT_KEYS = new Set<string>([
  // trackHonesty
  'stats:player:truthfulClaims',
  'stats:player:bluffClaims',
  // trackAggression
  'stats:player:totalDecisionEvents',
  'stats:player:aggressiveEvents',
  'stats:rival:totalDecisionEvents',
  'stats:rival:aggressiveEvents',
]);

// trackClaimRisk: stats:claims:<code>:(wins|losses) where <code> is a valid dice code
const CLAIM_RISK_PATTERN = /^stats:claims:(\d{2}):(wins|losses)$/;

export function isAllowedKey(key: unknown): key is string {
  if (typeof key !== 'string' || key.length === 0 || key.length > 64) return false;
  if (EXACT_KEYS.has(key)) return true;
  const match = CLAIM_RISK_PATTERN.exec(key);
  return match !== null && isRollCode(match[1]);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rejectUnsupportedMethod(req, res, ['POST'])) return;

  try {
    const body = requireJsonBody(req, res);
    if (!body) return;

    const { key } = body;
    if (!isAllowedKey(key)) {
      return res.status(400).json({ error: 'Key not permitted' });
    }

    await kv.incr(key);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error in increment-kv:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
