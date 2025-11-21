// api/admin/reset-stats.ts
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    const { password } = body || {};

    // Verify password against environment variable
    const correctPassword = process.env.ADMIN_RESET_PASSWORD || 'Drza$$69';
    
    if (password !== correctPassword) {
      return res.status(401).json({ 
        error: "How dare you?! You aren't nearly that important!" 
      });
    }

    // List of all stat keys to delete
    const keysToDelete = [
      // Roll stats
      'rollStats:11', 'rollStats:21', 'rollStats:31', 'rollStats:41', 'rollStats:51', 'rollStats:61',
      'rollStats:22', 'rollStats:32', 'rollStats:42', 'rollStats:52', 'rollStats:62',
      'rollStats:33', 'rollStats:43', 'rollStats:53', 'rollStats:63',
      'rollStats:44', 'rollStats:54', 'rollStats:64',
      'rollStats:55', 'rollStats:65',
      'rollStats:66',
      
      // Claim stats
      'claimStats:11', 'claimStats:21', 'claimStats:31', 'claimStats:41', 'claimStats:51', 'claimStats:61',
      'claimStats:22', 'claimStats:32', 'claimStats:42', 'claimStats:52', 'claimStats:62',
      'claimStats:33', 'claimStats:43', 'claimStats:53', 'claimStats:63',
      'claimStats:44', 'claimStats:54', 'claimStats:64',
      'claimStats:55', 'claimStats:65',
      'claimStats:66',
      
      // Win stats
      'winStats:playerWins',
      'winStats:cpuWins',
      
      // Survival stats
      'survival:globalBest',
      'survival:totalRuns',
      'survival:totalStreaks',
      
      // Claim outcome stats
      'stats:claims:winning',
      'stats:claims:losing',
      
      // Behavior stats
      'stats:rival:truths',
      'stats:rival:bluffs',
      'stats:rival:bluffSuccess',
      'stats:bluffCalls:player:total',
      'stats:bluffCalls:player:correct',
      'stats:bluffCalls:rival:total',
      'stats:bluffCalls:rival:correct',
      
      // Meta stats - honesty
      'stats:player:truthfulClaims',
      'stats:player:bluffClaims',
      
      // Meta stats - aggression
      'stats:player:totalDecisionEvents',
      'stats:player:aggressiveEvents',
      'stats:rival:totalDecisionEvents',
      'stats:rival:aggressiveEvents',
      
      // Meta stats - claims risk (all possible rolls)
      'stats:claims:11:wins', 'stats:claims:11:losses',
      'stats:claims:21:wins', 'stats:claims:21:losses',
      'stats:claims:31:wins', 'stats:claims:31:losses',
      'stats:claims:41:wins', 'stats:claims:41:losses',
      'stats:claims:51:wins', 'stats:claims:51:losses',
      'stats:claims:61:wins', 'stats:claims:61:losses',
      'stats:claims:22:wins', 'stats:claims:22:losses',
      'stats:claims:32:wins', 'stats:claims:32:losses',
      'stats:claims:42:wins', 'stats:claims:42:losses',
      'stats:claims:52:wins', 'stats:claims:52:losses',
      'stats:claims:62:wins', 'stats:claims:62:losses',
      'stats:claims:33:wins', 'stats:claims:33:losses',
      'stats:claims:43:wins', 'stats:claims:43:losses',
      'stats:claims:53:wins', 'stats:claims:53:losses',
      'stats:claims:63:wins', 'stats:claims:63:losses',
      'stats:claims:44:wins', 'stats:claims:44:losses',
      'stats:claims:54:wins', 'stats:claims:54:losses',
      'stats:claims:64:wins', 'stats:claims:64:losses',
      'stats:claims:55:wins', 'stats:claims:55:losses',
      'stats:claims:65:wins', 'stats:claims:65:losses',
      'stats:claims:66:wins', 'stats:claims:66:losses',
      
      // Player Tendencies
      'stats:player:totalTurnDurationMs',
      'stats:player:totalTurns',
      'stats:player:lowRollOpportunities',
      'stats:player:lowRollBluffs',
    ];

    // Delete all keys
    const deletePromises = keysToDelete.map(key => kv.del(key));
    await Promise.all(deletePromises);

    return res.status(200).json({ 
      success: true, 
      message: 'All stats have been reset successfully.',
      keysDeleted: keysToDelete.length
    });
  } catch (err) {
    console.error('reset-stats error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
