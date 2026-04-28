---
status: fixing
trigger: "nps-showing-all-zeros — Dealer NPS component shows all zeros"
created: 2026-04-21T00:00:00Z
updated: 2026-04-21T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — nps_tier and sentiment_score are NULL for all vendor_mentions rows because migration 20260324500000 wiped them with SET sentiment_score = NULL, nps_tier = NULL and no subsequent migration or backfill restored them. The reclassify-mentions edge function is the only mechanism that sets these fields, and it must be triggered manually.
test: Complete — root cause confirmed through full migration trace
expecting: Fix = new migration that derives nps_tier from type column deterministically
next_action: Write migration 20260421100000_backfill_nps_tiers_from_type.sql

## Symptoms

expected: NPS section should show real data — promoter/passive/detractor counts and an aggregate NPS score based on vendor reviews/mentions
actual: All values show 0, aggregate score bar is empty
errors: No visible errors — the component renders, just with zero data
reproduction: Navigate to the vendor dashboard page and look at the Dealer NPS card
started: After migration 20260324500000 ran (reset_scores_for_rescore) — wiped all nps_tier values

## Eliminated

- hypothesis: Hardcoded zeros in NPSChart.tsx component
  evidence: NPSChart is a pure presentational component that renders props. The props come from latestSentiment (last entry of sentiment_history from RPC).
  timestamp: 2026-04-21

- hypothesis: Wrong vendor name or missing vendor ID in query
  evidence: The RPCs return total_mentions > 0 for other fields (sentiment charts work), so the vendor is being found. Only nps_tier counts are 0.
  timestamp: 2026-04-21

- hypothesis: Data never existed
  evidence: Multiple migrations exist that set nps_tier (backfill, symmetric logic). The data existed but was wiped.
  timestamp: 2026-04-21

## Evidence

- timestamp: 2026-04-21
  checked: NPSChart.tsx
  found: Pure presentational component, props are promoterCount/passiveCount/detractorCount. If total=0, npsScore=null (shows "—"). Counts come entirely from props.
  implication: Bug is upstream in the data, not the component.

- timestamp: 2026-04-21
  checked: VendorCommandCenter.tsx and DashboardOverview.tsx
  found: Both pass `latestSentiment?.promoter_count ?? 0` etc to NPSChart. latestSentiment = last entry of sentiment_history array from RPCs.
  implication: Both RPCs (get_vendor_dashboard_intel and get_vendor_sentiment_history) must be returning all-zero NPS counts.

- timestamp: 2026-04-21
  checked: get_vendor_dashboard_intel and get_vendor_sentiment_history SQL functions (migrations)
  found: Both query `COUNT(*) FILTER (WHERE nps_tier = 'promoter')` etc on vendor_mentions. If nps_tier IS NULL for all rows, these counts will be 0.
  implication: nps_tier column is NULL for all rows.

- timestamp: 2026-04-21
  checked: Migration history for nps_tier population
  found: 20260323100000 added nps_tier column and derive_nps_tier(). 20260323600000 wiped all values (SET sentiment_score = NULL, nps_tier = NULL) for re-scoring. 20260324300000 backfilled NULL rows using score=3 (all → passive). 20260324500000 WIPED AGAIN (SET sentiment_score = NULL, nps_tier = NULL). No subsequent migration restored values.
  implication: All vendor_mentions rows have nps_tier = NULL in production right now.

- timestamp: 2026-04-21
  checked: reclassify-mentions edge function
  found: This is the only mechanism that sets nps_tier via AI scoring. It processes rows where sentiment_score IS NULL in batches of 20. It requires manual triggering.
  implication: After the reset migration, the reclassifier was never re-run, leaving all nps_tier = NULL.

- timestamp: 2026-04-21
  checked: sync_single_wam_processed_mention (the WAM → public.vendor_mentions sync trigger)
  found: Does NOT set nps_tier or sentiment_score. New mentions synced from WAM arrive with NULL nps_tier.
  implication: Even new mentions arriving after the reset have nps_tier = NULL.

## Resolution

root_cause: Migration 20260324500000_reset_scores_for_rescore.sql ran UPDATE public.vendor_mentions SET sentiment_score = NULL, nps_tier = NULL, wiping all NPS tier data. The reclassify-mentions edge function (the only mechanism that sets nps_tier) was never re-run after this reset. As a result, every vendor_mentions row has nps_tier = NULL, causing all COUNT(*) FILTER (WHERE nps_tier = '...') queries to return 0.
fix: New migration 20260421100000_backfill_nps_tiers_from_type.sql that deterministically derives nps_tier from the existing type column (positive → promoter with score 4, negative/warning → detractor with score 4, neutral/mixed → passive with score 2). Uses sentinel scores compatible with the symmetric derive_nps_tier() thresholds (score >= 4 triggers promoter/detractor). Migration is safe to apply: only touches rows WHERE sentiment_score IS NULL AND nps_tier IS NULL.
verification: Pending human verification — deploy migration and check NPS chart shows non-zero values.
files_changed:
  - supabase/migrations/20260421100000_backfill_nps_tiers_from_type.sql
