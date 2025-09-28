-- =============================================
-- ADD REDEEMED COLUMN TO SCANNED_CODES TABLE
-- =============================================
-- This adds support for ZYN rewards redemption tracking

-- Add redeemed column to scanned_codes table
ALTER TABLE public.scanned_codes 
ADD COLUMN IF NOT EXISTS redeemed BOOLEAN DEFAULT FALSE;

-- Add redeemed_at timestamp column to track when codes were redeemed
ALTER TABLE public.scanned_codes 
ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add redemption_error column to track failed redemptions
ALTER TABLE public.scanned_codes 
ADD COLUMN IF NOT EXISTS redemption_error TEXT DEFAULT NULL;

-- Add index on redeemed column for better query performance
CREATE INDEX IF NOT EXISTS idx_scanned_codes_redeemed 
ON public.scanned_codes (redeemed);

-- Add index on user_id and redeemed for filtering
CREATE INDEX IF NOT EXISTS idx_scanned_codes_user_redeemed 
ON public.scanned_codes (user_id, redeemed);

-- Update existing policies to include new columns
-- The existing policies already allow all operations, so no changes needed

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Run these to verify the schema changes:

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'scanned_codes' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'scanned_codes' 
AND schemaname = 'public';
