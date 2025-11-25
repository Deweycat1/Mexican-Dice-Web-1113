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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, error } = await supabaseServer
      .from('city_visits')
      .select('city, region, country, visit_count')
      .order('visit_count', { ascending: false });

    if (error) {
      console.error('[cities-played] error fetching cities', error);
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
    console.error('[cities-played] unexpected error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
