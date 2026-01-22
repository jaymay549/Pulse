-- Create enum for review type
CREATE TYPE public.review_type AS ENUM ('positive', 'warning');

-- Create vendor_reviews table
CREATE TABLE public.vendor_reviews (
  id SERIAL PRIMARY KEY,
  vendor_name TEXT NOT NULL,
  title TEXT NOT NULL,
  quote TEXT NOT NULL,
  explanation TEXT,
  member TEXT,
  type review_type NOT NULL DEFAULT 'positive',
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for category filtering
CREATE INDEX idx_vendor_reviews_category ON public.vendor_reviews(category);

-- Create index for type filtering
CREATE INDEX idx_vendor_reviews_type ON public.vendor_reviews(type);

-- Create index for vendor name search
CREATE INDEX idx_vendor_reviews_vendor_name ON public.vendor_reviews(vendor_name);

-- Enable RLS
ALTER TABLE public.vendor_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews (public data)
CREATE POLICY "Anyone can view vendor reviews"
ON public.vendor_reviews
FOR SELECT
USING (true);

-- Only service role can insert/update/delete (admin operations)
-- No policies for INSERT/UPDATE/DELETE means only service role can do these

-- Trigger for updated_at
CREATE TRIGGER update_vendor_reviews_updated_at
BEFORE UPDATE ON public.vendor_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();