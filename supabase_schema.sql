-- ==============================================================================
-- EXHIBITION LEADS MANAGEMENT - SUPABASE COMPLETE DATABASE SCHEMA
-- ==============================================================================
-- Run this script in your Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/rxsnrpkkejoqwujoireu/sql/new
-- ==============================================================================

-- 1. Create USERS table
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    short_name TEXT,
    email TEXT,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Marketing',
    user_group TEXT NOT NULL DEFAULT 'Sales Team',
    status TEXT NOT NULL DEFAULT 'Active',
    phone TEXT,
    address1 TEXT,
    address2 TEXT,
    city TEXT,
    state TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create EXHIBITIONS table
CREATE TABLE IF NOT EXISTS public.exhibitions (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    organizer TEXT,
    venue TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    duration_days INT DEFAULT 3,
    description TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create STALLS table
CREATE TABLE IF NOT EXISTS public.stalls (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    exhibition_id TEXT,
    event_name TEXT,
    organizer TEXT,
    duration_days INT DEFAULT 3,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    location TEXT,
    hall_number TEXT,
    booth_number TEXT,
    owner_id TEXT,
    owner_name TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create LEADS table
CREATE TABLE IF NOT EXISTS public.leads (
    id TEXT PRIMARY KEY,
    lead_number TEXT UNIQUE NOT NULL,
    exhibition_id TEXT,
    rep_id TEXT,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    designation TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    website TEXT,
    address TEXT,
    capture_method TEXT DEFAULT 'manual',
    card_image_url TEXT,
    voice_audio_url TEXT,
    interest_level TEXT DEFAULT 'Warm',
    product_category JSONB DEFAULT '[]'::jsonb,
    priority TEXT DEFAULT 'Medium',
    budget NUMERIC,
    purchase_timeline TEXT,
    follow_up_date TEXT,
    remarks TEXT,
    voice_notes_transcript TEXT,
    sync_status TEXT DEFAULT 'Synced',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS) and grant open access for API keys
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all on users" ON public.users;
CREATE POLICY "Allow public all on users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on exhibitions" ON public.exhibitions;
CREATE POLICY "Allow public all on exhibitions" ON public.exhibitions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on stalls" ON public.stalls;
CREATE POLICY "Allow public all on stalls" ON public.stalls FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on leads" ON public.leads;
CREATE POLICY "Allow public all on leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);

-- 6. Seed default Admin User (Sanjay)
INSERT INTO public.users (
    id, username, full_name, short_name, email, password, role, user_group, status, phone, address1, address2, city, state
) VALUES (
    'user-sanjay',
    'sanjay',
    'Sanjay',
    'Sanjay',
    'sanjay@company.com',
    '123456',
    'Admin',
    'Admin',
    'Active',
    '+91 98765 43210',
    'Trade Fair Complex',
    'Hall 1',
    'Coimbatore',
    'Tamil Nadu'
) ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- 7. Ensure Storage bucket 'lead-assets' exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-assets', 'lead-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public uploads to lead-assets" ON storage.objects;
CREATE POLICY "Allow public uploads to lead-assets" ON storage.objects FOR ALL USING (bucket_id = 'lead-assets') WITH CHECK (bucket_id = 'lead-assets');
