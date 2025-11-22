// admin/reset-stats.ts — ADMIN ENDPOINT REMOVED
// This file previously provided an admin-only endpoint to reset all stats.
// The admin endpoints have been deprecated/removed. To avoid accidental
// exposure, this route now returns 410 Gone.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(410).json({ error: 'Admin endpoints removed' });
}
