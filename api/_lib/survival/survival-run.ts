import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  STREAK_MAX,
  isValidDeviceId,
  isValidStreak,
  rejectUnsupportedMethod,
  requireJsonBody,
} from '../validate';

// Keys
const SURVIVAL_DEVICES_SET = 'survival:devices';
const SURVIVAL_OVER10_SET = 'survival:over10';
const SURVIVAL_STREAK_TOTAL_KEY = 'survival:streak:total';
const SURVIVAL_STREAK_COUNT_KEY = 'survival:streak:count';

const bestKeyForDevice = (deviceId: string) => `survival:best:${deviceId}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rejectUnsupportedMethod(req, res, ['POST'])) return;

  try {
    const body = requireJsonBody(req, res);
    if (!body) return;

    // Validate everything up front so a rejected request never leaves a partial write.
    const { deviceId, streak } = body;

    if (!isValidDeviceId(deviceId)) {
      return res.status(400).json({ error: 'deviceId must be 8-64 alphanumeric/dash characters' });
    }
    if (!isValidStreak(streak)) {
      return res.status(400).json({ error: `streak must be an integer between 0 and ${STREAK_MAX}` });
    }

    // Read the current per-device best first; the writes below are then computed
    // from local values so they can be issued together.
    const bestKey = bestKeyForDevice(deviceId);
    const currentBest = (await kv.get<number>(bestKey)) ?? 0;

    const updated = streak > currentBest;
    const bestAfter = updated ? streak : currentBest;

    const writes: Promise<unknown>[] = [
      // Ensure this device is tracked as a survival player
      kv.sadd(SURVIVAL_DEVICES_SET, deviceId),
      // Maintain over-10 set membership (use the authoritative best value)
      bestAfter > 10
        ? kv.sadd(SURVIVAL_OVER10_SET, deviceId)
        : kv.srem(SURVIVAL_OVER10_SET, deviceId),
      // Track aggregate streak stats for averages
      kv.incrby(SURVIVAL_STREAK_TOTAL_KEY, streak),
      kv.incrby(SURVIVAL_STREAK_COUNT_KEY, 1),
    ];

    if (updated) {
      writes.push(kv.set(bestKey, streak));
    }

    // Tolerate individual write failures: report the outcome rather than
    // aborting midway with an opaque 500. KV has no multi-key transaction here,
    // so this is best-effort consistency.
    const results = await Promise.allSettled(writes);
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      console.error('survival-run: some KV writes failed', failed);
      return res.status(500).json({ error: 'Failed to record survival run' });
    }

    return res.status(200).json({ deviceId, streak, updated });
  } catch (error) {
    console.error('Error in survival-run:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
