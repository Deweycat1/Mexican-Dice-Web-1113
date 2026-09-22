// api/win-stats.ts
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { isValidDeviceId, readGeo, rejectUnsupportedMethod, requireJsonBody } from './_lib/validate';

const PLAYER_WINS_KEY = 'winStats:playerWins';
const CPU_WINS_KEY = 'winStats:cpuWins';
const QUICKPLAY_BEST_KEY = 'quickplay:globalBest';

// NOTE: `quickplay:currentWinStreak` was historically a single GLOBAL counter
// shared by every player, so one player's loss reset everyone's streak and the
// "global best" was really the best run of interleaved wins across all users.
// Streaks are now tracked per device under `quickplay:currentWinStreak:<deviceId>`
// and the global best is the max over all devices. Requests without a deviceId
// still record the win/loss tally but do not touch any streak keys.
const streakKeyForDevice = (deviceId: string) => `quickplay:currentWinStreak:${deviceId}`;

type QuickPlayBest = {
  streak: number;
  updatedAt: string;
  city?: string | null;
  state?: string | null;
};

function readBestStreak(stored: QuickPlayBest | number | null | undefined): number {
  if (typeof stored === 'number') return stored;
  if (stored && typeof stored === 'object' && typeof stored.streak === 'number') return stored.streak;
  return 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rejectUnsupportedMethod(req, res, ['GET', 'POST'])) return;

  try {
    if (req.method === 'GET') {
      const playerWins = (await kv.get<number>(PLAYER_WINS_KEY)) ?? 0;
      const cpuWins = (await kv.get<number>(CPU_WINS_KEY)) ?? 0;
      return res.status(200).json({ playerWins, cpuWins });
    }

    // POST
    const body = requireJsonBody(req, res);
    if (!body) return;

    const { winner, deviceId } = body;

    if (winner !== 'player' && winner !== 'cpu') {
      return res.status(400).json({ error: 'winner must be "player" or "cpu"' });
    }
    if (deviceId !== undefined && !isValidDeviceId(deviceId)) {
      return res.status(400).json({ error: 'deviceId must be 8-64 alphanumeric/dash characters' });
    }

    const key = winner === 'player' ? PLAYER_WINS_KEY : CPU_WINS_KEY;
    const newValue = await kv.incr(key);

    const playerWins = winner === 'player' ? newValue : (await kv.get<number>(PLAYER_WINS_KEY)) ?? 0;
    const cpuWins = winner === 'cpu' ? newValue : (await kv.get<number>(CPU_WINS_KEY)) ?? 0;

    // Backward compat: no deviceId means we cannot attribute a streak, so leave
    // the streak keys alone.
    if (deviceId === undefined) {
      return res.status(200).json({ playerWins, cpuWins, currentStreak: null });
    }

    const streakKey = streakKeyForDevice(deviceId);
    let currentStreak: number;

    if (winner === 'player') {
      currentStreak = await kv.incr(streakKey);

      // Global best = max over all devices
      const storedBest = await kv.get<QuickPlayBest | number>(QUICKPLAY_BEST_KEY);
      if (currentStreak > readBestStreak(storedBest)) {
        const { city, state } = readGeo(req);
        const quickPlayBest: QuickPlayBest = {
          streak: currentStreak,
          updatedAt: new Date().toISOString(),
          city,
          state,
        };
        await kv.set(QUICKPLAY_BEST_KEY, quickPlayBest);
      }
    } else {
      // CPU won - reset this device's streak
      currentStreak = 0;
      await kv.set(streakKey, 0);
    }

    return res.status(200).json({ playerWins, cpuWins, currentStreak });
  } catch (err) {
    console.error('win-stats error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
