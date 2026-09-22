import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { rejectUnsupportedMethod } from './_lib/validate';

const SURVIVAL_DEVICES_SET = 'survival:devices';
const SURVIVAL_OVER10_SET = 'survival:over10';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rejectUnsupportedMethod(req, res, ['GET'])) return;

  try {
    const totalSurvivalUsers = (await kv.scard(SURVIVAL_DEVICES_SET)) ?? 0;
    const survivalOver10Users = (await kv.scard(SURVIVAL_OVER10_SET)) ?? 0;

    const survivalOver10Rate = totalSurvivalUsers > 0
      ? (survivalOver10Users / totalSurvivalUsers) * 100
      : 0;

    return res.status(200).json({ totalSurvivalUsers, survivalOver10Users, survivalOver10Rate });
  } catch (error) {
    console.error('Error in survival-over10:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
