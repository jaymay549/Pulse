-- ============================================================
-- Backfill the ~26 mentions with NULL nps_tier
-- These had empty quotes so the AI reclassifier skipped them.
-- Derive tier from type using default score of 3 (moderate).
-- ============================================================

UPDATE public.vendor_mentions
SET
  sentiment_score = 3,
  nps_tier = CASE
    WHEN type IN ('neutral', 'mixed') THEN 'passive'
    WHEN type = 'positive' THEN 'passive'   -- score 3 = not strong enough for promoter
    WHEN type IN ('negative', 'warning') THEN 'passive'  -- score 3 = not strong enough for detractor
    ELSE 'passive'
  END
WHERE sentiment_score IS NULL;
