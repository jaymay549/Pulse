-- ============================================================
-- Fix WR-04: Statement timeout guard for backfill_vendor_mentions_family
--
-- Migration 20260416300000 called backfill_vendor_mentions_family(NULL)
-- which translates NULL to LIMIT 2147483647 (effectively unlimited).
-- On large datasets this runs as a single UPDATE inside a migration
-- transaction, holding a full table lock on vendor_mentions for the
-- entire duration — potentially timing out or blocking application
-- reads/writes.
--
-- This migration re-runs the backfill with an explicit 600-second
-- statement timeout to catch any mentions that may still be unlinked
-- (e.g., after alias repairs in fix WR-03). The timeout is reset
-- immediately after the call so it does not affect subsequent
-- statements in later migrations.
--
-- If your vendor_mentions table has millions of rows and the backfill
-- exceeds 600s, consider running it as a background job instead:
--   SELECT public.backfill_vendor_mentions_family(10000);  -- batched
-- ============================================================

-- Set a generous timeout for the full-table backfill
SET LOCAL statement_timeout = '600s';
SELECT public.backfill_vendor_mentions_family(NULL);
RESET statement_timeout;
