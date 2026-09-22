-- City visit tracking table
-- NOTE: superseded by supabase/migrations/20260922000000_security_hardening.sql
-- (section 1b). Kept in sync for reference.
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

-- No client code reads or writes this table, so enable RLS with no policies:
-- anon/authenticated roles get nothing; the service role (bypasses RLS) may
-- still upsert from server-side code.
ALTER TABLE public.city_visits ENABLE ROW LEVEL SECURITY;
