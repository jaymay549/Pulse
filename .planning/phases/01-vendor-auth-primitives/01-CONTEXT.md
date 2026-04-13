# Phase 1: Vendor Auth Primitives - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Vendor authentication via Supabase magic link/OTP — login page, session isolation from Clerk, route guard, and nav entry point. Vendors land on the existing `/vendor-dashboard` after auth.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User deferred all implementation decisions to Claude. The following areas are open for the researcher and planner to determine the best approach:

- **D-01:** Login page UX — OTP input flow, branding, error states, messaging for unknown emails
- **D-02:** Session & auth isolation — separate Supabase client instance, storageKey strategy, dual-auth detection on /vendor-dashboard
- **D-03:** Route guard behavior — VendorAuthGuard redirect flow, admin bypass logic (AUTH-05), session expiry handling
- **D-04:** Nav entry point — where the vendor login button lives, visibility rules, placement

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth Architecture
- `src/integrations/supabase/client.ts` — Existing Supabase client (single instance, localStorage persistence)
- `src/hooks/useClerkAuth.ts` — Clerk auth hook (must not be modified or broken)
- `src/hooks/useClerkSupabase.ts` — Clerk-enhanced Supabase client (JWT passthrough)
- `src/hooks/useVendorAuth.ts` — Existing vendor auth via Clerk orgs (will be replaced/augmented)

### Vendor Dashboard
- `src/pages/VendorDashboardPage.tsx` — Existing vendor dashboard page (uses useClerkAuth, must also accept vendor Supabase sessions)
- `src/components/vendor-dashboard/` — Dashboard components directory

### Routing
- `src/App.tsx` — Route definitions, lazy loading, `/vendor-dashboard` route exists
- `src/components/Navigation.tsx` — Marketing nav (not the authenticated app nav)

### Requirements
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-09 define exact acceptance criteria

No external specs — requirements fully captured in REQUIREMENTS.md and PROJECT.md decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/client.ts`: Existing Supabase client — vendor needs a **separate** client with isolated `storageKey: 'vendor-auth'`
- shadcn/ui components: Button, Input, Card, Dialog — all available for login page
- `useClerkAuth`: Pattern for auth hooks (return shape, loading states) — vendor hook should follow same ergonomics
- `Loader2` spinner used consistently for loading states

### Established Patterns
- Auth hooks return `{ isLoaded, isAuthenticated, user, ... }` shape
- Route guards use early return with redirect (see AdminGuard pattern)
- Lazy-loaded pages with Suspense fallback
- React Query for server state, component-local useState for UI state
- Toast notifications via Sonner

### Integration Points
- `App.tsx` — new `/vendor-login` route, VendorAuthGuard wrapper for `/vendor-dashboard`
- `VendorDashboardPage.tsx` — needs dual-auth check (accept both Clerk admin and vendor Supabase sessions)
- Nav component — add vendor login button (AUTH-07)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-vendor-auth-primitives*
*Context gathered: 2026-04-13*
