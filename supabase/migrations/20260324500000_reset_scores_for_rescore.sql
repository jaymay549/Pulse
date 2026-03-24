-- Reset scores for re-backfill with improved scoring prompt
UPDATE public.vendor_mentions
  SET sentiment_score = NULL, nps_tier = NULL;
