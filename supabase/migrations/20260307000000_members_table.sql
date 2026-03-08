-- ============================================================
-- Members table: CDG Circles member profiles
-- Source: one-time Airtable import, Supabase is source of truth going forward
-- ============================================================

CREATE TABLE public.members (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id          TEXT UNIQUE,

  -- Identity
  name                   TEXT NOT NULL,
  email                  TEXT,
  phone                  TEXT,
  whatsapp_number        TEXT UNIQUE,

  -- Dealership & Role
  dealership_name        TEXT,
  role                   TEXT,
  role_band              TEXT,
  oems                   TEXT[] DEFAULT '{}',
  rooftops               INTEGER,

  -- Location
  city                   TEXT,
  state                  TEXT,
  zip                    TEXT,
  region                 TEXT,

  -- CDG Membership
  tier                   TEXT DEFAULT 'free',
  cohort_id              TEXT,
  status                 TEXT DEFAULT 'active',
  amount_paid            NUMERIC,
  payment_status         TEXT,
  stripe_customer_id     TEXT,

  -- Interests & Context
  biggest_focus          TEXT,
  area_of_interest       TEXT,
  annual_revenue         TEXT,
  volunteer_group_leader BOOLEAN DEFAULT false,
  source_ref             TEXT,
  additional_notes       TEXT,

  -- Timestamps
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_members_email ON public.members (email);
CREATE INDEX idx_members_state ON public.members (state);
CREATE INDEX idx_members_role ON public.members (role);

-- Updated_at trigger (reuse existing function)
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Members can read their own row
CREATE POLICY "Members can view own profile"
  ON public.members FOR SELECT
  USING (clerk_user_id = (auth.jwt() ->> 'sub'));

-- Members can update their own row (limited fields via app logic)
CREATE POLICY "Members can update own profile"
  ON public.members FOR UPDATE
  USING (clerk_user_id = (auth.jwt() ->> 'sub'));

-- Admins can do everything
CREATE POLICY "Admins full access to members"
  ON public.members FOR ALL
  USING ((auth.jwt() ->> 'user_role') = 'admin');

-- Service role (for import, backfill, triggers)
GRANT ALL ON public.members TO service_role;
