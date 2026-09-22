-- Mexican Dice: Challenges Table Migration
-- NOTE: superseded by supabase/migrations/20260922000000_security_hardening.sql
-- (section 1a), which is idempotent. Kept in sync for reference.

CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  game_id uuid,
  status text NOT NULL DEFAULT 'pending', -- pending, accepted, declined
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_recipient_id ON public.challenges (recipient_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenger_id ON public.challenges (challenger_id);

-- Enable RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- Policy: Only challenger or recipient can view their challenges
DROP POLICY IF EXISTS challenges_select_self ON public.challenges;
CREATE POLICY challenges_select_self ON public.challenges
  FOR SELECT
  TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = recipient_id);

-- Policy: Only challenger can insert.
-- INSERT policies take WITH CHECK, not USING (`FOR INSERT USING` is rejected).
DROP POLICY IF EXISTS challenges_insert_challenger ON public.challenges;
CREATE POLICY challenges_insert_challenger ON public.challenges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = challenger_id
    AND challenger_id <> recipient_id
    AND status = 'pending'
  );

-- Policy: Only recipient can update status to accepted/declined
DROP POLICY IF EXISTS challenges_update_recipient ON public.challenges;
CREATE POLICY challenges_update_recipient ON public.challenges
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (
    auth.uid() = recipient_id
    AND status IN ('pending', 'accepted', 'declined')
  );

-- Policy: Only challenger or recipient can delete
DROP POLICY IF EXISTS challenges_delete_self ON public.challenges;
CREATE POLICY challenges_delete_self ON public.challenges
  FOR DELETE
  TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = recipient_id);
