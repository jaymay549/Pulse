import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Isolated vendor Supabase client.
// Uses storageKey: 'vendor-auth' to separate vendor sessions from the default
// Clerk-scoped anon client (which uses 'sb-<ref>-auth-token').
// detectSessionInURL: false prevents this client from intercepting Clerk OAuth redirect hashes.
export const vendorSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'vendor-auth',
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInURL: false,
  }
});
