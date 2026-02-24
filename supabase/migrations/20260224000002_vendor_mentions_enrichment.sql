-- Add structured extraction columns for pricing and switching intelligence
ALTER TABLE public.vendor_mentions
  ADD COLUMN IF NOT EXISTS pricing_signal JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS switching_signal JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dealership_context JSONB DEFAULT NULL;

COMMENT ON COLUMN public.vendor_mentions.pricing_signal IS 'Extracted pricing data: amount, terms, unit_type';
COMMENT ON COLUMN public.vendor_mentions.switching_signal IS 'Extracted switching data: direction, other_vendor, outcome';
COMMENT ON COLUMN public.vendor_mentions.dealership_context IS 'Extracted dealer context: size, rooftop_count, region';
