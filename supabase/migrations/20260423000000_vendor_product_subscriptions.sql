-- ============================================================
-- vendor_product_subscriptions: junction table linking vendor_logins
-- to vendor_product_lines with a per-product tier.
--
-- FK is to vendor_logins(id) (the PK), NOT vendor_logins(user_id),
-- so one vendor org can have multiple logins all sharing the same
-- product subscriptions via JOIN on vendor_login_id.
-- ============================================================

CREATE TABLE public.vendor_product_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_login_id UUID NOT NULL REFERENCES public.vendor_logins(id) ON DELETE CASCADE,
  vendor_product_line_id UUID NOT NULL REFERENCES public.vendor_product_lines(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'unverified'
    CHECK (tier IN ('unverified', 'tier_1', 'tier_2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendor_login_id, vendor_product_line_id)
);

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX idx_vendor_product_subscriptions_login
  ON public.vendor_product_subscriptions(vendor_login_id);
CREATE INDEX idx_vendor_product_subscriptions_product_line
  ON public.vendor_product_subscriptions(vendor_product_line_id);

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE public.vendor_product_subscriptions ENABLE ROW LEVEL SECURITY;

-- Vendors can read their own subscriptions (for the product line switcher)
CREATE POLICY "Vendor can read own subscriptions"
  ON public.vendor_product_subscriptions FOR SELECT TO authenticated
  USING (
    vendor_login_id IN (
      SELECT id FROM public.vendor_logins WHERE user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated role.
-- Admin writes go through service-role Edge Function or SECURITY DEFINER admin RPCs.

-- ── Comment ──────────────────────────────────────────────────

COMMENT ON TABLE public.vendor_product_subscriptions IS
  'Junction table linking vendor_logins to vendor_product_lines with per-product tier. '
  'Created by admin provisioning. Read by vendor dashboard for product line switching.';
