-- Vendor login identity bridge: maps Supabase Auth UUID to vendor name and tier.
-- auth.uid() returns UUID for native Supabase Auth sessions (vendor).
-- For Clerk JWT sessions, auth.uid() returns NULL — this table is vendor-only.

CREATE TABLE public.vendor_logins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'unverified'
    CHECK (tier IN ('unverified', 'tier_1', 'tier_2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for vendor_name lookups (dashboard resolution)
CREATE INDEX idx_vendor_logins_vendor_name ON public.vendor_logins(vendor_name);

-- Enable RLS
ALTER TABLE public.vendor_logins ENABLE ROW LEVEL SECURITY;

-- Vendor can read their own login row (auth.uid() works for native Supabase Auth)
CREATE POLICY "Vendor can read own login"
  ON public.vendor_logins FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Comment for documentation
COMMENT ON TABLE public.vendor_logins IS 'Maps Supabase Auth user UUID to vendor identity and tier. Created by admin provisioning (Phase 2). Read by vendor dashboard for identity resolution.';
