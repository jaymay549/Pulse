-- CAR-19: add manual competitor-override array to vendor_profiles.
-- When non-null, downstream RPCs (e.g. get_compared_vendors v2) bypass the
-- auto-derived category segment and rank only against this curated set.
-- Shape: ["Acme CRM", "DealerStream", ...] using canonical names from
-- vendor_entities. Validation that names exist is enforced at write time
-- by the (future) admin form, not here.

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS competitor_override jsonb;

COMMENT ON COLUMN public.vendor_profiles.competitor_override IS
  'Optional admin-curated competitor set for the leaderboard. When non-null, get_compared_vendors uses this instead of the category-derived segment. JSON array of canonical vendor names.';
