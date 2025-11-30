import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

type CitiesResponse = {
  cities: Array<{
    city: string;
    region: string | null;
    country: string;
    visitCount: number;
  }>;
  totalCities: number;
  totalVisits: number;
};

type StoredCityVisit = {
  city: string;
  region: string | null;
  country: string;
  visitCount: number;
  firstSeen: string;
  lastSeen: string;
};

const CITY_VISITS_HASH_KEY = 'cityVisits:v1';

const normalize = (value: string | undefined | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const resolveGeo = (req: VercelRequest) => {
  const geo = (req as unknown as { geo?: Partial<{ city: string; country: string; region: string }> }).geo || {};
  const city = normalize(geo.city || (req.headers['x-vercel-ip-city'] as string | undefined));
  const region = normalize(geo.region || (req.headers['x-vercel-ip-region'] as string | undefined));
  const country = normalize(geo.country || (req.headers['x-vercel-ip-country'] as string | undefined));
  return { city, region, country };
};

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const { city, region, country } = resolveGeo(req);
  console.log('[cities-played POST] resolved geo', { city, region, country });

  if (!city || !country) {
    return res.status(200).json({ ok: false, reason: 'no-geo' });
  }

  const storageKey = `${city.toLowerCase()}__${country.toLowerCase()}`;
  const now = new Date().toISOString();

  try {
    const existing = await kv.hget<string>(CITY_VISITS_HASH_KEY, storageKey);
    let parsed: StoredCityVisit | null = null;
    if (existing) {
      try {
        parsed = JSON.parse(existing) as StoredCityVisit;
      } catch (parseError) {
        console.warn('[cities-played POST] failed to parse stored city visit, resetting entry', parseError);
      }
    }

    if (!parsed) {
      parsed = {
        city,
        region,
        country,
        visitCount: 1,
        firstSeen: now,
        lastSeen: now,
      };
    } else {
      parsed.visitCount += 1;
      parsed.region = region ?? parsed.region;
      parsed.lastSeen = now;
    }

    await kv.hset(CITY_VISITS_HASH_KEY, { [storageKey]: JSON.stringify(parsed) });
    return res.status(200).json({ ok: true, city, country });
  } catch (error) {
    console.error('[cities-played POST] unexpected error', error);
    return res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handleGet(res: VercelResponse) {
  try {
    const stored = await kv.hgetall<string>(CITY_VISITS_HASH_KEY);
    const cities: StoredCityVisit[] = Object.values(stored ?? {})
      .map((value) => {
        try {
          return JSON.parse(value) as StoredCityVisit;
        } catch (err) {
          console.warn('[cities-played GET] failed to parse stored value', err);
          return null;
        }
      })
      .filter((city): city is StoredCityVisit => city !== null)
      .sort((a, b) => b.visitCount - a.visitCount);

    const totalVisits = cities.reduce((sum, city) => sum + city.visitCount, 0);

    const response: CitiesResponse = {
      cities,
      totalCities: cities.length,
      totalVisits,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('[cities-played GET] unexpected error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  if (req.method === 'GET') {
    return handleGet(res);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
