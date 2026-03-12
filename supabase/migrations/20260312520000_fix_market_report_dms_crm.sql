-- Fix get_tech_stack_market_report:
--
-- 1. Inclusive DMS/CRM category matching (same as get_compared_vendors fix).
--    CDK is category='dms-crm' but post-split most peers are 'dms' or 'crm'.
--    The exact-match meant CDK users saw no alternatives and no meaningful
--    percentile rank. Now any of dms/crm/dms-crm is treated as one pool.
--
-- 2. Add index on vendor_metadata(category) to speed up all category-scoped
--    joins across get_compared_vendors, get_tech_stack_market_report, etc.

CREATE INDEX IF NOT EXISTS idx_vendor_metadata_category
  ON public.vendor_metadata (category);

CREATE INDEX IF NOT EXISTS idx_vendor_metric_scores_health
  ON public.vendor_metric_scores (health_score)
  WHERE health_score IS NOT NULL;

-- Helper: returns TRUE when two category strings are in the same competitive
-- pool (treating dms / crm / dms-crm as a single pool).
CREATE OR REPLACE FUNCTION public._categories_match(a TEXT, b TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    a = b
    OR (
      a IN ('dms', 'crm', 'dms-crm')
      AND b IN ('dms', 'crm', 'dms-crm')
    );
$$;

CREATE OR REPLACE FUNCTION get_tech_stack_market_report(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_current JSONB;
  v_former JSONB;
  v_count INTEGER;
BEGIN
  -- Current vendors with metrics, benchmarks, and alternatives
  SELECT COALESCE(jsonb_agg(vendor_row ORDER BY vendor_row->>'vendor_name'), '[]'::JSONB)
  INTO v_current
  FROM (
    SELECT jsonb_build_object(
      'vendor_name', ts.vendor_name,
      'category', m.category,
      'status', ts.status,
      'sentiment_score', ts.sentiment_score,
      'switching_intent', ts.switching_intent,
      'health_score', ms.health_score,
      'category_median', cb.product_stability_median,
      'percentile', CASE
        WHEN ms.health_score IS NOT NULL AND cb.qualifying_vendor_count >= 4 THEN (
          SELECT ROUND(
            (COUNT(*) FILTER (WHERE s.health_score <= ms.health_score)::NUMERIC
             / NULLIF(COUNT(*), 0)) * 100
          )
          FROM public.vendor_metric_scores s
          JOIN public.vendor_metadata vm ON s.vendor_name = vm.vendor_name
          WHERE public._categories_match(vm.category, m.category)
            AND s.health_score IS NOT NULL
        )
        ELSE NULL
      END,
      'exploring_reasons', (
        SELECT COALESCE(jsonb_agg(er.reason_category), '[]'::JSONB)
        FROM public.user_tech_stack_exit_reasons er
        WHERE er.tech_stack_id = ts.id
      ),
      'alternatives', CASE
        WHEN ts.status = 'exploring' THEN (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'vendor_name', alt.vendor_name,
              'health_score', alt.health_score,
              'highlight_metric', COALESCE(
                CASE (
                  SELECT er2.reason_category
                  FROM public.user_tech_stack_exit_reasons er2
                  WHERE er2.tech_stack_id = ts.id
                  ORDER BY er2.created_at LIMIT 1
                )
                  WHEN 'pricing' THEN 'value_perception'
                  WHEN 'support' THEN 'customer_experience'
                  WHEN 'features' THEN 'product_stability'
                  WHEN 'reliability' THEN 'product_stability'
                  WHEN 'integration' THEN 'product_stability'
                  ELSE 'health_score'
                END,
                'health_score'
              ),
              'highlight_score', COALESCE(
                CASE (
                  SELECT er3.reason_category
                  FROM public.user_tech_stack_exit_reasons er3
                  WHERE er3.tech_stack_id = ts.id
                  ORDER BY er3.created_at LIMIT 1
                )
                  WHEN 'pricing' THEN alt.value_perception
                  WHEN 'support' THEN alt.customer_experience
                  WHEN 'features' THEN alt.product_stability
                  WHEN 'reliability' THEN alt.product_stability
                  WHEN 'integration' THEN alt.product_stability
                  ELSE alt.health_score
                END,
                alt.health_score
              )
            ) ORDER BY alt.health_score DESC NULLS LAST
          ), '[]'::JSONB)
          FROM (
            SELECT s.vendor_name, s.health_score,
                   s.product_stability, s.customer_experience, s.value_perception
            FROM public.vendor_metric_scores s
            JOIN public.vendor_metadata vm ON s.vendor_name = vm.vendor_name
            WHERE public._categories_match(vm.category, m.category)
              AND s.health_score IS NOT NULL
              AND s.vendor_name != ts.vendor_name
              AND s.vendor_name NOT IN (
                SELECT ts2.vendor_name FROM public.user_tech_stack ts2
                WHERE ts2.user_id = p_user_id
              )
            ORDER BY s.health_score DESC
            LIMIT 3
          ) alt
        )
        ELSE '[]'::JSONB
      END
    ) AS vendor_row
    FROM public.user_tech_stack ts
    LEFT JOIN public.vendor_metadata m ON ts.vendor_name = m.vendor_name
    LEFT JOIN public.vendor_metric_scores ms ON ts.vendor_name = ms.vendor_name
    LEFT JOIN public.category_benchmarks cb ON public._categories_match(m.category, cb.category)
    WHERE ts.user_id = p_user_id
      AND ts.is_current = true
  ) sub;

  -- Former vendors
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'vendor_name', ts.vendor_name,
      'sentiment_score', ts.sentiment_score,
      'exit_reasons', (
        SELECT COALESCE(jsonb_agg(er.reason_category), '[]'::JSONB)
        FROM public.user_tech_stack_exit_reasons er
        WHERE er.tech_stack_id = ts.id
      )
    )
  ), '[]'::JSONB) INTO v_former
  FROM public.user_tech_stack ts
  WHERE ts.user_id = p_user_id
    AND ts.is_current = false;

  -- Total vendor contribution count
  SELECT COUNT(*) INTO v_count
  FROM public.user_tech_stack
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'is_complete', (
      SELECT NOT EXISTS (
        SELECT 1 FROM public.user_tech_stack t
        WHERE t.user_id = p_user_id AND t.sentiment_score IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM public.user_tech_stack t
        WHERE t.user_id = p_user_id AND t.is_current = true
      )
    ),
    'current_vendors', v_current,
    'former_vendors', v_former,
    'contribution_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_tech_stack_market_report(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public._categories_match(TEXT, TEXT) TO authenticated, anon, service_role;
