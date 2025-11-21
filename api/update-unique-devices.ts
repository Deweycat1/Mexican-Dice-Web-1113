// FILE: api/update-unique-devices.ts
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const UNIQUE_DEVICES_KEY = 'uniqueDevices:set';

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
      // Get the count of unique devices
      const count = await kv.scard(UNIQUE_DEVICES_KEY) ?? 0;
      return res.status(200).json({ count });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
      const { deviceId } = body || {};

      if (!deviceId || typeof deviceId !== 'string') {
        return res.status(400).json({ error: 'deviceId is required and must be a string' });
      }

      // Add device ID to the set (automatically deduplicates)
      await kv.sadd(UNIQUE_DEVICES_KEY, deviceId);
      
      // Get the updated count
      const count = await kv.scard(UNIQUE_DEVICES_KEY) ?? 0;
      
      return res.status(200).json({ count });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in update-unique-devices:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
