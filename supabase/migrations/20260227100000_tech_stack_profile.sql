-- ============================================================
-- Tech Stack Profile
-- Dealers report which CRM/DMS vendors they use, satisfaction,
-- switching intent, and reasons for leaving. Feeds vendor
-- intelligence and unlocks Market Intelligence Report.
-- ============================================================

-- ── user_tech_stack ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_tech_stack (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT true,
  sentiment_score INTEGER CHECK (sentiment_score BETWEEN 1 AND 10),
  switching_intent BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('stable', 'exploring', 'left')),
  insight_text TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, vendor_name)
);

ALTER TABLE public.user_tech_stack ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tech stack"
  ON public.user_tech_stack
  FOR ALL
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

CREATE INDEX idx_user_tech_stack_user
  ON public.user_tech_stack(user_id);

CREATE INDEX idx_user_tech_stack_vendor
  ON public.user_tech_stack(vendor_name);

-- ── user_tech_stack_exit_reasons ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_tech_stack_exit_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tech_stack_id UUID NOT NULL REFERENCES public.user_tech_stack(id) ON DELETE CASCADE,
  reason_category TEXT NOT NULL CHECK (reason_category IN (
    'pricing', 'support', 'features', 'reliability', 'integration', 'other'
  )),
  detail_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_tech_stack_exit_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own exit reasons"
  ON public.user_tech_stack_exit_reasons
  FOR ALL
  USING (
    tech_stack_id IN (
      SELECT id FROM public.user_tech_stack
      WHERE user_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    tech_stack_id IN (
      SELECT id FROM public.user_tech_stack
      WHERE user_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE INDEX idx_exit_reasons_stack
  ON public.user_tech_stack_exit_reasons(tech_stack_id);

-- ── user_submitted_vendors ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_submitted_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  website_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  matched_vendor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_submitted_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own vendor submissions"
  ON public.user_submitted_vendors
  FOR INSERT
  WITH CHECK (submitted_by = (auth.jwt() ->> 'sub'));

CREATE POLICY "Users can read own vendor submissions"
  ON public.user_submitted_vendors
  FOR SELECT
  USING (submitted_by = (auth.jwt() ->> 'sub'));

CREATE POLICY "Admins manage all vendor submissions"
  ON public.user_submitted_vendors
  FOR ALL
  USING ((auth.jwt() ->> 'user_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

-- ── get_tech_stack_market_report ─────────────────────────────

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
          WHERE vm.category = m.category AND s.health_score IS NOT NULL
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
            WHERE vm.category = m.category
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
    LEFT JOIN public.category_benchmarks cb ON m.category = cb.category
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

COMMENT ON TABLE public.user_tech_stack IS 'Dealer tech stack profiles — which vendors they use, satisfaction, and switching intent';
COMMENT ON TABLE public.user_tech_stack_exit_reasons IS 'Reasons dealers left or are exploring away from vendors';
COMMENT ON TABLE public.user_submitted_vendors IS 'Dealer-submitted vendors not yet in vendor_metadata';
