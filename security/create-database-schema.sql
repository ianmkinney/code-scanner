-- =============================================
-- ZYN SCANNER DATABASE SCHEMA
-- =============================================
-- Complete database setup for ZYN Scanner application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#00cc6a',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scanned_codes table
CREATE TABLE IF NOT EXISTS public.scanned_codes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code TEXT NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    redeemed BOOLEAN DEFAULT FALSE,
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    redemption_error TEXT DEFAULT NULL
);

-- Create suggestions table
CREATE TABLE IF NOT EXISTS public.suggestions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    suggestion TEXT NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'implemented', 'rejected'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scanned_codes_user_id ON public.scanned_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_scanned_codes_code ON public.scanned_codes (code);
CREATE INDEX IF NOT EXISTS idx_scanned_codes_created_at ON public.scanned_codes (created_at);
CREATE INDEX IF NOT EXISTS idx_scanned_codes_redeemed ON public.scanned_codes (redeemed);
CREATE INDEX IF NOT EXISTS idx_scanned_codes_user_redeemed ON public.scanned_codes (user_id, redeemed);

CREATE INDEX IF NOT EXISTS idx_suggestions_user_id ON public.suggestions (user_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON public.suggestions (created_at);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON public.suggestions (status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for users table
DROP TRIGGER IF EXISTS handle_updated_at ON public.users;
CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanned_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view all users" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own user" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own user" ON public.users
    FOR UPDATE USING (true);

-- Scanned codes table policies
CREATE POLICY "Users can view all scanned codes" ON public.scanned_codes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert scanned codes" ON public.scanned_codes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update scanned codes" ON public.scanned_codes
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete scanned codes" ON public.scanned_codes
    FOR DELETE USING (true);

-- Suggestions table policies
CREATE POLICY "Users can view all suggestions" ON public.suggestions
    FOR SELECT USING (true);

CREATE POLICY "Users can insert suggestions" ON public.suggestions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update suggestions" ON public.suggestions
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete suggestions" ON public.suggestions
    FOR DELETE USING (true);

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Check if tables were created successfully
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'scanned_codes', 'suggestions')
ORDER BY table_name;

-- Check table structures
SELECT 
    table_name,
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name IN ('users', 'scanned_codes', 'suggestions')
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Check indexes
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('users', 'scanned_codes', 'suggestions')
AND schemaname = 'public'
ORDER BY tablename, indexname;

-- Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('users', 'scanned_codes', 'suggestions')
AND schemaname = 'public';
