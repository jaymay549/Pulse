-- Add member attribution to vendor mentions
ALTER TABLE public.vendor_mentions
  ADD COLUMN member_id UUID REFERENCES public.members(id);

CREATE INDEX idx_vendor_mentions_member_id
  ON public.vendor_mentions (member_id)
  WHERE member_id IS NOT NULL;
