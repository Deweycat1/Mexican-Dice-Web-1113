import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../src/lib/supabaseServer';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const { city, region, country } = resolveGeo(req);
  console.log('[track-location] resolved geo', { city, region, country });

  if (!city || !country) {
    return res.status(200).json({ ok: false, reason: 'no-geo' });
  }

  try {
    const { data: existing, error: fetchError } = await supabaseServer
      .from('city_visits')
      .select('id, visit_count')
      .eq('city', city)
      .eq('country', country)
      .maybeSingle();

    if (fetchError) {
      console.error('[track-location] error selecting visit', fetchError);
      return res.status(500).json({ ok: false, message: fetchError.message });
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
        console.error('[track-location] insert error', insertError);
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
        console.error('[track-location] update error', updateError);
        return res.status(500).json({ ok: false, message: updateError.message });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[track-location] unexpected error', error);
    return res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Unknown error' });
  }
}
