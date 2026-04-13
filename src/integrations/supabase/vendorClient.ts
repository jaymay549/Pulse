import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Isolated vendor Supabase client — separate storageKey prevents session collision with Clerk auth.
// Import like: import { vendorSupabase } from "@/integrations/supabase/vendorClient";
export const vendorSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'vendor-auth',
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInURL: false,
  },
});
