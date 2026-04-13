# Requirements: Vendor Tiering System

**Defined:** 2026-04-13
**Core Value:** Vendors authenticate via Supabase magic link and see only the data their tier permits

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Vendor Authentication

- [ ] **AUTH-01**: Vendor can enter email at `/vendor-login` and receive a magic link/OTP to authenticate
- [ ] **AUTH-02**: Vendor clicking magic link lands authenticated on `/vendor-dashboard` with a valid Supabase Auth session
- [ ] **AUTH-03**: Vendor Supabase Auth session is isolated from Clerk session (separate client instance, no cross-contamination)
- [ ] **AUTH-04**: Unauthenticated users accessing `/vendor-dashboard` are redirected to `/vendor-login` via VendorAuthGuard
- [ ] **AUTH-05**: Admin users (Clerk auth) can still access `/vendor-dashboard` without vendor auth (existing behavior preserved)
- [ ] **AUTH-06**: Expired or invalid magic link shows clear error message with CTA to request a new link
- [ ] **AUTH-07**: Nav bar shows a vendor login button (next to admin) for testing purposes
- [ ] **AUTH-08**: Vendor session expiry redirects to `/vendor-login` with re-auth prompt
- [ ] **AUTH-09**: `shouldCreateUser: false` prevents self-registration — only admin-provisioned emails can log in

### Admin Vendor Management

- [x] **ADMIN-01**: Admin can create vendor login credentials by entering a vendor email address
- [ ] **ADMIN-02**: Admin can link a new vendor login to an existing vendor profile from a searchable list
- [ ] **ADMIN-03**: Admin can set vendor tier (Unverified / Tier 1 / Tier 2) during or after provisioning
- [ ] **ADMIN-04**: Admin vendor list shows color-coded tier badges for quick visual identification
- [ ] **ADMIN-05**: Admin can resend magic link to a vendor with one click
- [x] **ADMIN-06**: `vendor_logins` table links Supabase Auth user ID (UUID) to vendor profile and tier

### Tier-Based Data Gating

- [ ] **TIER-01**: RLS base predicate ensures vendor sees only their own data (`vendor_logins.user_id = auth.uid()`)
- [ ] **TIER-02**: Tier 1 vendors ($12K) see market intel and positivity/ranking leaderboard within their segment
- [ ] **TIER-03**: Tier 1 vendors cannot access action plans, "what people are saying", or actionable data segments
- [ ] **TIER-04**: Tier 2 vendors ($25K) see all Tier 1 content plus granular dimension insights, mentions, and action plans
- [ ] **TIER-05**: Tier gating enforced at database level via RLS policies (not just frontend)
- [ ] **TIER-06**: Frontend renders locked/hidden sections for out-of-tier features (no data leaks via API)
- [ ] **TIER-07**: `vendor_tier()` SECURITY DEFINER function provides tier lookup for RLS policies without circular dependency

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Security Hardening

- **SEC-01**: Audit all 142 SECURITY DEFINER RPCs for tier-bypass vulnerabilities
- **SEC-02**: Rate limiting on magic link requests to prevent abuse
- **SEC-03**: Magic link redirect URL allowlisting for all environments (localhost, Vercel preview, production)

### Enhanced Admin Features

- **EADM-01**: Last login / activity indicator per vendor in admin panel
- **EADM-02**: Vendor account deactivation/suspension by admin
- **EADM-03**: Bulk vendor provisioning (CSV import)

### Vendor Experience

- **VEXP-01**: Locked/blurred sections showing T2 features to T1 vendors (upsell surface)
- **VEXP-02**: Graceful "no access" holding page for Unverified tier vendors
- **VEXP-03**: Vendor can request tier upgrade from within dashboard

## Out of Scope

| Feature | Reason |
|---------|--------|
| Self-serve vendor registration | Sales team controls access; open registration undermines sales relationship |
| Vendor password-based login | Magic link is simpler for managed B2B portal; no credential management overhead |
| Vendor billing/payments in-portal | Payments handled outside the platform; premature complexity |
| Merging vendor + Clerk sessions | Architecturally dangerous; risks breaking dealer/admin auth |
| Vendor-to-vendor comparison views | Separate product decision; category benchmarks already exist |
| Mobile-optimized vendor experience | Web-only for now; don't break on mobile but don't optimize |
| Real-time data subscriptions | Vendor data updates daily; React Query polling sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| AUTH-07 | Phase 1 | Pending |
| AUTH-08 | Phase 1 | Pending |
| AUTH-09 | Phase 1 | Pending |
| ADMIN-01 | Phase 2 | Complete |
| ADMIN-02 | Phase 2 | Pending |
| ADMIN-03 | Phase 2 | Pending |
| ADMIN-04 | Phase 2 | Pending |
| ADMIN-05 | Phase 2 | Pending |
| ADMIN-06 | Phase 2 | Complete |
| TIER-01 | Phase 3 | Pending |
| TIER-02 | Phase 3 | Pending |
| TIER-03 | Phase 3 | Pending |
| TIER-04 | Phase 3 | Pending |
| TIER-05 | Phase 3 | Pending |
| TIER-06 | Phase 3 | Pending |
| TIER-07 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-04-13*
*Last updated: 2026-04-13 after roadmap creation*
