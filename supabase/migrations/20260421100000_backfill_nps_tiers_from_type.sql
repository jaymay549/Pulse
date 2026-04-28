-- ============================================================
-- Backfill nps_tier and sentinel sentiment_score from mention type
--
-- Root cause: Migration 20260324500000 ran
--   UPDATE public.vendor_mentions SET sentiment_score = NULL, nps_tier = NULL
-- wiping all NPS tier data in preparation for an AI re-score via the
-- reclassify-mentions edge function — which was never re-run.
--
-- This migration restores a deterministic NPS classification based on
-- the existing `type` column, which was NOT wiped:
--   positive           → promoter  (score 4 — threshold for promoter is >= 4)
--   negative / warning → detractor (score 4 — threshold for detractor is >= 4)
--   neutral / mixed    → passive   (score 2 — below both thresholds)
--
-- This gives a meaningful NPS distribution immediately. The
-- reclassify-mentions edge function can still be run later to refine
-- individual rows with AI-scored sentiment_score values; it only
-- processes rows WHERE sentiment_score IS NULL, so it will skip these.
-- To allow AI refinement later, set sentinel scores to NULL after
-- running the reclassifier: see the note at the bottom.
-- ============================================================

UPDATE public.vendor_mentions
SET
  sentiment_score = CASE
    WHEN type IN ('positive')           THEN 4
    WHEN type IN ('negative', 'warning') THEN 4
    ELSE 2  -- neutral, mixed
  END,
  nps_tier = CASE
    WHEN type = 'positive'              THEN 'promoter'
    WHEN type IN ('negative', 'warning') THEN 'detractor'
    ELSE 'passive'  -- neutral, mixed
  END
WHERE sentiment_score IS NULL
  AND nps_tier IS NULL;

-- ============================================================
-- NOTE: sentinel scores set above (2 and 4) are intentionally
-- low-fidelity placeholders. After running the reclassify-mentions
-- edge function to AI-score individual mentions, those rows will
-- have accurate sentiment_score values and this update will not
-- re-apply (WHERE sentiment_score IS NULL guards it).
--
-- If you want to allow the AI reclassifier to re-process ALL rows
-- (not just new ones), run:
--   UPDATE public.vendor_mentions SET sentiment_score = NULL, nps_tier = NULL;
-- then trigger the reclassify-mentions edge function in batches.
-- ============================================================
