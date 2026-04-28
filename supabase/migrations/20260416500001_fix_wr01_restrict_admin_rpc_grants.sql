-- ============================================================
-- Fix WR-01: Restrict admin RPC grants to service_role only
--
-- admin_audit_vendor_duplicates() and admin_vendor_health_check()
-- are SECURITY DEFINER functions that expose internal data structures
-- (orphan profiles with user_id, all vendor entity names, mention
-- counts). The original migrations granted EXECUTE to all
-- `authenticated` users. This revokes that broad grant and restricts
-- access to service_role only (callable from Edge Functions and
-- backend services), so no regular authenticated user can invoke them.
-- ============================================================

-- Revoke broad authenticated access
REVOKE EXECUTE ON FUNCTION public.admin_audit_vendor_duplicates() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_vendor_health_check() FROM authenticated;

-- Grant to service_role only (Edge Functions, backend, admin tooling)
GRANT EXECUTE ON FUNCTION public.admin_audit_vendor_duplicates() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_vendor_health_check() TO service_role;
