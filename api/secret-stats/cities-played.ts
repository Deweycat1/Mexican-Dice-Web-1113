import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../../src/lib/supabaseServer';

type CityVisit = {
  city: string;
  region: string | null;
  country: string;
  visit_count: number;
};

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

  try {
    const { data: existing, error: selectError } = await supabaseServer
      .from('city_visits')
      .select('id, visit_count')
      .eq('city', city)
      .eq('country', country)
      .maybeSingle();

    if (selectError) {
      console.error('[cities-played POST] select error', selectError);
      return res.status(500).json({ ok: false, message: selectError.message });
    }

    if (!existing) {
      const { error: insertError } = await supabaseServer
        .from('city_visits')
        .insert({
          city,
          region,
          country,
          visit_count: 1,
        });

      if (insertError) {
        console.error('[cities-played POST] insert error', insertError);
        return res.status(500).json({ ok: false, message: insertError.message });
      }
    } else {
      const nextCount = (existing.visit_count ?? 0) + 1;
      const { error: updateError } = await supabaseServer
        .from('city_visits')
        .update({
          region,
          visit_count: nextCount,
          last_seen: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('[cities-played POST] update error', updateError);
        return res.status(500).json({ ok: false, message: updateError.message });
      }
    }

    return res.status(200).json({ ok: true, city, country });
  } catch (error) {
    console.error('[cities-played POST] unexpected error', error);
    return res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handleGet(res: VercelResponse) {
  try {
    const { data, error } = await supabaseServer
      .from('city_visits')
      .select('city, region, country, visit_count')
      .order('visit_count', { ascending: false });

    if (error) {
      console.error('[cities-played GET] error fetching cities', error);
      return res.status(500).json({ error: 'Failed to load city stats' });
    }

    const cities = (data ?? []).map((entry: CityVisit) => ({
      city: entry.city,
      region: entry.region ?? null,
      country: entry.country,
      visitCount: entry.visit_count ?? 0,
    }));

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
