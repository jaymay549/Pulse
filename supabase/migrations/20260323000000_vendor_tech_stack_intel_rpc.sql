-- ============================================================
-- Vendor Tech Stack Intel RPC
-- Aggregates dealer-reported tech stack data for vendor dashboards.
-- Returns: adoption count, avg sentiment, switching risk,
--   exit reason breakdown, and category market share.
-- Privacy: minimum 3 dealers required to surface any aggregate.
-- ============================================================

CREATE OR REPLACE FUNCTION get_vendor_tech_stack_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_id UUID;
  v_canonical TEXT;
  v_category TEXT;
  v_result JSONB;
  v_adoption INTEGER;
  v_total_in_category INTEGER;
  v_avg_sentiment NUMERIC;
  v_exploring INTEGER;
  v_left INTEGER;
  v_stable INTEGER;
  v_exit_reasons JSONB;
  v_min_threshold INTEGER := 3;
BEGIN
  -- Resolve entity for canonical name matching
  SELECT ve.id, ve.canonical_name
  INTO v_entity_id, v_canonical
  FROM public.vendor_entities ve
  WHERE lower(ve.canonical_name) = lower(p_vendor_name)
  LIMIT 1;

  v_canonical := COALESCE(v_canonical, p_vendor_name);

  -- Get vendor category
  SELECT vm.category INTO v_category
  FROM public.vendor_metadata vm
  WHERE lower(vm.vendor_name) = lower(v_canonical)
  LIMIT 1;

  -- Count current users of this vendor (case-insensitive match)
  SELECT
    COUNT(*),
    ROUND(AVG(sentiment_score)::NUMERIC, 1),
    COUNT(*) FILTER (WHERE status = 'exploring'),
    COUNT(*) FILTER (WHERE status = 'left'),
    COUNT(*) FILTER (WHERE status = 'stable')
  INTO v_adoption, v_avg_sentiment, v_exploring, v_left, v_stable
  FROM public.user_tech_stack
  WHERE lower(vendor_name) = lower(v_canonical)
    AND is_current = true;

  -- Below privacy threshold — return empty
  IF v_adoption < v_min_threshold THEN
    RETURN jsonb_build_object(
      'vendor_name', v_canonical,
      'category', v_category,
      'below_threshold', true,
      'adoption_count', v_adoption,
      'min_threshold', v_min_threshold
    );
  END IF;

  -- Total dealers in same category (for market share)
  IF v_category IS NOT NULL THEN
    SELECT COUNT(DISTINCT user_id)
    INTO v_total_in_category
    FROM public.user_tech_stack
    WHERE category = v_category
      AND is_current = true;
  ELSE
    v_total_in_category := 0;
  END IF;

  -- Aggregate exit reasons across all dealers exploring/leaving this vendor
  SELECT COALESCE(jsonb_agg(reason_row), '[]'::JSONB)
  INTO v_exit_reasons
  FROM (
    SELECT jsonb_build_object(
      'reason', er.reason_category,
      'count', COUNT(*)
    ) AS reason_row
    FROM public.user_tech_stack_exit_reasons er
    JOIN public.user_tech_stack ts ON er.tech_stack_id = ts.id
    WHERE lower(ts.vendor_name) = lower(v_canonical)
      AND ts.status IN ('exploring', 'left')
    GROUP BY er.reason_category
    ORDER BY COUNT(*) DESC
  ) sub;

  RETURN jsonb_build_object(
    'vendor_name', v_canonical,
    'category', v_category,
    'below_threshold', false,
    'adoption_count', v_adoption,
    'avg_sentiment', v_avg_sentiment,
    'status_breakdown', jsonb_build_object(
      'stable', v_stable,
      'exploring', v_exploring,
      'left', v_left
    ),
    'switching_risk_pct', CASE
      WHEN v_adoption > 0 THEN ROUND(((v_exploring + v_left)::NUMERIC / v_adoption) * 100)
      ELSE 0
    END,
    'exit_reasons', v_exit_reasons,
    'category_market_share', CASE
      WHEN v_total_in_category > 0 THEN jsonb_build_object(
        'vendor_count', v_adoption,
        'category_total', v_total_in_category,
        'share_pct', ROUND((v_adoption::NUMERIC / v_total_in_category) * 100)
      )
      ELSE NULL
    END
  );
END;
$$;

-- Vendor dashboard users + admins can call this
GRANT EXECUTE ON FUNCTION get_vendor_tech_stack_intel(TEXT) TO authenticated;

COMMENT ON FUNCTION get_vendor_tech_stack_intel IS
  'Aggregates dealer tech stack data for vendor dashboard: adoption, sentiment, switching risk, exit reasons, market share. Enforces 3-dealer minimum for privacy.';
