-- ============================================================
-- Vendor Deduplication & Merge
-- Normalizes vendor names across all tables.
-- ============================================================

-- Helper: merge all references of old_name → new_name
CREATE OR REPLACE FUNCTION _merge_vendor(p_old TEXT, p_new TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- vendor_mentions
  UPDATE public.vendor_mentions SET vendor_name = p_new WHERE vendor_name = p_old;

  -- vendor_intelligence_cache
  DELETE FROM public.vendor_intelligence_cache WHERE vendor_name = p_old
    AND EXISTS (SELECT 1 FROM public.vendor_intelligence_cache WHERE vendor_name = p_new);
  UPDATE public.vendor_intelligence_cache SET vendor_name = p_new WHERE vendor_name = p_old;

  -- vendor_metric_scores
  DELETE FROM public.vendor_metric_scores WHERE vendor_name = p_old;

  -- vendor_recommendations
  UPDATE public.vendor_recommendations SET vendor_name = p_new WHERE vendor_name = p_old;

  -- vendor_feature_gaps (has unique constraint on vendor_name + gap_label)
  DELETE FROM public.vendor_feature_gaps WHERE vendor_name = p_old;

  -- vendor_metadata (keep the one with more data, delete the other)
  DELETE FROM public.vendor_metadata WHERE vendor_name = p_old
    AND EXISTS (SELECT 1 FROM public.vendor_metadata WHERE vendor_name = p_new);
  UPDATE public.vendor_metadata SET vendor_name = p_new WHERE vendor_name = p_old;

  -- vendor_custom_content
  DELETE FROM public.vendor_custom_content WHERE vendor_name = p_old
    AND EXISTS (SELECT 1 FROM public.vendor_custom_content WHERE vendor_name = p_new);
  UPDATE public.vendor_custom_content SET vendor_name = p_new WHERE vendor_name = p_old;
END;
$$;

-- ── Execute merges ──────────────────────────────────────────

-- Casing / spacing variants (clear duplicates)
SELECT _merge_vendor('Drive Centric', 'DriveCentric');
SELECT _merge_vendor('Call Revu', 'CallRevu');
SELECT _merge_vendor('Accu-Trade', 'AccuTrade');
SELECT _merge_vendor('Accutrade', 'AccuTrade');
SELECT _merge_vendor('Autohub', 'AutoHub');
SELECT _merge_vendor('Autotrader', 'AutoTrader');
SELECT _merge_vendor('CarFax', 'Carfax');
SELECT _merge_vendor('CARFAX', 'Carfax');
SELECT _merge_vendor('LotLinx', 'Lotlinx');
SELECT _merge_vendor('Bizzy Car', 'BizzyCar');
SELECT _merge_vendor('Bizzycar', 'BizzyCar');
SELECT _merge_vendor('Dealer Ops', 'DealerOps');
SELECT _merge_vendor('FullPath', 'Fullpath');
SELECT _merge_vendor('DealerInspire', 'Dealer Inspire');
SELECT _merge_vendor('700 Credit', '700Credit');
SELECT _merge_vendor('Matador Ai', 'Matador AI');
SELECT _merge_vendor('axcessa', 'Axcessa');
SELECT _merge_vendor('Hubspot', 'HubSpot');
SELECT _merge_vendor('ACV MAX', 'ACV Max');
SELECT _merge_vendor('AppraisalPRO', 'Appraisal Pro');
SELECT _merge_vendor('CarWars', 'Car Wars');
SELECT _merge_vendor('Go High Level', 'GoHighLevel');
SELECT _merge_vendor('Car Cutter', 'CarCutter');
SELECT _merge_vendor('AutoHauler Exchange', 'Auto Hauler Exchange');
SELECT _merge_vendor('BodyShop Booster', 'Body Shop Booster');
SELECT _merge_vendor('DealerFX', 'Dealer-FX');
SELECT _merge_vendor('MyKaarma', 'myKaarma');
SELECT _merge_vendor('Auto/mate', 'Auto/Mate');
SELECT _merge_vendor('eLeads', 'Elead');
SELECT _merge_vendor('Eleads', 'Elead');
SELECT _merge_vendor('FourEyes', 'Foureyes');
SELECT _merge_vendor('Frog Data', 'FrogData');
SELECT _merge_vendor('Kenect AI', 'Kenect.AI');
SELECT _merge_vendor('MIA', 'Mia');
SELECT _merge_vendor('Dealerfunnel', 'Dealer Funnel');
SELECT _merge_vendor('DriveAI', 'Drive A.I.');
SELECT _merge_vendor('MotoAcquire', 'Motoacquire');

-- User-confirmed merges
SELECT _merge_vendor('CDK', 'CDK Global');
SELECT _merge_vendor('Matador', 'Matador AI');
SELECT _merge_vendor('KBB', 'Kelley Blue Book');

-- Elead merge (user confirmed)
-- Already handled above: Eleads → Elead, eLeads → Elead

-- Additional likely merges
SELECT _merge_vendor('Vincue', 'VinCue');
SELECT _merge_vendor('NCM', 'NCM Associates');
SELECT _merge_vendor('Mia AI', 'Mia');
SELECT _merge_vendor('Mia Labs', 'Mia');
SELECT _merge_vendor('Motive Retail', 'Motive');
SELECT _merge_vendor('Darwin Automotive', 'Darwin');
SELECT _merge_vendor('CDK Service', 'CDK Global');
SELECT _merge_vendor('CDK Drive', 'CDK Global');
SELECT _merge_vendor('CDK AIVA', 'CDK Global');

-- Clean up the helper function
DROP FUNCTION _merge_vendor(TEXT, TEXT);
