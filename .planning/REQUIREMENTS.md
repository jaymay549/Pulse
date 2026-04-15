# Requirements: Vendor Tiering System

**Defined:** 2026-04-13
**Core Value:** Vendors authenticate via Supabase magic link and see only the data their tier permits

## v1.0 Requirements (Complete)

### Vendor Authentication

- [x] **AUTH-01**: Vendor can enter email at `/vendor-login` and receive a magic link/OTP to authenticate
- [x] **AUTH-02**: Vendor clicking magic link lands authenticated on `/vendor-dashboard` with a valid Supabase Auth session
- [x] **AUTH-03**: Vendor Supabase Auth session is isolated from Clerk session (separate client instance, no cross-contamination)
- [x] **AUTH-04**: Unauthenticated users accessing `/vendor-dashboard` are redirected to `/vendor-login` via VendorAuthGuard
- [x] **AUTH-05**: Admin users (Clerk auth) can still access `/vendor-dashboard` without vendor auth (existing behavior preserved)
- [x] **AUTH-06**: Expired or invalid magic link shows clear error message with CTA to request a new link
- [x] **AUTH-07**: Nav bar shows a vendor login button (next to admin) for testing purposes
- [x] **AUTH-08**: Vendor session expiry redirects to `/vendor-login` with re-auth prompt
- [x] **AUTH-09**: `shouldCreateUser: false` prevents self-registration — only admin-provisioned emails can log in

### Admin Vendor Management

- [x] **ADMIN-01**: Admin can create vendor login credentials by entering a vendor email address
- [x] **ADMIN-02**: Admin can link a new vendor login to an existing vendor profile from a searchable list
- [x] **ADMIN-03**: Admin can set vendor tier (Unverified / Tier 1 / Tier 2) during or after provisioning
- [x] **ADMIN-04**: Admin vendor list shows color-coded tier badges for quick visual identification
- [x] **ADMIN-05**: Admin can resend magic link to a vendor with one click
- [x] **ADMIN-06**: `vendor_logins` table links Supabase Auth user ID (UUID) to vendor profile and tier

### Tier-Based Data Gating

- [x] **TIER-01**: RLS base predicate ensures vendor sees only their own data (`vendor_logins.user_id = auth.uid()`)
- [x] **TIER-02**: Tier 1 vendors ($12K) see market intel and positivity/ranking leaderboard within their segment
- [x] **TIER-03**: Tier 1 vendors cannot access action plans, "what people are saying", or actionable data segments
- [x] **TIER-04**: Tier 2 vendors ($25K) see all Tier 1 content plus granular dimension insights, mentions, and action plans
- [x] **TIER-05**: Tier gating enforced at database level via RLS policies (not just frontend)
- [x] **TIER-06**: Frontend renders locked/hidden sections for out-of-tier features (no data leaks via API)
- [x] **TIER-07**: `vendor_tier()` SECURITY DEFINER function provides tier lookup for RLS policies without circular dependency

## v1.1 Requirements

Requirements for Admin-Configurable Tier Gating milestone. Each maps to roadmap phases.

### Admin Tier Configuration

- [ ] **ACONF-01**: Admin can view a config panel listing all vendor dashboard components per tier
- [ ] **ACONF-02**: Admin can toggle component visibility (full / gated / hidden) for each tier
- [ ] **ACONF-03**: Admin can configure a "test" tier with any combination of component visibility for demos/QA
- [ ] **ACONF-04**: Tier config changes persist immediately to `tier_component_config` DB table

### Data Model

- [ ] **DATA-01**: `tier_component_config` table stores tier → component → visibility mappings
- [ ] **DATA-02**: Frontend reads tier config from DB to determine what to show/blur/gate per vendor

### Partial Gating (T1 Defaults)

- [ ] **GATE-01**: T1 sees health score, sentiment trend, NPS, benchmarking, discussion volume, dimensional breakdown, performance breakdown, pulse briefing, verified badge, profile editing
- [ ] **GATE-02**: T1 sees "What dealers are saying" — top 2 items only (AI-summarized), with "See all" gated to T2
- [ ] **GATE-03**: T1 sees competitor leaderboard sorted by positivity with vendor highlighted; "Why you rank here" gates to T2
- [ ] **GATE-04**: Gated sections show blurred/locked state with upgrade CTA (not hidden)

### T2 Unlocks

- [ ] **GATE-05**: T2 unlocks full AI action plan with recommendations
- [ ] **GATE-06**: T2 unlocks all dealer comments and conversations
- [ ] **GATE-07**: T2 unlocks audience segments, dealer signals, competitive breakdown, integrations

### Dynamic Frontend Gating

- [ ] **DYN-01**: Replace hardcoded `T2_ONLY_SECTIONS` with config-driven visibility from `tier_component_config`
- [ ] **DYN-02**: Vendor dashboard components read tier config and render full/gated/hidden based on vendor's tier

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

- **VEXP-01**: Vendor can request tier upgrade from within dashboard
- **VEXP-02**: Graceful "no access" holding page for Unverified tier vendors

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
| T3 tier implementation | Not yet defined; free during 3-month beta |
| RLS policy changes for tier_component_config | Frontend-only gating layer on top of existing RLS safety net |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 → AUTH-09 | Phase 1 (v1.0) | Complete |
| ADMIN-01 → ADMIN-06 | Phase 2 (v1.0) | Complete |
| TIER-01 → TIER-07 | Phase 3 (v1.0) | Complete |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 13

---
*Requirements defined: 2026-04-13*
*Last updated: 2026-04-15 — v1.1 requirements added*
