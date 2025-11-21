import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// All possible normalized roll codes (high die first)
const ALL_ROLL_CODES = [
  '21', '31', '32', '41', '42', '43',
  '51', '52', '53', '54',
  '61', '62', '63', '64', '65',
  '11', '22', '33', '44', '55', '66'
];

type MetaStatsResponse = {
  honesty: {
    truthful: number;
    bluffs: number;
    honestyRate: number;
  };
  aggression: {
    player: {
      aggressiveEvents: number;
      totalEvents: number;
      index: number;
    };
    rival: {
      aggressiveEvents: number;
      totalEvents: number;
      index: number;
    };
  };
  claimsRisk: {
    safest: {
      code: string;
      wins: number;
      losses: number;
      winRate: number;
    } | null;
    mostDangerous: {
      code: string;
      wins: number;
      losses: number;
      winRate: number;
    } | null;
    all: {
      [code: string]: {
        wins: number;
        losses: number;
        winRate: number;
        uses: number;
      };
    };
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      // 1. Fetch honesty stats
      const truthfulClaims = (await kv.get<number>('stats:player:truthfulClaims')) ?? 0;
      const bluffClaims = (await kv.get<number>('stats:player:bluffClaims')) ?? 0;
      const totalHonestyClaims = truthfulClaims + bluffClaims;
      const honestyRate = totalHonestyClaims > 0 ? truthfulClaims / totalHonestyClaims : 0;

      // 2. Fetch aggression stats
      const playerAggressiveEvents = (await kv.get<number>('stats:player:aggressiveEvents')) ?? 0;
      const playerTotalEvents = (await kv.get<number>('stats:player:totalDecisionEvents')) ?? 0;
      const playerAggressionIndex = playerTotalEvents > 0 
        ? (playerAggressiveEvents / playerTotalEvents) * 100 
        : 0;

      const rivalAggressiveEvents = (await kv.get<number>('stats:rival:aggressiveEvents')) ?? 0;
      const rivalTotalEvents = (await kv.get<number>('stats:rival:totalDecisionEvents')) ?? 0;
      const rivalAggressionIndex = rivalTotalEvents > 0 
        ? (rivalAggressiveEvents / rivalTotalEvents) * 100 
        : 0;

      // 3. Fetch claims risk stats
      const claimsRiskAll: MetaStatsResponse['claimsRisk']['all'] = {};
      let safestClaim: MetaStatsResponse['claimsRisk']['safest'] = null;
      let mostDangerousClaim: MetaStatsResponse['claimsRisk']['mostDangerous'] = null;
      let highestWinRate = -1;
      let lowestWinRate = 2; // Start above 1

      for (const code of ALL_ROLL_CODES) {
        const wins = (await kv.get<number>(`stats:claims:${code}:wins`)) ?? 0;
        const losses = (await kv.get<number>(`stats:claims:${code}:losses`)) ?? 0;
        const uses = wins + losses;
        const winRate = uses > 0 ? wins / uses : 0;

        claimsRiskAll[code] = { wins, losses, winRate, uses };

        // Only consider claims with sufficient sample size (>= 5 uses)
        if (uses >= 5) {
          if (winRate > highestWinRate) {
            highestWinRate = winRate;
            safestClaim = { code, wins, losses, winRate };
          }
          if (winRate < lowestWinRate) {
            lowestWinRate = winRate;
            mostDangerousClaim = { code, wins, losses, winRate };
          }
        }
      }

      const response: MetaStatsResponse = {
        honesty: {
          truthful: truthfulClaims,
          bluffs: bluffClaims,
          honestyRate,
        },
        aggression: {
          player: {
            aggressiveEvents: playerAggressiveEvents,
            totalEvents: playerTotalEvents,
            index: playerAggressionIndex,
          },
          rival: {
            aggressiveEvents: rivalAggressiveEvents,
            totalEvents: rivalTotalEvents,
            index: rivalAggressionIndex,
          },
        },
        claimsRisk: {
          safest: safestClaim,
          mostDangerous: mostDangerousClaim,
          all: claimsRiskAll,
        },
      };

      return res.status(200).json(response);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in meta-stats:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
