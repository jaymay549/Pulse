-- ============================================================
-- Per-product-line tier helpers and admin CRUD RPCs.
--
-- These SECURITY DEFINER functions let the vendor dashboard query
-- product-specific tier without bypassing RLS, and give admin
-- tooling clean upsert/delete/list access to subscriptions.
-- ============================================================

-- ── 1. vendor_product_tier(p_product_line_slug) ──────────────
-- Returns the tier for the current vendor session + a given
-- product line slug. Returns NULL if vendor is not subscribed
-- to that product line (defense in depth per D-14).

CREATE OR REPLACE FUNCTION public.vendor_product_tier(p_product_line_slug TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vps.tier
  FROM public.vendor_product_subscriptions vps
  JOIN public.vendor_product_lines vpl ON vpl.id = vps.vendor_product_line_id
  JOIN public.vendor_logins vl ON vl.id = vps.vendor_login_id
  WHERE vl.user_id = auth.uid()
    AND vpl.slug = p_product_line_slug
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.vendor_product_tier(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_product_tier(TEXT) TO authenticated;

COMMENT ON FUNCTION public.vendor_product_tier(TEXT) IS
  'Returns product-specific tier for current vendor session + product line slug. '
  'NULL if vendor is not subscribed to that product line. Per D-14.';

-- ── 2. vendor_subscribed_slugs() ─────────────────────────────
-- Returns all product lines the current vendor session is
-- subscribed to, ordered alphabetically. Used by the product
-- line switcher in the vendor dashboard.

CREATE OR REPLACE FUNCTION public.vendor_subscribed_slugs()
RETURNS TABLE(slug TEXT, tier TEXT, product_line_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vpl.slug, vps.tier, vpl.name
  FROM public.vendor_product_subscriptions vps
  JOIN public.vendor_product_lines vpl ON vpl.id = vps.vendor_product_line_id
  JOIN public.vendor_logins vl ON vl.id = vps.vendor_login_id
  WHERE vl.user_id = auth.uid()
  ORDER BY vpl.name ASC;
$$;

REVOKE ALL ON FUNCTION public.vendor_subscribed_slugs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_subscribed_slugs() TO authenticated;

COMMENT ON FUNCTION public.vendor_subscribed_slugs() IS
  'Returns all product lines the current vendor session is subscribed to, '
  'ordered alphabetically by name. Used by product line switcher in vendor dashboard.';

-- ── 3. admin_upsert_product_subscription() ───────────────────
-- Admin CRUD: create or update a subscription for a vendor/product pair.

CREATE OR REPLACE FUNCTION public.admin_upsert_product_subscription(
  p_vendor_name TEXT,
  p_product_line_slug TEXT,
  p_tier TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_login_id UUID;
  v_product_line_id UUID;
BEGIN
  SELECT id INTO v_login_id
  FROM public.vendor_logins
  WHERE vendor_name = p_vendor_name
  LIMIT 1;
  IF v_login_id IS NULL THEN
    RAISE EXCEPTION 'No vendor login found for vendor_name: %', p_vendor_name;
  END IF;

  SELECT id INTO v_product_line_id
  FROM public.vendor_product_lines
  WHERE slug = p_product_line_slug;
  IF v_product_line_id IS NULL THEN
    RAISE EXCEPTION 'No product line found for slug: %', p_product_line_slug;
  END IF;

  INSERT INTO public.vendor_product_subscriptions
    (vendor_login_id, vendor_product_line_id, tier, updated_at)
  VALUES
    (v_login_id, v_product_line_id, p_tier, now())
  ON CONFLICT (vendor_login_id, vendor_product_line_id)
  DO UPDATE SET tier = EXCLUDED.tier, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_product_subscription(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_product_subscription(TEXT, TEXT, TEXT) TO authenticated;

-- ── 4. admin_delete_product_subscription() ───────────────────
-- Admin CRUD: remove a subscription for a vendor/product pair.

CREATE OR REPLACE FUNCTION public.admin_delete_product_subscription(
  p_vendor_name TEXT,
  p_product_line_slug TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_login_id UUID;
  v_product_line_id UUID;
BEGIN
  SELECT id INTO v_login_id
  FROM public.vendor_logins
  WHERE vendor_name = p_vendor_name
  LIMIT 1;
  IF v_login_id IS NULL THEN
    RAISE EXCEPTION 'No vendor login found for vendor_name: %', p_vendor_name;
  END IF;

  SELECT id INTO v_product_line_id
  FROM public.vendor_product_lines
  WHERE slug = p_product_line_slug;
  IF v_product_line_id IS NULL THEN
    RAISE EXCEPTION 'No product line found for slug: %', p_product_line_slug;
  END IF;

  DELETE FROM public.vendor_product_subscriptions
  WHERE vendor_login_id = v_login_id
    AND vendor_product_line_id = v_product_line_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_product_subscription(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_product_subscription(TEXT, TEXT) TO authenticated;

-- ── 5. admin_list_product_subscriptions() ────────────────────
-- Admin read: list all subscriptions for a given vendor name.

CREATE OR REPLACE FUNCTION public.admin_list_product_subscriptions(p_vendor_name TEXT)
RETURNS TABLE(product_line_slug TEXT, product_line_name TEXT, tier TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vpl.slug, vpl.name, vps.tier
  FROM public.vendor_product_subscriptions vps
  JOIN public.vendor_product_lines vpl ON vpl.id = vps.vendor_product_line_id
  JOIN public.vendor_logins vl ON vl.id = vps.vendor_login_id
  WHERE vl.vendor_name = p_vendor_name
  ORDER BY vpl.name ASC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_product_subscriptions(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_product_subscriptions(TEXT) TO authenticated;
