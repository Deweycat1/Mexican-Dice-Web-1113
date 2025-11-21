-- Mexican Dice: Challenges Table Migration

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
CREATE POLICY challenges_select_self ON public.challenges
  FOR SELECT USING (
    auth.uid() = challenger_id OR auth.uid() = recipient_id
  );

-- Policy: Only challenger can insert
CREATE POLICY challenges_insert_challenger ON public.challenges
  FOR INSERT USING (
    auth.uid() = challenger_id
  );

-- Policy: Only recipient can update status to accepted/declined
CREATE POLICY challenges_update_recipient ON public.challenges
  FOR UPDATE USING (
    auth.uid() = recipient_id
  );

-- Policy: Only challenger or recipient can delete
CREATE POLICY challenges_delete_self ON public.challenges
  FOR DELETE USING (
    auth.uid() = challenger_id OR auth.uid() = recipient_id
  );
