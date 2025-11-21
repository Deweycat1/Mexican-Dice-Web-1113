-- Migration: Add baseline_claim and last_action columns to games table
-- Required for online multiplayer claim/bluff logic
-- Run this in Supabase SQL Editor

ALTER TABLE games 
ADD COLUMN IF NOT EXISTS baseline_claim TEXT,
ADD COLUMN IF NOT EXISTS last_action TEXT DEFAULT 'normal' CHECK (last_action IN ('normal', 'reverseVsMexican'));

-- Add comment for documentation
COMMENT ON COLUMN games.baseline_claim IS 'Tracks the original claim through reverse claims (31/41). Null when no reverses active.';
COMMENT ON COLUMN games.last_action IS 'Type of last action: normal claim or reverseVsMexican (31 after 21)';
