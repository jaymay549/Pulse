-- Create a table to track vendor entry statistics (views and shares)
CREATE TABLE public.vendor_entry_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id INTEGER NOT NULL UNIQUE,
  views INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.vendor_entry_stats ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read stats (public data)
CREATE POLICY "Anyone can view entry stats"
ON public.vendor_entry_stats
FOR SELECT
USING (true);

-- Allow anyone to insert stats (for new entries)
CREATE POLICY "Anyone can insert entry stats"
ON public.vendor_entry_stats
FOR INSERT
WITH CHECK (true);

-- Allow anyone to update stats (increment views/shares)
CREATE POLICY "Anyone can update entry stats"
ON public.vendor_entry_stats
FOR UPDATE
USING (true);

-- Create index for faster lookups by entry_id
CREATE INDEX idx_vendor_entry_stats_entry_id ON public.vendor_entry_stats(entry_id);

-- Create index for trending queries (views desc)
CREATE INDEX idx_vendor_entry_stats_views ON public.vendor_entry_stats(views DESC);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_vendor_entry_stats_updated_at
BEFORE UPDATE ON public.vendor_entry_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();