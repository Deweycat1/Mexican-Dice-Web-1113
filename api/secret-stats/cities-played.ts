import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

type CityCount = {
  city: string;
  count: number;
};

type CitiesResponse = {
  cities: CityCount[];
  totalCities: number;
};

const CITY_COUNTS_HASH = 'stats:cityCounts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawCounts = (await kv.hgetall<number | string>(CITY_COUNTS_HASH)) ?? {};
    const entries = Object.entries(rawCounts)
      .map(([city, rawCount]) => ({
        city: city.trim(),
        count: typeof rawCount === 'number' ? rawCount : parseInt(rawCount ?? '0', 10) || 0,
      }))
      .filter((entry) => entry.city.length > 0 && entry.count > 0)
      .sort((a, b) => a.city.localeCompare(b.city));

    const response: CitiesResponse = {
      cities: entries,
      totalCities: entries.length,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('cities-played error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
