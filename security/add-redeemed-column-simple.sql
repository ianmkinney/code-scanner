-- Simple version to add redemption columns
ALTER TABLE public.scanned_codes ADD COLUMN IF NOT EXISTS redeemed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.scanned_codes ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.scanned_codes ADD COLUMN IF NOT EXISTS redemption_error TEXT DEFAULT NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_scanned_codes_redeemed ON public.scanned_codes (redeemed);
CREATE INDEX IF NOT EXISTS idx_scanned_codes_user_redeemed ON public.scanned_codes (user_id, redeemed);

