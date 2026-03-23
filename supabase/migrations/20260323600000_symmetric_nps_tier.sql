-- ============================================================
-- Symmetric NPS Tier Logic + Reset for Re-backfill
-- Promoter: positive + score >= 4
-- Detractor: negative + score >= 4
-- Passive: everything else (mild opinions, neutral, mixed)
-- ============================================================

-- Update derive_nps_tier to symmetric logic
CREATE OR REPLACE FUNCTION public.derive_nps_tier(
  p_type public.review_type,
  p_score SMALLINT
) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_type = 'positive' AND p_score >= 4 THEN
    RETURN 'promoter';
  ELSIF p_type IN ('negative', 'warning') AND p_score >= 4 THEN
    RETURN 'detractor';
  ELSE
    RETURN 'passive';
  END IF;
END;
$$;

-- Clear sentiment_score + nps_tier so reclassify-mentions re-processes all rows
UPDATE public.vendor_mentions
  SET sentiment_score = NULL, nps_tier = NULL;
