import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const supabaseConfig = {
  url: 'https://YOUR_PROJECT_ID.supabase.co',
  publishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
  secretKey: 'YOUR_SUPABASE_SECRET_KEY',
  jwksUrl: 'https://YOUR_PROJECT_ID.supabase.co/auth/v1/.well-known/jwks.json',
  storageBucket: 'lead-assets'
};

export const supabase: SupabaseClient = createClient(
  supabaseConfig.url,
  supabaseConfig.publishableKey
);
