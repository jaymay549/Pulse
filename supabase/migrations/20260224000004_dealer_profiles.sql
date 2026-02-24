-- Dealer profiles for "Dealers Like You" personalization
CREATE TABLE IF NOT EXISTS public.dealer_profiles (
  user_id TEXT PRIMARY KEY,
  rooftop_size TEXT CHECK (rooftop_size IN ('small', 'mid-size', 'large')),
  region TEXT,
  shopping_for TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.dealer_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own profile
CREATE POLICY "Users manage own dealer profile"
  ON public.dealer_profiles
  FOR ALL
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

COMMENT ON TABLE public.dealer_profiles IS 'Stores dealer characteristics for Dealers Like You personalization';
