// api/admin.ts
//
// Password-protected admin actions. Currently only `reset-stats`, which wipes
// every KV key the other /api handlers read or write.
//
// The endpoint is inert unless ADMIN_RESET_PASSWORD is set in the Vercel
// project's environment; without it every request gets a 404 so the route
// does not advertise itself.
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, timingSafeEqual } from 'node:crypto';

import { ALL_ROLL_CODES, rejectUnsupportedMethod, requireJsonBody } from './_lib/validate';

// Exact keys used across api/*.ts
const EXACT_KEYS: readonly string[] = [
  // roll-stats
  'rollStats:total',
  // win-stats / quickplay-best
  'winStats:playerWins',
  'winStats:cpuWins',
  'quickplay:currentWinStreak', // legacy global counter (pre per-device streaks)
  'quickplay:globalBest',
  // survival-best / survival-run / survival-over10 / survival-average-streak
  'survival:globalBest',
  'survival:devices',
  'survival:over10',
  'survival:streak:total',
  'survival:streak:count',
  // behavior-stats
  'stats:rival:truths',
  'stats:rival:bluffs',
  'stats:rival:bluffSuccess',
  'stats:bluffCalls:player:total',
  'stats:bluffCalls:player:correct',
  'stats:bluffCalls:rival:total',
  'stats:bluffCalls:rival:correct',
  // meta-stats / increment-kv / random-stats
  'stats:player:truthfulClaims',
  'stats:player:bluffClaims',
  'stats:player:aggressiveEvents',
  'stats:player:totalDecisionEvents',
  'stats:rival:aggressiveEvents',
  'stats:rival:totalDecisionEvents',
  'stats:player:totalTurnDurationMs',
  'stats:player:totalTurns',
  'stats:player:lowRollOpportunities',
  'stats:player:lowRollBluffs',
];

// Per-device keys are discovered with SCAN.
const SCAN_PATTERNS: readonly string[] = [
  'survival:best:*',
  'quickplay:currentWinStreak:*',
];

function perCodeKeys(): string[] {
  const keys: string[] = [];
  for (const code of ALL_ROLL_CODES) {
    keys.push(`rollStats:${code}`);
    keys.push(`claimStats:${code}`);
    keys.push(`stats:claims:${code}:wins`);
    keys.push(`stats:claims:${code}:losses`);
  }
  return keys;
}

async function scanKeys(pattern: string): Promise<string[]> {
  const found: string[] = [];
  let cursor: string | number = 0;
  // Bounded loop so a misbehaving store can't spin forever.
  for (let i = 0; i < 1000; i += 1) {
    const result: [string | number, string[]] = await kv.scan(cursor, { match: pattern, count: 200 });
    const [next, keys] = result;
    found.push(...keys);
    cursor = next;
    if (String(cursor) === '0') break;
  }
  return found;
}

/** Constant-time string comparison (hashes first so lengths never leak). */
function passwordsMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}

async function deleteInChunks(keys: string[]): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    if (chunk.length === 0) continue;
    deleted += await kv.del(...chunk);
  }
  return deleted;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rejectUnsupportedMethod(req, res, ['POST'])) return;

  const expectedPassword = process.env.ADMIN_RESET_PASSWORD;
  if (!expectedPassword || expectedPassword.length === 0) {
    // Not configured: behave as if the route does not exist.
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const body = requireJsonBody(req, res);
    if (!body) return;

    const { action, password } = body;

    if (typeof password !== 'string' || !passwordsMatch(password, expectedPassword)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    if (action !== 'reset-stats') {
      return res.status(400).json({ error: 'Unknown action' });
    }

    const keys = new Set<string>([...EXACT_KEYS, ...perCodeKeys()]);
    for (const pattern of SCAN_PATTERNS) {
      for (const key of await scanKeys(pattern)) {
        keys.add(key);
      }
    }

    const deleted = await deleteInChunks([...keys]);

    return res.status(200).json({
      ok: true,
      message: `All stats have been reset (${deleted} keys removed).`,
      deleted,
    });
  } catch (error) {
    console.error('admin error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
