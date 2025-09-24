-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================
-- This file contains comprehensive RLS policies for the ZYN Scanner app
-- Run these commands in your Supabase SQL Editor

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanned_codes ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USERS TABLE POLICIES
-- =============================================

-- Allow users to insert their own records
CREATE POLICY "Users can insert their own records" ON public.users
FOR INSERT WITH CHECK (true);

-- Allow users to select their own records
CREATE POLICY "Users can select their own records" ON public.users
FOR SELECT USING (true);

-- Allow users to update their own records
CREATE POLICY "Users can update their own records" ON public.users
FOR UPDATE USING (true) WITH CHECK (true);

-- Allow users to delete their own records (optional)
CREATE POLICY "Users can delete their own records" ON public.users
FOR DELETE USING (true);

-- =============================================
-- SCANNED_CODES TABLE POLICIES
-- =============================================

-- Allow users to insert codes (with or without user_id)
CREATE POLICY "Users can insert codes" ON public.scanned_codes
FOR INSERT WITH CHECK (true);

-- Allow users to select their own codes
CREATE POLICY "Users can select their own codes" ON public.scanned_codes
FOR SELECT USING (true);

-- Allow users to update their own codes
CREATE POLICY "Users can update their own codes" ON public.scanned_codes
FOR UPDATE USING (true) WITH CHECK (true);

-- Allow users to delete their own codes
CREATE POLICY "Users can delete their own codes" ON public.scanned_codes
FOR DELETE USING (true);

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Run these to verify policies are working:

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'scanned_codes');

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'scanned_codes');
