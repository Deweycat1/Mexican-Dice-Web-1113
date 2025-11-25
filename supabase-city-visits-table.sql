-- City visit tracking table
CREATE TABLE IF NOT EXISTS public.city_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  region text,
  country text NOT NULL,
  visit_count integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);

-- Ensure unique combination per city/country for upserts
CREATE UNIQUE INDEX IF NOT EXISTS city_visits_city_country_idx
  ON public.city_visits (city, country);
