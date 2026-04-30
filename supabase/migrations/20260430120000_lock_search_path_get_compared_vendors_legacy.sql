-- CAR-19: lock the search_path on the legacy 2-arg overload of
-- public.get_compared_vendors.
--
-- The newer 3/4/5-arg overloads (CAR-19 v2 and the follow-on product-line and
-- category-override variants) all set search_path = public in their CREATE
-- definitions. The legacy 2-arg overload was created before that pattern
-- (migration 20260312510000_fix_compared_vendors_dms_crm.sql) and therefore
-- inherits the role-mutable search_path, which the Supabase security advisor
-- flags as a SECURITY DEFINER hijack risk.
--
-- This migration only mutates the function attribute; it does not change the
-- function body. Existing callers (PulseBriefing.tsx, fetchComparedVendors)
-- continue to resolve to this overload and behave identically.

ALTER FUNCTION public.get_compared_vendors(text, integer)
  SET search_path = public;
