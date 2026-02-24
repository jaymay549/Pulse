-- Vendor Pulse Summaries: AI-generated narrative intelligence per vendor
CREATE TABLE IF NOT EXISTS public.vendor_pulse_summaries (
  vendor_name TEXT PRIMARY KEY,
  summary_text TEXT NOT NULL,
  category_context TEXT,
  mention_count_at_generation INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: public read, service-role write
ALTER TABLE public.vendor_pulse_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read pulse summaries"
  ON public.vendor_pulse_summaries FOR SELECT
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_vendor_pulse_summaries_vendor
  ON public.vendor_pulse_summaries (vendor_name);
